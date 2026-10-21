import {test} from 'node:test';import {strict as assert} from 'node:assert';
import {apply,initialGame,player,type Card,type Permanent} from '../src/core.ts';
const card=(id:string,untiring:boolean):Card=>({id,name:id,kind:'creature',aspects:['gold'],attack:2,health:8,untiring});
function fixture(untiring:boolean){
 let g=initialGame(player(),player());g.turn=4;g.active=0;g.phase='main';
 g.players[0].main=[{objectId:1,card:card('tester',untiring),exhausted:false,damage:0,shield:0,enteredTurn:1,interceptions:0,attacksMade:0} as Permanent];
 return g;
}
function attack(g:ReturnType<typeof fixture>,key:string){return apply(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'},expectedRevision:g.revision,key})}
function intercept(g:ReturnType<typeof fixture>,key:string){return apply(g,{type:'intercept',actor:1,interceptorId:null,expectedRevision:g.revision,key})}
test('ordinary attacker exhausts, untiring attacker stays ready',()=>{
 for(const flag of [false,true]){
  const g=attack(fixture(flag),'attack');
  assert.equal(g.players[0].main[0].exhausted,!flag);
  const next=intercept(g,'intercept');
  assert.throws(()=>attack(next,'again'),/Атакующий не готов/);
 }
});
test('untiring keeps one attack even with a ready permanent; extraAttacks remains explicit',()=>{
 const g=fixture(true);g.players[0].main[0].card.extraAttacks=1;
 const once=intercept(attack(g,'a1'),'i1');
 const twice=intercept(attack(once,'a2'),'i2');
 assert.equal(twice.players[0].main[0].attacksMade,2);
 assert.throws(()=>attack(twice,'a3'),/Атакующий не готов/);
});
