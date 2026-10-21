import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {apply,initialGame,player,RuleError,type Card,type Command,type Game} from '../src/core.ts';
import {registerEffect,registeredEffects} from '../src/mechanics/effects-registry.ts';
import {registerCommand,registeredCommands} from '../src/mechanics/command-router.ts';
import {registerCombatHook} from '../src/mechanics/combat-hooks.ts';
import {registerTrait,registeredTraits} from '../src/mechanics/trait-registry.ts';
import {ability} from '../src/mechanics/abilities.ts';
import {onGameEvent} from '../src/mechanics/events.ts';

/** This file is an actual third-party style module-augmentation test. Neither
 * core.ts nor command-registry.ts knows these names or imports this source. */
declare module '../src/mechanics/effect-contracts.ts' {
  interface EntryEffectSpecs {restorativePulse:{amount:number}}
}
declare module '../src/mechanics/command-contracts.ts' {
  interface CommandPayloads {playPulse:{amount:number}}
}
declare module '../src/core.ts' {
  interface Card {resilience?:number}
}
function command(g:Game,value:Omit<Command,'expectedRevision'|'key'>):Game{
  return apply(g,{...value,expectedRevision:g.revision,key:'plugin-'+g.revision} as Command);
}
test('new Entry mechanic is a data-only card plus one registered plugin handler',()=>{
 const stop=registerEffect('entry','restorativePulse',({game,actor,amount})=>{
   if(!Number.isSafeInteger(amount)||amount!<0||amount!>4)throw new RuleError('Неверный импульс');
   game.players[actor].hp=Math.min(30,game.players[actor].hp+amount!);
 });
 try{
  const card:Card={id:'test-restorative',name:'Модульная карта',kind:'creature',attack:1,health:2,
   cost:{colored:{},generic:0},resilience:1,onEntry:{kind:'restorativePulse',amount:2}};
  const g=initialGame(player([],[card]),player());g.turn=1;g.players[0].hp=15;
  const after=command(g,{type:'playCreature',actor:0,handIndex:0});
  assert.equal(after.players[0].hp,17);
  assert.equal(after.players[0].main[0].card.resilience,1);
  assert.ok(registeredEffects('entry').includes('entry:restorativePulse'));
 }finally{stop()}
 assert.ok(!registeredEffects('entry').includes('entry:restorativePulse'));
});
test('new command registers without editing core and preserves validation / idempotency',()=>{
 const stop=registerCommand('playPulse',(next,c)=>{
   if(!Number.isSafeInteger(c.amount)||c.amount<0)throw new RuleError('Неверное значение');
   next.players[c.actor].hp=Math.min(30,next.players[c.actor].hp+c.amount);
 });
 try{
  const g=initialGame(player(),player());g.turn=1;g.players[0].hp=18;
  const next=command(g,{type:'playPulse',actor:0,amount:2});
  assert.equal(next.players[0].hp,20);
  assert.equal(g.players[0].hp,18);
  const original=structuredClone(g);
  assert.throws(()=>command(g,{type:'playPulse',actor:0,amount:-1}),/Неверное значение/);
  assert.deepEqual(g,original);
  assert.ok(registeredCommands().includes('playPulse'));
 }finally{stop()}
 assert.ok(!registeredCommands().includes('playPulse'));
});
test('combat and turn lifecycle accept detachable feature hooks',()=>{
 let packets=0;
 const stopHit=registerCombatHook('afterAttackerHit','qa-tally',({dealt})=>{packets+=dealt});
 const seen:number[]=[];
 const stopTurn=onGameEvent('turnStart',(_,event)=>{seen.push(event.owner)});
 try{
  const attacker:Card={id:'a',name:'Атакующий',kind:'creature',attack:2,health:2};
  const g=initialGame(player(),player());g.turn=1;
  g.players[0].main.push({objectId:1,card:attacker,exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:0});
  let next=command(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}});
  next=command(next,{type:'intercept',actor:1,interceptorId:null});
  assert.equal(packets,2);
  assert.equal(next.players[1].hp,38);
  next=command(next,{type:'endTurn',actor:0});
  assert.deepEqual(seen,[1]);
 }finally{stopHit();stopTurn()}
});

test('new passive keyword needs just declaration augmentation and trait registration, not a kernel switch',()=>{
  const card:Card={id:'custom-resilience',name:'Защитник',kind:'creature',attack:1,health:2,resilience:3};
  const permanent={objectId:99,card,exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:1};
  assert.equal(ability(permanent,'resilience'),undefined,'Unregistered keyword must be inert');
  const stop=registerTrait('resilience',unit=>unit.card.resilience);
  try{
    assert.ok(registeredTraits().includes('resilience'));
    assert.equal(ability(permanent,'resilience'),3);
    permanent.silenced=true;
    assert.equal(ability(permanent,'resilience'),undefined,'Nemota suppresses custom traits');
    permanent.silenced=false;
    permanent.stasis=1;
    assert.equal(ability(permanent,'resilience'),undefined,'Stasis suppresses custom traits');
  }finally{stop()}
  assert.equal(ability(permanent,'resilience'),undefined,'Unload leaves no effect');
});
