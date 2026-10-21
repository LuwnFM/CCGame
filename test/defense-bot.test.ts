import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {initialGame,player,type Card,type Permanent} from '../src/core.ts';
import {chooseDefensiveInterceptor} from '../src/bots/defense.ts';
const c=(id:string,attack:number,health:number,extra:Partial<Card>={}):Card=>({id,name:id,kind:'creature',attack,health,...extra});
const u=(id:number,card:Card):Permanent=>({objectId:id,card,damage:0,shield:card.shield??0,exhausted:false,interceptions:0,enteredTurn:1});
test('defense AI blocks lethal attack with available Guard',()=>{
 const g=initialGame(player(),player());g.phase='intercept';g.active=0;g.players[1].hp=3;
 g.players[0].main=[u(1,c('attacker',5,3))];
 g.players[1].main=[u(2,c('guardian',1,5,{guard:true}))];
 g.pendingAttack={attackerId:1,defender:1,target:{kind:'player'}};
 assert.equal(chooseDefensiveInterceptor(g),2);
});
test('defense AI refuses illegal ground block against Flying',()=>{
 const g=initialGame(player(),player());g.phase='intercept';g.active=0;g.players[1].hp=1;
 g.players[0].main=[u(1,c('flying',5,2,{flying:true}))];
 g.players[1].main=[u(2,c('ground',2,2,{guard:true}))];
 g.pendingAttack={attackerId:1,defender:1,target:{kind:'player'}};
 assert.equal(chooseDefensiveInterceptor(g),null);
});
test('defense AI saves valuable creature from otherwise unblocked targeted attack',()=>{
 const g=initialGame(player(),player());g.phase='intercept';g.active=0;
 g.players[0].main=[u(1,c('attacker',5,5))];
 g.players[1].main=[u(2,c('target',5,2)),u(3,c('guardian',1,7,{guard:true,shield:2}))];
 g.pendingAttack={attackerId:1,defender:1,target:{kind:'creature',objectId:2}};
 assert.equal(chooseDefensiveInterceptor(g),3);
});
