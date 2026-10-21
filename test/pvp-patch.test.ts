import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { apply, initialGame, player, type Card, type Command, type Game, type Permanent } from '../src/core.ts';
import { applyForMatch } from '../src/server.ts';
import { initialGame as legacyGame, player as legacyPlayer } from '../src/legacy/core-v0.9.13.ts';

const red: Card = {id:'red-land',name:'Тестовое красное Владение',kind:'domain',produces:'red',basic:true};
const neutral: Card = {id:'neutral-land',name:'Тестовое нейтральное Владение',kind:'domain',produces:'neutral',basic:true};
const creature: Card = {id:'unit',name:'Существо',kind:'creature',cost:{generic:2,colored:{red:1}},attack:2,health:3};
function act(g:Game,command:Omit<Command,'key'|'expectedRevision'>,key:string):Game{
 return apply(g,{...command,expectedRevision:g.revision,key} as Command);
}
function perm(id:number,card:Card,shield=0):Permanent {
 return {objectId:id,card,shield,damage:0,exhausted:false,interceptions:0,enteredTurn:0};
}
function fight(attacker:Card,defender:Card,shield=0):Game {
 let g=initialGame(player(),player());g.turn=7;
 g.players[0].main=[perm(1,attacker)];
 g.players[1].main=[perm(2,defender,shield)];
 g=act(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}},'attack');
 return act(g,{type:'intercept',actor:1,interceptorId:2},'block');
}
test('First Strike: attacker kills defender before defender retaliates',()=>{
 const g=fight({id:'a',name:'Ранний атакующий',kind:'creature',attack:3,health:2,firstStrike:true},
 {id:'d',name:'Защитник',kind:'creature',attack:5,health:2});
 assert.equal(g.players[0].main[0].damage,0);
 assert.equal(g.players[1].main.length,0);
 assert.equal(g.players[1].hp,30);
});
test('First Strike: defender kills attacker before attacker hits',()=>{
 const g=fight({id:'a',name:'Атакующий',kind:'creature',attack:5,health:2},
 {id:'d',name:'Ранний защитник',kind:'creature',attack:3,health:2,firstStrike:true});
 assert.equal(g.players[0].main.length,0);
 assert.equal(g.players[1].main[0].damage,0);
});
test('First Strike on BOTH creatures: simultaneous early damage',()=>{
 const g=fight({id:'a',name:'Атака',kind:'creature',attack:3,health:3,firstStrike:true},
 {id:'d',name:'Защита',kind:'creature',attack:3,health:3,firstStrike:true});
 assert.equal(g.players[0].main.length,0);
 assert.equal(g.players[1].main.length,0);
});
test('First Strike shield can prevent lethal damage; survivor retaliates',()=>{
 const g=fight({id:'a',name:'Ранний',kind:'creature',attack:3,health:4,firstStrike:true},
 {id:'d',name:'Щитовой',kind:'creature',attack:2,health:3},1);
 assert.equal(g.players[1].main[0].shield,0);
 assert.equal(g.players[1].main[0].damage,2);
 assert.equal(g.players[0].main[0].damage,2);
});
test('auto-pay exhausts exactly necessary domains and reserves color requirements',()=>{
 let g=initialGame(player([],[creature]),player());g.turn=3;
 g.players[0].domains=[perm(1,red),perm(2,neutral),perm(3,neutral),perm(4,red)];
 g=act(g,{type:'playCreature',actor:0,handIndex:0},'auto-pay');
 assert.equal(g.players[0].main.length,1);
 assert.equal(g.players[0].domains.filter(d=>d.exhausted).length,3);
 assert.equal(g.players[0].domains[3].exhausted,false);
 assert.deepEqual(g.players[0].energy,{red:0,blue:0,green:0,gold:0,violet:0,neutral:0});
});
test('failed automatic payment rolls back energy and domains',()=>{
 let g=initialGame(player([],[creature]),player());g.turn=3;
 g.players[0].domains=[perm(1,neutral),perm(2,neutral),perm(3,neutral)];
 assert.throws(()=>act(g,{type:'playCreature',actor:0,handIndex:0},'wrong-color'),/цветной/);
 assert.equal(g.players[0].domains.filter(d=>d.exhausted).length,0);
 assert.equal(g.players[0].hand.length,1);
});
test('Legends: weak +1 loyalty and stronger -2 are mutually exclusive per turn',()=>{
 const legend:Card={id:'legend',name:'Проверочная Легенда',kind:'legend',loyalty:3,
   cost:{generic:0,colored:{}},loyaltyAbility:{delta:-2,kind:'damageOpponent',amount:2},
   loyaltyAbilities:[{delta:1,kind:'healRuler',amount:1},{delta:-2,kind:'damageOpponent',amount:2}]};
 let g=initialGame(player([],[legend]),player());g.turn=1;g.players[0].hp=29;
 g=act(g,{type:'playLegend',actor:0,handIndex:0},'legend-enter');
 g=act(g,{type:'activateLegend',actor:0,objectId:1,abilityIndex:0},'loyalty-plus');
 assert.equal(g.players[0].legends[0].loyalty,4);
 assert.equal(g.players[0].hp,30);
 assert.throws(()=>act(g,{type:'activateLegend',actor:0,objectId:1,abilityIndex:1},'duplicate'),/недоступна/);
 g=act(g,{type:'endTurn',actor:0},'turn-end');
 g=act(g,{type:'endTurn',actor:1},'turn-else');
 g=act(g,{type:'activateLegend',actor:0,objectId:1,abilityIndex:1},'loyalty-minus');
 assert.equal(g.players[0].legends[0].loyalty,2);
 assert.equal(g.players[1].hp,28);
});
test('old games keep frozen core and original version while new games use updated core',()=>{
 const old=legacyGame(legacyPlayer(),legacyPlayer());
 const newer=initialGame(player(),player());
 assert.equal(old.rulesVersion,'0.9.13-alpha');
 assert.equal(newer.rulesVersion,'0.9.14-alpha');
 const cmd={type:'startTurn',actor:0,expectedRevision:old.revision,key:'legacy-start'} as Command;
 const continued=applyForMatch(old as any,cmd);
 assert.equal(continued.rulesVersion,'0.9.13-alpha');
 assert.equal(continued.turn,1);
});


test('First Strike combines Shield, Piercing and Lifesteal without a dead defender reply',()=>{
 let g=initialGame(player(),player());g.turn=7;g.players[0].hp=20;
 g.players[0].main=[perm(1,{id:'a',name:'Attacker',kind:'creature',attack:5,health:2,firstStrike:true,piercing:true,lifesteal:true,poisonHit:{strength:1,ticks:2}})];
 g.players[1].main=[perm(2,{id:'d',name:'Defender',kind:'creature',attack:9,health:2},1)];
 g=act(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}},'strike');
 g=act(g,{type:'intercept',actor:1,interceptorId:2},'intercept');
 assert.equal(g.players[0].main[0].damage,0);assert.equal(g.players[1].main.length,0);
 assert.equal(g.players[1].hp,28);assert.equal(g.players[0].hp,24);
});
