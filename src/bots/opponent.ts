import {apply,RuleError,type Card,type Command,type Game} from '../core.ts';
import {testDeck,type ArchetypeId} from '../decks.ts';
import {chooseDefensiveInterceptor} from './defense.ts';


/** Probability of at least one desired card in N draws without replacement. */
export function drawProbability(deckSize:number,copies:number,draws:number):number {
 if (![deckSize,copies,draws].every(Number.isSafeInteger)||deckSize<0||copies<0||draws<0||copies>deckSize) throw Error('Invalid card probabilities');
 let noHit=1;
 for(let i=0;i<Math.min(deckSize,draws);i++)noHit*=Math.max(0,(deckSize-copies-i)/(deckSize-i));
 return 1-noHit;
}
const ARCHETYPES=['red','blue','green','gold','violet','neutral'] as const;
function frequency(cards:readonly Card[]):Map<string,number>{
 const map=new Map<string,number>();
 for(const card of cards)map.set(card.id,(map.get(card.id)||0)+1);
 return map;
}
const STANDARDS=new Map(ARCHETYPES.map(id=>[id,testDeck(id)] as const));
function field(g:Game,index:0|1):Card[]{
 const p=g.players[index];
 return [...p.domains,...p.main,...p.auxiliary,...p.legends].map(x=>x.card);
}
export type BotKnowledge={
 hand:readonly Card[];
 remaining:ReadonlyMap<string,number>;
 deckSize:number;
 domainDrawChance:number;
 enemyObserved:ReadonlyMap<string,number>;
 enemyArchetypeOdds:ReadonlyMap<ArchetypeId,number>;
};
/** Knowledge is derived exclusively from a standard decklist and public/revealed zones.
 * Do not access g.players[1].deck card identities or the enemy's hand or deck.
 */
export function observeBot(g:Game,starter:ArchetypeId):BotKnowledge {
 const own=g.players[1],foe=g.players[0],base=STANDARDS.get(starter)!;
 const remaining=frequency(base);
 for(const card of [...own.hand,...own.discard,...own.erased,...field(g,1)]) {
  if(card.createdToken||card.ritualReward)continue;
  remaining.set(card.id,Math.max(0,(remaining.get(card.id)||0)-1));
 }
 const observed=frequency([...foe.discard,...field(g,0)].filter(c=>!c.createdToken&&!c.ritualReward));
 const logScores=ARCHETYPES.map(archetype=>{
  const deck=frequency(STANDARDS.get(archetype)!);
  let score=0;
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
  domainDrawChance:drawProbability(own.deck.length,Math.min(domainsRemaining,own.deck.length),2),
  enemyObserved:observed,enemyArchetypeOdds};
}
/** Evaluates future draw strength using only known remaining card counts. */
function expectedDrawStrength(info:BotKnowledge,starter:ArchetypeId):number{
 const deck=STANDARDS.get(starter)!;
 const byId=new Map(deck.map(c=>[c.id,c]));
 let sum=0,count=0;
 for(const [id,copies] of info.remaining){
  if(!copies)continue;
  const c=byId.get(id);
  if(!c)continue;
  const value=c.kind==='domain'?2.5:c.kind==='creature'?4+(c.attack||0)*0.7+(c.health||0)*0.25+
      Number(!!c.guard)*2+Number(!!c.firstStrike)*2:c.kind==='legend'?7:c.kind==='technique'?5:4;
  sum+=copies*value;count+=copies;
 }
 return count?sum/count:0;
}

/** Server-side test opponent, always seat 1. Executes the same validated commands as a human. */
export function chooseBotCommand(g:Game,starter:ArchetypeId='red'):Command|null {
 const actor=1;
 if(g.phase==='finished'||g.phase==='paused')return null;
 if(g.phase==='main'&&g.active!==actor)return null;
 if(g.phase==='intercept'&&g.pendingAttack?.defender!==actor)return null;
 const p=g.players[actor],opp=g.players[0];
 const knowledge=observeBot(g,starter);
 const attempt=(cmd:Record<string,unknown>):Command|null=>{
  const action={...cmd,actor,expectedRevision:g.revision,key:'tester-bot-'+g.revision} as Command;
  try {apply(g,action);return action;}catch(e){if(e instanceof RuleError)return null;throw e;}
 };
 if(g.phase==='mulligan'){
  if(g.mulliganReady?.[actor])return null;
  const landCount=knowledge.hand.filter(c=>c.kind==='domain').length;
  const replace=knowledge.hand.map((c,i)=>({c,i})).filter(({c})=>{
    const cost=(c.cost?.generic||0)+Object.values(c.cost?.colored||{}).reduce((sum,n)=>sum+(n||0),0);
    return (c.kind==='domain'&&landCount>4)||(c.kind!=='domain'&&cost>=5&&knowledge.hand.filter(x=>x.kind==='creature'&&((x.cost?.generic||0)+Object.values(x.cost?.colored||{}).reduce((n,v)=>n+(v||0),0))<=2).length<2);
  }).map(x=>x.i).slice(0,3);
  return attempt({type:'mulligan',indices:replace});
 }
 if(g.phase==='intercept')return attempt({type:'intercept',interceptorId:chooseDefensiveInterceptor(g)});
 if(g.phase==='discard'){
  const index=p.hand.findIndex(c=>c.kind!=='domain');
  return attempt({type:'discard',handIndex:index<0?0:index});
 }
 if(g.phase==='ritual'){
  for(const r of g.readyRituals||[]){
   const cmd=attempt({type:'chooseRitual',effectId:r.effect.id,objectIds:r.eligibleIds.slice(0,r.effect.threshold)});
   if(cmd)return cmd;
  }return null;
 }
 if(g.phase==='reward'){
  const pending=g.pendingReward;
  if(!pending)return null;
  const offers=pending.pool.filter(c=>pending.offeredIds.includes(c.id)).sort((a,b)=>((b.attack||0)*2+(b.health||0)+Number(!!b.firstStrike)*3+Number(!!b.guard)*2)-((a.attack||0)*2+(a.health||0)+Number(!!a.firstStrike)*3+Number(!!a.guard)*2));
  for(const card of offers){
   const zone=card.createdToken?p.auxiliary:p.main;
   for(const replacement of [undefined,...zone.filter(u=>!u.card.majestic).map(u=>u.objectId)]){
    for(const keepExisting of [undefined,false,true]){
     const cmd=attempt({type:'chooseReward',rewardId:card.id,...(replacement!==undefined?{replaceId:replacement}:{}),...(keepExisting!==undefined?{keepExisting}:{})});
     if(cmd)return cmd;
    }
   }
  }return null;
 }
 if(g.phase!=='main')return null;
 if(p.domainsPlayed<1){
  const idx=p.hand.findIndex(c=>c.kind==='domain');
  if(idx>=0){const cmd=attempt({type:'playDomain',handIndex:idx});if(cmd)return cmd;}
 }
 for(const d of p.domains)if(!d.exhausted){const cmd=attempt({type:'tapDomain',objectId:d.objectId});if(cmd)return cmd;}
 const enemy=[...opp.main,...opp.auxiliary].filter(u=>u.card.kind==='creature').sort((a,b)=>
  ((b.card.attack||0)*2+(b.card.health||0))-((a.card.attack||0)*2+(a.card.health||0)));
 const allies=[...p.main,...p.auxiliary].filter(u=>u.card.kind==='creature');
 const enemyAttack=enemy.reduce((n,c)=>n+(c.card.attack||0),0);
 const choices=knowledge.hand.map((card,handIndex)=>({card,handIndex})).filter(x=>x.card.kind!=='domain')
  .sort((a,b)=>{
   const score=(x:typeof a)=>{
    const c=x.card;
    const cost=(c.cost?.generic||0)+Object.values(c.cost?.colored||{}).reduce((n,v)=>n+(v||0),0);
    return (c.ritual?25:0)+(c.sacrifice?6:0)+(c.kind==='creature'?20:c.kind==='legend'?12:c.kind==='artifact'?9:8)
      +(c.attack||0)*1.1+(c.health||0)*0.35+Number(!!c.firstStrike)*3
      +(enemyAttack>5?Number(!!c.guard)*7+Number(!!c.shield)*4:0)
      -Math.max(0,cost-p.domains.length)*4;
   };
   return score(b)-score(a);
  });
 for(const {card,handIndex} of choices){
  const type=({creature:'playCreature',technique:'playTechnique',legend:'playLegend',artifact:'playArtifact'} as Record<string,string>)[card.kind];
  if(!type)continue;
  const effects=[card.techniqueEffect?.kind,card.onEntry?.kind];
  const targeted=effects.some(k=>['stunEnemy','stasisEnemy','silence','bind'].includes(k||''));
  const healing=effects.some(k=>k==='cleanse');
  const targets=healing?allies:enemy;
  const targetIds=targeted||healing?targets.map(u=>u.objectId):[undefined];
  const discardIndices=card.techniqueEffect?.kind==='reanimate'?[...p.discard.map((c,i)=>c.kind==='creature'?i:-1).filter(i=>i>=0)]:[undefined];
  for(const targetId of targetIds)for(const discardIndex of discardIndices){
   const args={type,handIndex,...(targetId!==undefined?{targetId}:{}),...(discardIndex!==undefined?{discardIndex}:{})};
   const cmd=attempt(args);if(cmd)return cmd;
   // Duplicate-name rules and full zones may ask which object to retain/displace.
   for(const keepExisting of [true,false]){
    const duplicate=attempt({...args,keepExisting});if(duplicate)return duplicate;
   }
  }
 }
 if(p.hand.length<=3&&knowledge.deckSize>=2&&p.hp>2&&p.lastRulerDrawTurn!==g.turn&&
    (p.hp>=12||enemy.reduce((sum,c)=>sum+(c.card.attack||0),0)<p.hp-5)&&
    expectedDrawStrength(knowledge,starter)>2){
  const cmd=attempt({type:'rulerDraw'});if(cmd)return cmd;
 }
 for(const l of p.legends){
  if(l.lastActivatedTurn===g.turn)continue;
  const abilities=l.card.loyaltyAbilities|| (l.card.loyaltyAbility?[l.card.loyaltyAbility]:[]);
  const discardIndex=p.discard.findIndex(c=>c.kind==='creature');
  for(const abilityIndex of [1,0]){
   const ability=abilities[abilityIndex];if(!ability)continue;
   const cmd=attempt({type:'activateLegend',objectId:l.objectId,abilityIndex,...(ability.kind==='recoverCreature'?{discardIndex}:{})});
   if(cmd)return cmd;
  }
 }
 // Declare separate legal attacks, prioritizing a lethal ruler hit; otherwise remove dangerous defenders.
 for(const u of [...p.main,...p.auxiliary].filter(u=>u.card.kind==='creature').sort((a,b)=>(b.card.attack||0)-(a.card.attack||0))){
  const targets= (u.card.attack||0)>=opp.hp?[{kind:'player'}]:[...enemy.filter(v=>(u.card.attack||0)>=(v.card.health||0)).map(v=>({kind:'creature',objectId:v.objectId})),{kind:'player'}];
  for(const target of targets){const cmd=attempt({type:'attack',attackerId:u.objectId,target});if(cmd)return cmd;}
 }
 return attempt({type:'endTurn'});
}
