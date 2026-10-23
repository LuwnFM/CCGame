import {apply,RuleError,type Card,type Command,type Game,type Player,type Permanent,type LoyaltyEffect} from '../core.ts';
import {testDeck,type ArchetypeId} from '../decks.ts';
import {chooseDefensiveInterceptor} from './defense.ts';
import {totalAttack} from '../mechanics/combat.ts';

const ARCHETYPES=['red','blue','green','gold','violet','neutral'] as const;
const STANDARDS=new Map(ARCHETYPES.map(id=>[id,testDeck(id)] as const));
let probeSerial=0;

/** Probability of at least one desired card in N draws without replacement. */
export function drawProbability(deckSize:number,copies:number,draws:number):number {
 if (![deckSize,copies,draws].every(Number.isSafeInteger)||deckSize<0||copies<0||draws<0||copies>deckSize) throw Error('Invalid card probabilities');
 let noHit=1;
 for(let i=0;i<Math.min(deckSize,draws);i++)noHit*=Math.max(0,(deckSize-copies-i)/(deckSize-i));
 return 1-noHit;
}
function frequency(cards:readonly Card[]):Map<string,number>{
 const map=new Map<string,number>();
 for(const card of cards)map.set(card.id,(map.get(card.id)||0)+1);
 return map;
}
function field(g:Game,index:0|1):Card[]{
 const p=g.players[index];
 return [...p.domains,...p.main,...p.auxiliary,...p.legends].map(x=>x.card);
}
export type BotKnowledge={hand:readonly Card[];remaining:ReadonlyMap<string,number>;deckSize:number;domainDrawChance:number;
 enemyArchetypeOdds:ReadonlyMap<ArchetypeId,number>};
/** Knowledge is derived from the bot's starter list and its own/public zones. */
export function observeBot(g:Game,starter:ArchetypeId):BotKnowledge {
 const own=g.players[1],base=STANDARDS.get(starter)!;
 const remaining=frequency(base);
 for(const card of [...own.hand,...own.discard,...own.erased,...field(g,1)]) {
  if(card.createdToken||card.ritualReward)continue;
  remaining.set(card.id,Math.max(0,(remaining.get(card.id)||0)-1));
 }
 const observed=frequency([...g.players[0].discard,...field(g,0)].filter(c=>!c.createdToken&&!c.ritualReward));
 const logScores=ARCHETYPES.map(archetype=>{
  const deck=frequency(STANDARDS.get(archetype)!);let score=0;
  for(const [id,copies] of observed){
   const available=deck.get(id)||0;
   score+=copies>available?-9*copies:copies*Math.log((available+0.2)/70.2);
  }
  return score;
 });
 const max=Math.max(...logScores),relative=logScores.map(n=>Math.exp(n-max));
 const denominator=relative.reduce((a,b)=>a+b,0);
 const enemyArchetypeOdds=new Map(ARCHETYPES.map((id,i)=>[id,relative[i]/denominator] as const));
 const domainIds=new Set(base.filter(c=>c.kind==='domain').map(c=>c.id));
 const domainsRemaining=[...remaining].reduce((sum,[id,n])=>sum+(domainIds.has(id)?n:0),0);
 return {hand:own.hand,remaining,deckSize:own.deck.length,
  domainDrawChance:drawProbability(own.deck.length,Math.min(domainsRemaining,own.deck.length),2),enemyArchetypeOdds};
}

function cost(card:Card):number{
 return (card.cost?.generic||0)+Object.values(card.cost?.colored||{}).reduce((n,v)=>n+(v||0),0);
}
function traitValue(card:Card):number{
 return Number(!!card.guard)*1.8+Number(!!card.flying)*1.4+Number(!!card.firstStrike)*1.4+
  Number(!!card.piercing)*0.7+Number(!!card.lifesteal)*1.1+Number(!!card.haste)*1.3+
  Number(!!card.zeal)*0.8+Number(!!card.poisonHit)*1.7+Number(!!card.shield)*0.5+
  Number(!!card.extraAttacks)*1.7;
}
function unitValue(unit:Permanent):number{
 const card=unit.card;
 if(card.kind==='legend')return 4.2+(unit.loyalty??card.loyalty??0)*0.8+
   (unit.stunned||unit.stasis||unit.silenced? -1.5:0);
 const attack=card.attack??0,health=card.health??0;
 return 1.7+attack*0.85+Math.max(0,health-unit.damage+unit.shield)*0.5+traitValue(card)+
   (unit.sacrifice?0.4:0)+(unit.stunned||unit.stasis? -3.2:0)+(unit.silenced? -1.8:0)+
   (unit.exhausted? -0.25:0);
}
function handValue(card:Card):number{
 if(card.kind==='domain')return 0.5;
 const raw=card.kind==='creature'?3+(card.attack??0)*0.45+(card.health??0)*0.25+traitValue(card)*0.3:
  card.kind==='legend'?4:card.kind==='technique'?3.4:3.2;
 return Math.min(5.2,raw+Number(!!card.onEntry)*0.6+Number(!!card.techniqueEffect)*0.6);
}
function hpValue(hp:number):number{
 return Math.min(40,hp)*0.22-Math.max(0,24-hp)*0.32-Math.max(0,12-hp)*2.4;
}
/** Scores only public opponent state; hidden enemy hand and deck identities are never inspected. */
function scoreOwn(p:Player):number{
 // Only hand size is scored here. Candidate simulation must not inspect cards
 // drawn from a hidden deck before the draw command has actually committed.
 let score=hpValue(p.hp)+p.hand.length*1.45;
 score+=p.domains.length*0.35;
 score+=[...p.main,...p.auxiliary,...p.legends].reduce((n,u)=>n+unitValue(u),0);
 score+=p.rituals.reduce((n,r)=>n+Math.max(0,3-r.remainingStarts)*0.25,0);
 return score;
}
function scorePublic(p:Player):number{
 return hpValue(p.hp)+p.domains.length*0.35+
  [...p.main,...p.auxiliary,...p.legends].reduce((n,u)=>n+unitValue(u),0);
}
function stateValue(g:Game):number{
 if(g.winner===1)return 100000;
 if(g.winner===0)return -100000;
 if(g.winner==='draw')return 0;
 return scoreOwn(g.players[1])-scorePublic(g.players[0])+(g.pendingReward?5:0);
}
function probe(g:Game,actor:0|1,type:string,extra:Record<string,unknown>={}):Game|null{
 const command={...extra,type,actor,expectedRevision:g.revision,key:`bot-probe-${g.revision}-${probeSerial++}`} as Command;
 try{return apply(g,command);}catch(e){if(e instanceof RuleError)return null;throw e;}
}
function committed(g:Game,type:string,extra:Record<string,unknown>={}):Command|null{
 const command={...extra,type,actor:1,expectedRevision:g.revision,key:`tester-bot-${g.revision}`} as Command;
 try{apply(g,command);return command;}catch(e){if(e instanceof RuleError)return null;throw e;}
}
function bestOutcome(g:Game,candidates:Record<string,unknown>[],force=false,
 bonus?:(candidate:Record<string,unknown>,next:Game)=>number):Command|null{
 let best:Command|null=null,bestScore=force?-Infinity:stateValue(g)+0.0001;
 for(const candidate of candidates){
  const {type,...extra}=candidate;
  const next=probe(g,1,String(type),extra);
  if(!next)continue;
  const score=stateValue(next)+(bonus?.(candidate,next)??0);
  if(score>bestScore){bestScore=score;best=committed(g,String(type),extra);}
 }
 return best;
}

function expectedDrawStrength(info:BotKnowledge,starter:ArchetypeId):number{
 const byId=new Map(STANDARDS.get(starter)!.map(c=>[c.id,c]));
 let sum=0,count=0;
 for(const [id,copies] of info.remaining){
  if(!copies)continue;
  const c=byId.get(id);if(!c)continue;
  const value=c.kind==='domain'?2.5:c.kind==='creature'?4+(c.attack||0)*0.7+(c.health||0)*0.25+
    Number(!!c.guard)*2+Number(!!c.firstStrike)*2:c.kind==='legend'?7:c.kind==='technique'?5:4;
  sum+=copies*value;count+=copies;
 }
 return count?sum/count:0;
}
function expectedFastPressure(info:BotKnowledge):number{
 let pressure=0;
 for(const [id,probability] of info.enemyArchetypeOdds){
  const quick=STANDARDS.get(id)!.filter(c=>c.kind==='creature'&&cost(c)<=3);
  const average=quick.length?quick.reduce((n,c)=>n+(c.attack||0)+Number(!!c.haste)*1.2+
   Number(!!c.zeal)*1.4+Number(!!c.flying)*0.4,0)/quick.length:0;
  pressure+=probability*average;
 }
 return pressure;
}
function weakestHandIndex(p:Player):number{
 const score=(card:Card)=>card.kind==='domain'
  ?(p.domains.length<3?7.2-p.domains.length*0.55:p.domains.length<6?4.8-p.domains.length*0.35:0.8)+(p.domainsPlayed<1?0.8:0)
  :handValue(card);
 return p.hand.map((card,index)=>({card,index})).sort((a,b)=>score(a.card)-score(b.card))[0]?.index??0;
}
function openingMulligan(hand:readonly Card[],domainDrawChance:number):number[]{
 const domains=hand.filter(c=>c.kind==='domain').length;
 const replace=hand.map((card,index)=>({card,index})).filter(({card})=>{
  if(card.kind==='domain')return domains>4;
  const cheapCreatures=hand.filter(c=>c.kind==='creature'&&cost(c)<=3).length;
  return cost(card)>=5&&cheapCreatures<2 || domains===1&&cost(card)>=4&&domainDrawChance<0.18;
 }).sort((a,b)=>handValue(a.card)-handValue(b.card)).map(x=>x.index);
 return replace.slice(0,3);
}

function targetIdsFor(card:Card,g:Game):Array<number|undefined>{
 const own=g.players[1],enemy=g.players[0];
 const effect=card.onEntry??card.techniqueEffect;
 switch(effect?.kind){
  case 'stunEnemy':case 'stasisEnemy':case 'bind':case 'damageCreature':
   return [...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature').map(u=>u.objectId);
  case 'silence':return [...enemy.main,...enemy.auxiliary,...enemy.legends].map(u=>u.objectId);
  case 'cleanse':return [...own.main,...own.auxiliary,...own.legends].map(u=>u.objectId);
  default:return [undefined];
 }
}
function cardCandidates(g:Game):Record<string,unknown>[] {
 const p=g.players[1],zoneMain=[...p.main,...p.auxiliary];
 const out:Record<string,unknown>[]=[];
 p.hand.forEach((card,handIndex)=>{
  const type=({creature:'playCreature',technique:'playTechnique',legend:'playLegend',artifact:'playArtifact'} as Record<string,string>)[card.kind];
  if(!type)return;
  const targets=targetIdsFor(card,g);
  const discards=card.techniqueEffect?.kind==='reanimate'
    ?p.discard.map((c,i)=>c.kind==='creature'?i:-1).filter(i=>i>=0):[undefined];
  const targetVariants=targets.length?targets:[undefined];
  const zone=card.createdToken||type==='playArtifact'?p.auxiliary:p.main;
  const limit=card.createdToken||type==='playArtifact'?4:8;
  const replacements=zone.length>=limit?[undefined,...zone.filter(u=>!u.card.majestic).map(u=>u.objectId)]:[undefined];
  const duplicate=(card.unique&&zoneMain.some(u=>u.card.name===card.name))||
   (type==='playLegend'&&p.legends.some(u=>u.card.name===card.name))||
   (type==='playArtifact'&&p.auxiliary.some(u=>u.card.name===card.name));
  for(const targetId of targetVariants)for(const discardIndex of discards)for(const replaceId of replacements){
   const base={handIndex,...(targetId===undefined?{}:{targetId}),...(discardIndex===undefined?{}:{discardIndex}),...(replaceId===undefined?{}:{replaceId})};
   for(const keepExisting of duplicate?[true,false]:[undefined])
    out.push({type,...base,...(keepExisting===undefined?{}:{keepExisting})});
  }
  if(card.kind==='technique'&&card.techniqueEffect?.kind==='reanimate'&&!discards.length)
   out.push({type,handIndex});
 });
 return out;
}

/** Beam-search a short sequence of legal plays so one expensive card does not
 * automatically crowd out two better combinations. Stop after a simulated draw:
 * the bot must not inspect identities drawn from its hidden deck while planning.
 */
function planCards(g:Game):Command|null{
 type Node={state:Game;first:Record<string,unknown>;score:number;expand:boolean};
 const base=stateValue(g);let best:Node|null=null;
 let frontier:Node[]=[{state:g,first:{},score:base,expand:true}];
 for(let depth=0;depth<3;depth++){
  const expanded:Node[]=[];
  for(const node of frontier.filter(n=>n.expand)){
   for(const action of cardCandidates(node.state)){
    const {type,...extra}=action;
    const next=probe(node.state,1,String(type),extra);if(!next)continue;
    const first=depth===0?action:node.first;
    const score=stateValue(next);
    const card=node.state.players[1].hand[Number(action.handIndex)];
    const effect=card?.onEntry??card?.techniqueEffect;
    const hiddenDraw=effect?.kind==='draw'||next.players[1].hand.length>node.state.players[1].hand.length-1;
    const candidate={state:next,first,score,expand:!hiddenDraw&&next.phase==='main'};
    if(score>base+0.0001&&(!best||score>best.score))best=candidate;
    expanded.push(candidate);
   }
  }
  frontier=expanded.filter(n=>n.expand).sort((a,b)=>b.score-a.score).slice(0,4);
  if(!frontier.length)break;
 }
 if(!best)return null;
 const {type,...extra}=best.first;
 return committed(g,String(type),extra);
}

function abilityCandidates(g:Game):Record<string,unknown>[] {
 const p=g.players[1],out:Record<string,unknown>[]=[];
 for(const legend of p.legends){
  if(legend.lastActivatedTurn===g.turn)continue;
  const abilities=legend.card.loyaltyAbilities?.length?legend.card.loyaltyAbilities:
    legend.card.loyaltyAbility?[legend.card.loyaltyAbility]:[];
  abilities.forEach((ability:LoyaltyEffect,abilityIndex:number)=>{
   if(ability.kind==='recoverCreature'){
    p.discard.forEach((card,discardIndex)=>{if(card.kind==='creature')out.push({type:'activateLegend',objectId:legend.objectId,abilityIndex,discardIndex});});
   }else out.push({type:'activateLegend',objectId:legend.objectId,abilityIndex});
  });
 }
 return out;
}

function chooseRitual(g:Game):Command|null{
 const out:Record<string,unknown>[]=[];
 for(const ritual of g.readyRituals??[]){
  const ids=ritual.eligibleIds,need=ritual.effect.threshold;
  const chosen:number[]=[];
  const visit=(at:number)=>{
   if(chosen.length===need){out.push({type:'chooseRitual',effectId:ritual.effect.id,objectIds:[...chosen]});return;}
   for(let i=at;i<=ids.length-(need-chosen.length);i++){chosen.push(ids[i]);visit(i+1);chosen.pop();}
  };
  visit(0);
 }
 return bestOutcome(g,out,true);
}
function chooseReward(g:Game):Command|null{
 const pending=g.pendingReward;if(!pending)return null;
 const p=g.players[1],out:Record<string,unknown>[]=[];
 for(const card of pending.pool.filter(c=>pending.offeredIds.includes(c.id))){
  const zone=card.createdToken?p.auxiliary:p.main;
  const limit=card.createdToken?4:8;
  const replacements=zone.length>=limit?[undefined,...zone.filter(u=>!u.card.majestic).map(u=>u.objectId)]:[undefined];
  const duplicate=card.unique&&[...p.main,...p.auxiliary].some(u=>u.card.name===card.name);
  for(const replaceId of replacements)for(const keepExisting of duplicate?[true,false]:[undefined])
   out.push({type:'chooseReward',rewardId:card.id,...(replaceId===undefined?{}:{replaceId}),...(keepExisting===undefined?{}:{keepExisting})});
 }
 return bestOutcome(g,out,true,(candidate,next)=>{
  const card=pending.pool.find(c=>c.id===candidate.rewardId);
  return card&&next.players[1].hand.some(c=>c.id===card.id)?(handValue(card)-3.2)*0.4:0;
 });
}
function projectedAttack(g:Game,first:Record<string,unknown>):Game|null{
 let next=probe(g,1,'attack',first);if(!next)return null;
 const answer=(state:Game):Game|null=>{
  if(state.phase!=='intercept'||!state.pendingAttack)return state;
  const actor=state.pendingAttack.defender as 0|1;
  const interceptorId=chooseDefensiveInterceptor(state);
  return probe(state,actor,'intercept',{interceptorId});
 };
 next=answer(next);if(!next)return null;
 // Estimate the attack order for the rest of this turn, including lethal lines.
 for(let n=0;n<12&&next.phase==='main'&&next.active===1&&!next.winner;n++){
  const attackers=[...next.players[1].main,...next.players[1].auxiliary]
   .filter(u=>u.card.kind==='creature'&&!u.exhausted&&!u.stunned&&!u.stasis)
   .sort((a,b)=>totalAttack(next!.players[1],b)-totalAttack(next!.players[1],a));
  let continuation:Game|null=null;
  for(const unit of attackers){
   const trial=probe(next,1,'attack',{attackerId:unit.objectId,target:{kind:'player'}});
   if(!trial)continue;
   continuation=answer(trial);if(continuation)break;
  }
  if(!continuation)break;
  next=continuation;
 }
 return next;
}
function chooseAttack(g:Game):Command|null{
 const p=g.players[1],enemy=g.players[0];
 const enemies=[...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature');
 const targets:({kind:'player'}|{kind:'creature'|'legend';objectId:number})[]=[{kind:'player'},
  ...enemies.map(u=>({kind:'creature' as const,objectId:u.objectId})),
  ...enemy.legends.map(u=>({kind:'legend' as const,objectId:u.objectId}))];
 let best:Record<string,unknown>|null=null,bestScore=stateValue(g)+0.1;
 for(const attacker of [...p.main,...p.auxiliary].filter(u=>u.card.kind==='creature'))for(const target of targets){
  const action={attackerId:attacker.objectId,target};
  const projected=projectedAttack(g,action);if(!projected)continue;
  let score=stateValue(projected);
  if(projected.winner===1)score+=100000;
  if(score>bestScore){bestScore=score;best=action;}
 }
 return best?committed(g,'attack',best):null;
}

/** Server-side opponent. Each returned action is validated by the same kernel as a human move. */
export function chooseBotCommand(g:Game,starter:ArchetypeId='red'):Command|null {
 const actor=1;
 if(g.phase==='finished'||g.phase==='paused')return null;
 if(g.phase==='main'&&g.active!==actor)return null;
 if(g.phase==='intercept'&&g.pendingAttack?.defender!==actor)return null;
 const p=g.players[actor],knowledge=observeBot(g,starter);
 if(g.phase==='mulligan'){
  if(g.mulliganReady?.[actor])return null;
  return committed(g,'mulligan',{indices:openingMulligan(knowledge.hand,knowledge.domainDrawChance)});
 }
 if(g.phase==='intercept')return committed(g,'intercept',{interceptorId:chooseDefensiveInterceptor(g)});
 if(g.phase==='discard')return committed(g,'discard',{handIndex:weakestHandIndex(p)});
 if(g.phase==='ritual')return chooseRitual(g);
 if(g.phase==='reward')return chooseReward(g);
 if(g.phase!=='main')return null;
 if(p.domainsPlayed<1){
  const idx=p.hand.findIndex(c=>c.kind==='domain');
  if(idx>=0)return committed(g,'playDomain',{handIndex:idx});
 }
 for(const d of p.domains)if(!d.exhausted){
  const cmd=committed(g,'tapDomain',{objectId:d.objectId});if(cmd)return cmd;
 }
  const cardMove=planCards(g);if(cardMove)return cardMove;
 const visibleThreat=[...g.players[0].main,...g.players[0].auxiliary]
  .reduce((sum,u)=>sum+(u.card.attack||0),0);
 const drawHpFloor=12+Math.max(0,expectedFastPressure(knowledge)-2)*5;
 if(p.hand.length<=3&&knowledge.deckSize>=2&&p.hp>2&&p.lastRulerDrawTurn!==g.turn&&
  (p.hp>=drawHpFloor||p.hp-visibleThreat>5)&&expectedDrawStrength(knowledge,starter)>2.5){
  // Estimate draw value from the known starter list rather than peeking at the next cards.
  const expectedValue=expectedDrawStrength(knowledge,starter)*0.12;
  if(expectedValue*2>0.44+Number(p.hp<12)*0.7)return committed(g,'rulerDraw');
 }
 const abilityMove=bestOutcome(g,abilityCandidates(g));if(abilityMove)return abilityMove;
 const attackMove=chooseAttack(g);if(attackMove)return attackMove;
 return committed(g,'endTurn');
}
