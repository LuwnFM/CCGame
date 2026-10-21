import {apply,RuleError,type Command,type Game} from '../core.ts';
import {chooseDefensiveInterceptor} from './defense.ts';

/** Server-side test opponent, always seat 1. Executes the same validated commands as a human. */
export function chooseBotCommand(g:Game):Command|null {
 const actor=1;
 if(g.phase==='finished'||g.phase==='paused')return null;
 if(g.phase==='main'&&g.active!==actor)return null;
 if(g.phase==='intercept'&&g.pendingAttack?.defender!==actor)return null;
 const p=g.players[actor],opp=g.players[0];
 const attempt=(cmd:Record<string,unknown>):Command|null=>{
  const action={...cmd,actor,expectedRevision:g.revision,key:'tester-bot-'+g.revision} as Command;
  try {apply(g,action);return action;}catch(e){if(e instanceof RuleError)return null;throw e;}
 };
 if(g.phase==='mulligan')return g.mulliganReady?.[actor]?null:attempt({type:'mulligan',indices:[]});
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
 const choices=p.hand.map((card,handIndex)=>({card,handIndex})).filter(x=>x.card.kind!=='domain')
  .sort((a,b)=>{
   const score=(x:typeof a)=>(x.card.ritual?30:0)+(x.card.kind==='creature'?20:0)+(x.card.kind==='legend'?13:0)+(x.card.kind==='artifact'?12:0)+(x.card.kind==='technique'?8:0)+(x.card.sacrifice?4:0)+(x.card.attack||0)*0.6+(x.card.health||0)*0.2;
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
 if(p.hand.length<=3&&p.deck.length>=2&&p.hp>8&&p.lastRulerDrawTurn!==g.turn){
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
