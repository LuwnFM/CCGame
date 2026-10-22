import test from 'node:test';
import assert from 'node:assert/strict';
import {initialGame,player,type Card,type Game,type Permanent} from '../src/core.ts';
import {chooseBotCommand} from '../src/bots/opponent.ts';

const token:Card={id:'test-scout',name:'Тестовый разведчик',kind:'creature',aspects:['red'],attack:1,health:1,createdToken:true,haste:true};
function fixture():Game {
 const game=initialGame(player(),player());
 game.turn=3;game.active=1;game.phase='main';game.winner=null;
 return game;
}
function unit(card:Card,objectId:number,extra:Partial<Permanent>={}):Permanent {
 return {objectId,card,exhausted:false,damage:0,shield:0,enteredTurn:0,interceptions:0,...extra};
}

test('at full health the bot summons with a positive loyalty ability instead of wasting loyalty on healing',()=>{
 const game=fixture();
 game.players[1].legends.push(unit({id:'legend',name:'Легенда',kind:'legend',loyalty:4,loyaltyAbilities:[
  {delta:1,kind:'summon',cards:[token]},
  {delta:-2,kind:'healRuler',amount:4},
 ]},1,{loyalty:4}));
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'activateLegend');
 if(command?.type==='activateLegend')assert.equal(command.abilityIndex,0);
});

test('at critical health the bot values useful healing over the summon',()=>{
 const game=fixture();game.players[1].hp=10;
 game.players[1].legends.push(unit({id:'legend',name:'Легенда',kind:'legend',loyalty:4,loyaltyAbilities:[
  {delta:1,kind:'summon',cards:[token]},
  {delta:-2,kind:'healRuler',amount:4},
 ]},1,{loyalty:4}));
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'activateLegend');
 if(command?.type==='activateLegend')assert.equal(command.abilityIndex,1);
});

test('the bot attacks a vulnerable enemy Legend when that is more valuable than face damage',()=>{
 const game=fixture();
 game.players[1].main.push(unit({id:'attacker',name:'Атакующий',kind:'creature',attack:2,health:3},1));
 game.players[0].legends.push(unit({id:'legend',name:'Легенда',kind:'legend',loyalty:1},2,{loyalty:1}));
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'attack');
 if(command?.type==='attack')assert.deepEqual(command.target,{kind:'legend',objectId:2});
});

test('the bot keeps a combined lethal attack instead of trading the first attacker into a creature',()=>{
 const game=fixture();game.players[0].hp=6;
 game.players[0].main.push(unit({id:'bait',name:'Приманка',kind:'creature',attack:0,health:3},3));
 game.players[1].main.push(
  unit({id:'a',name:'Боец A',kind:'creature',attack:3,health:3},1),
  unit({id:'b',name:'Боец B',kind:'creature',attack:3,health:3},2),
 );
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'attack');
 if(command?.type==='attack')assert.deepEqual(command.target,{kind:'player'});
});

test('the bot selects the least valuable eligible sacrifice for a ritual',()=>{
 const game=fixture();game.phase='ritual';
 const weak=unit({id:'weak',name:'Слабая жертва',kind:'creature',aspects:['red'],attack:1,health:1},1,{sacrifice:true});
 const strong=unit({id:'strong',name:'Сильная жертва',kind:'creature',aspects:['red'],attack:5,health:5},2,{sacrifice:true});
 game.players[1].main.push(strong,weak);
 const rewardPool=Array.from({length:5},(_,i)=>({id:`reward-${i}`,name:`Награда ${i}`,kind:'creature' as const,attack:3,health:3}));
 const effect={id:'ritual',color:'red' as const,threshold:1,rewardPool:rewardPool as [Card,Card,Card,Card,Card],requiresSource:false};
 game.readyRituals=[{effect,eligibleIds:[2,1]}];
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'chooseRitual');
 if(command?.type==='chooseRitual')assert.deepEqual(command.objectIds,[1]);
});

test('the bot uses a targeted control technique on a stronger enemy over a weak vanilla creature',()=>{
 const game=fixture();
 game.players[1].energy.red=1;
 game.players[1].hand=[
  {id:'small',name:'Малое существо',kind:'creature',cost:{colored:{},generic:0},attack:1,health:1},
  {id:'bind',name:'Связать',kind:'technique',cost:{colored:{red:1},generic:0},techniqueEffect:{kind:'bind',amount:1}},
 ];
 game.players[0].main.push(unit({id:'threat',name:'Угроза',kind:'creature',attack:7,health:7},3));
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'playTechnique');
});

test('the bot plans two efficient plays instead of spending all energy on one large creature',()=>{
 const game=fixture();game.players[1].energy.neutral=4;
 game.players[1].hand=[
  {id:'large',name:'Крупное существо',kind:'creature',cost:{colored:{},generic:4},attack:4,health:4},
  {id:'small-a',name:'Малое существо A',kind:'creature',cost:{colored:{},generic:2},attack:2,health:3},
  {id:'small-b',name:'Малое существо B',kind:'creature',cost:{colored:{},generic:2},attack:2,health:3},
 ];
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'playCreature');
 if(command?.type==='playCreature')assert.notEqual(game.players[1].hand[command.handIndex]?.id,'large');
});

test('the bot keeps an early domain when forced to discard',()=>{
 const game=fixture();game.phase='discard';
 game.players[1].hand=[
  {id:'early-domain',name:'Раннее владение',kind:'domain',produces:'red',basic:true},
  ...Array.from({length:8},(_,i)=>({id:`weak-${i}`,name:`Существо ${i}`,kind:'creature' as const,attack:1,health:1})),
 ];
 const command=chooseBotCommand(game,'red');
 assert.equal(command?.type,'discard');
 if(command?.type==='discard')assert.notEqual(game.players[1].hand[command.handIndex]?.kind,'domain');
});
