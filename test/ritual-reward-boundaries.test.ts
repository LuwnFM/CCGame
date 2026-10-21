import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {apply,initialGame,player,type Card,type Game,type Permanent} from '../src/core.ts';
import ritual from '../src/cards/violet/techniques/vt-ritual.ts';
import {nextRandom,offerRewards} from '../src/ritual.ts';

const pool=ritual.ritual.rewardPool as [Card,Card,Card,Card,Card];
const byId=(id:string)=>pool.find(c=>c.id===id)!;
function unit(id:number,majestic=false,createdToken=false):Permanent{
 const card:Card={id:'occupant-'+id,name:'Occupant '+id,kind:'creature',attack:1,health:2,majestic,createdToken};
 return {objectId:id,card,exhausted:false,damage:0,shield:0,enteredTurn:1,interceptions:0};
}
function prepared(rewardId:string):Game{
 const game=initialGame(player(),player());
 game.turn=1;game.phase='reward';game.active=0;game.seed=123456789;game.nextObjectId=100;
 game.pendingReward={owner:0,offeredIds:[rewardId, ...pool.filter(c=>c.id!==rewardId).slice(0,2).map(c=>c.id)],pool};
 return game;
}
function choose(g:Game,rewardId:string,replaceId?:number):Game{
 return apply(g,{type:'chooseReward',actor:0,rewardId,replaceId,expectedRevision:g.revision,key:'reward-'+g.revision});
}
test('ritual card defines exactly five distinct rewards and deterministic three-of-five offers',()=>{
 assert.equal(pool.length,5);assert.equal(new Set(pool.map(c=>c.id)).size,5);
 assert.deepEqual(pool.map(c=>[c.attack,c.health]),[[4,4],[5,3],[3,6],[4,4],[3,3]]);
 assert.deepEqual(pool.filter(c=>c.createdToken).map(c=>c.id),['vt-spark']);
 const offered=offerRewards(pool,123456789);
 assert.equal(offered.ids.length,3);assert.equal(new Set(offered.ids).size,3);
 assert.deepEqual(offered,offerRewards(pool,123456789));
 assert.ok(offered.ids.every(id=>pool.some(c=>c.id===id)));
});
test('selected normal reward enters main, selected created token enters auxiliary',()=>{
 for(const id of ['vt-echo','vt-spark']){
  const g=prepared(id);const after=choose(g,id);
  const zone=byId(id).createdToken?'auxiliary':'main';
  assert.equal(after.players[0][zone].length,1);
  assert.equal(after.players[0][zone][0].card.id,id);
  assert.equal(after.players[0][zone][0].ritualReward,true);
  assert.equal(after.pendingReward,null);assert.equal(after.phase,'main');
  assert.equal(g.players[0][zone].length,0,'transaction leaves original game unchanged');
 }
});
test('full main replaces chosen non-Majestic with death and no reroll',()=>{
 const g=prepared('vt-echo');g.players[0].main=Array.from({length:8},(_,i)=>unit(i+1));
 const after=choose(g,'vt-echo',1);
 assert.equal(after.players[0].main.length,8);
 assert.equal(after.players[0].main.at(-1)?.card.id,'vt-echo');
 assert.equal(after.seed,g.seed,'replacement does not roll again');
 assert.equal(after.players[0].hand.length,0);
 assert.equal(after.players[0].discard.length,1);
});
test('full auxiliary displaces a token without treating departure as death',()=>{
 const g=prepared('vt-spark');g.players[0].auxiliary=Array.from({length:4},(_,i)=>unit(i+1,false,true));
 const after=choose(g,'vt-spark',1);
 assert.equal(after.players[0].auxiliary.length,4);
 assert.equal(after.players[0].auxiliary.at(-1)?.card.id,'vt-spark');
 assert.equal(after.players[0].discard.length,0);
 assert.equal(after.players[0].erased.length,1);
 assert.equal(after.seed,g.seed);
});
test('all-Majestic main fallback rerolls from five into hand deterministically',()=>{
 const g=prepared('vt-echo');g.players[0].main=Array.from({length:8},(_,i)=>unit(i+1,true));
 const roll=nextRandom(g.seed!,5);const expected=pool[roll.value].id;
 const after=choose(g,'vt-echo');
 assert.equal(after.players[0].main.length,8);
 assert.equal(after.players[0].hand.length,1);
 assert.equal(after.players[0].hand[0].id,expected);
 assert.deepEqual(after.players[0].hand[0].cost,{colored:{},generic:0});
 assert.equal(after.seed,roll.seed);
});
test('all-Majestic auxiliary fallback also may put any of five rewards into hand',()=>{
 const g=prepared('vt-spark');g.players[0].auxiliary=Array.from({length:4},(_,i)=>unit(i+1,true,true));
 const roll=nextRandom(g.seed!,5);
 const after=choose(g,'vt-spark');
 assert.equal(after.players[0].auxiliary.length,4);
 assert.equal(after.players[0].hand[0].id,pool[roll.value].id);
 assert.equal(after.seed,roll.seed);
});
test('unoffered reward and incorrect replacement reject without game mutation',()=>{
 const g=prepared('vt-echo');g.pendingReward!.offeredIds=['vt-echo'];
 const before=structuredClone(g);
 assert.throws(()=>choose(g,'vt-spark'),/Награда не предложена/);
 assert.deepEqual(g,before);
 g.players[0].main=Array.from({length:8},(_,i)=>unit(i+1));
 const unchanged=structuredClone(g);
 assert.throws(()=>choose(g,'vt-echo',999),/Выберите заменяемое Существо/);
 assert.deepEqual(g,unchanged);
});
