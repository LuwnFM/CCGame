import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {apply,initialGame,player,RuleError,type Card,type Command,type Game} from '../src/core.ts';
import {moveCard,drawCards,leaveCard,movePermanent,placePermanent,takePermanent} from '../src/mechanics/zones.ts';
import {registeredEffects,registerEffect,invokeEffect} from '../src/mechanics/effects-registry.ts';
import {emitGameEvent,onGameEvent} from '../src/mechanics/events.ts';
const card=(id:string,extra:Partial<Card>={}):Card=>({id,name:id,kind:'creature',attack:1,health:2,...extra});
const step=(g:Game,command:object):Game=>apply(g,{actor:0,expectedRevision:g.revision,key:'z-'+g.revision,...command} as Command);
test('shared zone primitives handle hand/deck/graveyard/erasure with identity preservation',()=>{
 const p=player([card('one'),card('two')],[card('three')]);
 assert.equal(drawCards(p,2),2);
 assert.deepEqual(p.hand.map(x=>x.id),['three','one','two']);
 assert.equal(p.deck.length,0);
 moveCard(p,'hand','discard',0);
 assert.deepEqual(p.discard.map(x=>x.id),['three']);
 const ghost=card('token',{createdToken:true});
 p.hand.push(ghost);
 moveCard(p,'hand','discard',2);
 assert.deepEqual(p.erased.map(x=>x.id),['token']);
 assert.equal(p.discard.length,1);
 assert.throws(()=>moveCard(p,'erased','hand',0),RuleError);
 assert.throws(()=>moveCard(p,'deck','hand',0),RuleError);
 assert.equal(leaveCard(p,card('reward',{ritualReward:true})),'erased');
 assert.equal(drawCards(p,2),0);
});
test('shared board movement validates capacities and retains object identities',()=>{
 const g=initialGame(player(),player());g.turn=1;
 const first=placePermanent(g,0,'main',card('a'));
 assert.equal(first.objectId,1);
 movePermanent(g,0,'main','auxiliary',first.objectId);
 assert.equal(g.players[0].main.length,0);
 assert.equal(g.players[0].auxiliary[0].objectId,first.objectId);
 const taken=takePermanent(g,0,first.objectId);
 assert.equal(taken.card.id,'a');
 assert.equal(g.players[0].auxiliary.length,0);
 assert.throws(()=>takePermanent(g,0,first.objectId),RuleError);
 for(let i=0;i<4;i++)placePermanent(g,0,'auxiliary',card('token-'+i));
 assert.throws(()=>placePermanent(g,0,'auxiliary',card('overflow')),RuleError);
 const current=g.players[0].main.length;
 assert.throws(()=>movePermanent(g,0,'main','auxiliary',900),RuleError);
 assert.equal(g.players[0].main.length,current);
});
test('effects are registered by channel, unknown effects fail transactionally',()=>{
 for(const [channel,kind] of [['entry','summon'],['entry','stunEnemy'],['entry','draw'],
 ['technique','reanimate'],['technique','cleanse'],['loyalty','summon'],['death','damageAllCreatures']] as const)
  assert.ok(registeredEffects(channel).includes(channel+':'+kind),channel+':'+kind);
 const c=card('unknown',{onEntry:{kind:'nonexistent-registry-id' as any,amount:1}});
 const g=initialGame(player([],[c]),player());g.turn=1;
 const old=structuredClone(g);
 assert.throws(()=>step(g,{type:'playCreature',handIndex:0}),/Неизвестный эффект/);
 assert.deepEqual(g,old);
 assert.throws(()=>registerEffect('entry','draw',()=>{}),/зарегистрирован/);
});
test('event dispatcher resolves nested signals FIFO and never serializes its queue',()=>{
 const order:string[]=[];
 const stopA=onGameEvent('turnStart',(g,e)=>{
  order.push('start');emitGameEvent(g,{type:'turnEnd',owner:e.owner});
 });
 const stopB=onGameEvent('turnEnd',()=>order.push('end'));
 try{
  const game=initialGame(player(),player());
  emitGameEvent(game,{type:'turnStart',owner:0});
  assert.deepEqual(order,['start','end']);
  assert.equal(Object.prototype.hasOwnProperty.call(game,'effectEvents'),false);
  assert.equal(JSON.stringify(game).includes('effectEvents'),false);
 }finally{stopA();stopB();}
});
test('death queue handles card departure and Last Word via registry',()=>{
 const dead=card('bomb',{onDeath:{kind:'damageOpponent',amount:2}});
 const g=initialGame(player(),player());g.turn=1;
 placePermanent(g,0,'main',dead,{damage:2,exhausted:false});
 const after=step(g,{type:'endTurn'});
 assert.equal(after.players[1].hp,28);
 assert.deepEqual(after.players[0].discard.map(c=>c.id),['bomb']);
});
