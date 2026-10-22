// Deterministic smoke evaluation: each starter faces a simple fixed baseline.
// Results catch stalls and gross regressions; they are not a balance rating.
import {apply,openingGame} from '../src/core.ts';
import {openingHand} from '../src/setup.ts';
import {testDeck} from '../src/decks.ts';
import {chooseBotCommand} from '../src/bots/opponent.ts';
import {chooseDefensiveInterceptor} from '../src/bots/defense.ts';

const decks=['red','blue','green','gold','violet','neutral'];
let serial=0;
function act(g,actor,type,extra={}){
 const cmd={...extra,type,actor,expectedRevision:g.revision,key:`eval-${serial++}`};
 try{return apply(g,cmd);}catch{return null;}
}
const cardCost=c=>(c.cost?.generic||0)+Object.values(c.cost?.colored||{}).reduce((n,v)=>n+(v||0),0);
function simple(g){
 const p=g.players[0];
 if(g.phase==='mulligan')return act(g,0,'mulligan',{indices:p.hand.map((c,i)=>({c,i})).filter(x=>x.c.kind!=='domain'&&cardCost(x.c)>=5).map(x=>x.i).slice(0,3)});
 if(g.phase==='intercept')return act(g,0,'intercept',{interceptorId:chooseDefensiveInterceptor(g)});
 if(g.phase==='discard')return act(g,0,'discard',{handIndex:p.hand.findIndex(c=>c.kind!=='domain')<0?0:p.hand.findIndex(c=>c.kind!=='domain')});
 if(g.phase==='ritual'){
  const r=g.readyRituals?.[0];return r&&act(g,0,'chooseRitual',{effectId:r.effect.id,objectIds:r.eligibleIds.slice(0,r.effect.threshold)});
 }
 if(g.phase==='reward'){
  const r=g.pendingReward;if(!r)return null;
  const offers=r.pool.filter(c=>r.offeredIds.includes(c.id)).sort((a,b)=>(b.attack||0)*2+(b.health||0)-(a.attack||0)*2-(a.health||0));
  for(const c of offers){const zone=c.createdToken?p.auxiliary:p.main;for(const replaceId of [undefined,...zone.filter(u=>!u.card.majestic).map(u=>u.objectId)]){
   const next=act(g,0,'chooseReward',{rewardId:c.id,...(replaceId===undefined?{}:{replaceId})});if(next)return next;
  }}return null;
 }
 if(g.phase!=='main'||g.active!==0)return null;
 if(p.domainsPlayed<1){const i=p.hand.findIndex(c=>c.kind==='domain');if(i>=0)return act(g,0,'playDomain',{handIndex:i});}
 const d=p.domains.find(x=>!x.exhausted);if(d)return act(g,0,'tapDomain',{objectId:d.objectId});
 const cards=p.hand.map((c,i)=>({c,i})).filter(x=>x.c.kind!=='domain').sort((a,b)=>(b.c.attack||0)+(b.c.health||0)-(a.c.attack||0)-(a.c.health||0));
 for(const {c,i} of cards){const type=({creature:'playCreature',technique:'playTechnique',legend:'playLegend',artifact:'playArtifact'})[c.kind];if(!type)continue;
  for(const keepExisting of [undefined,true,false]){const next=act(g,0,type,{handIndex:i,...(keepExisting===undefined?{}:{keepExisting})});if(next)return next;}}
 if(p.hand.length<=3&&p.hp>18&&p.deck.length>=2&&p.lastRulerDrawTurn!==g.turn){const next=act(g,0,'rulerDraw');if(next)return next;}
 for(const u of [...p.main,...p.auxiliary].filter(x=>x.card.kind==='creature'&&!x.exhausted&&!x.stunned&&!x.stasis)){
  const target= g.players[1].main.find(e=>e.card.kind==='creature'&&(u.card.attack||0)>=(e.card.health||0));
  const next=act(g,0,'attack',{attackerId:u.objectId,target:target?{kind:'creature',objectId:target.objectId}:{kind:'player'}});if(next)return next;
 }
 return act(g,0,'endTurn');
}
function isBotMove(g){return g.phase==='main'&&g.active===1||g.phase==='intercept'&&g.pendingAttack?.defender===1||g.phase==='mulligan'&&!g.mulliganReady?.[1]||['ritual','reward','discard'].includes(g.phase)&&g.active===1;}
function play(deckId,index){
 const botDeck=decks[(index+2)%decks.length],seed=20261022+index*101;
 let g=openingGame(openingHand(testDeck(deckId),seed),openingHand(testDeck(botDeck),seed+987654));
 let botActions=0,humanActions=0,steps=0;
 while(!g.winner&&!['paused','finished'].includes(g.phase)&&steps++<2500){
  if(isBotMove(g)){
   const c=chooseBotCommand(g,botDeck);if(!c)throw new Error(`BOT_STALL ${deckId} ${g.phase} t${g.turn}`);
   const next=apply(g,c);if(next.revision===g.revision)throw new Error('BOT_NO_PROGRESS');g=next;botActions++;
  }else{
   const next=simple(g);if(!next)throw new Error(`PLAYER_STALL ${deckId} ${g.phase} t${g.turn}`);
   g=next;humanActions++;
  }
 }
 return {deckId,botDeck,winner:g.winner,phase:g.phase,turn:g.turn,hp:[g.players[0].hp,g.players[1].hp],botActions,humanActions,steps};
}
for(let i=0;i<decks.length;i++)console.log(JSON.stringify(play(decks[i],i)));
