/** Cross-mechanic invariants: printed data and runtime statuses are separate layers.
 * Pure behavioral checks deliberately do not assume all pairwise combos are balanced.
 */
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {initialGame,player,apply,type Card,type Permanent,type Command} from '../src/core.ts';
import {starter as neutralStarter} from '../src/cards/neutral/index.ts';
import {registeredTraits} from '../src/mechanics/trait-registry.ts';
import {registeredEffects} from '../src/mechanics/effects-registry.ts';
import {ability} from '../src/mechanics/abilities.ts';
import {canGuardIntercept} from '../src/mechanics/traits/guard.ts';
import {canInterceptFlyingAttack} from '../src/mechanics/traits/flying.ts';
import {canSelectAsAttackTarget} from '../src/mechanics/traits/stealth.ts';
import {strikeOrder} from '../src/mechanics/traits/firstStrike.ts';
import {hasImmediateAttack} from '../src/mechanics/traits/haste.ts';
import {hasCreatureOnlyImmediateAttack} from '../src/mechanics/traits/zeal.ts';
import {canAttackAgain} from '../src/mechanics/traits/extraAttacks.ts';
import {healFromLifesteal} from '../src/mechanics/traits/lifesteal.ts';
import {applyPoisonFromHit} from '../src/mechanics/traits/poisonHit.ts';
import {absorbShield} from '../src/mechanics/traits/shield.ts';
import {mayChooseEffectTarget} from '../src/mechanics/traits/majestic.ts';
import {tickStatusesAtTurnStart} from '../src/mechanics/statuses.ts';
import {eligibleVictims} from '../src/ritual.ts';

const make=(id:number,patch:Partial<Card>={},runtime:Partial<Permanent>={}):Permanent=>({
 objectId:id,
 card:{id:'interaction-'+id,name:'Interaction '+id,kind:'creature',attack:2,health:15,...patch},
 damage:0,shield:0,exhausted:false,enteredTurn:0,interceptions:0,...runtime
});

test('neutral starting deck has exactly 2 distinct Majestic creatures / 4 copies, unchanged deck size',()=>{
 assert.equal(neutralStarter.reduce((total,row)=>total+row.copies,0),70);
 const majestic=neutralStarter.filter(entry=>entry.card.kind==='creature'&&entry.card.majestic);
 assert.deepEqual(majestic.map(row=>[row.card.name,row.copies]).sort(),[
  ['Последний часовой',2],['Страж архивов',2]
 ]);
 assert.equal(majestic.reduce((total,row)=>total+row.copies,0),4);
 assert.ok(registeredTraits().includes('majestic'));
 assert.ok(registeredEffects('death').includes('death:damageAllCreatures'));
});

test('silence and stasis suppress registered active traits, but not printed Majestic target restriction',()=>{
 const p=make(1,{
  guard:true,flying:true,firstStrike:true,lifesteal:true,poisonHit:{strength:2,ticks:3},
  haste:true,zeal:true,stealth:true,extraAttacks:1,majestic:true
 });
 const traits=['guard','flying','firstStrike','lifesteal','poisonHit','haste','zeal','stealth','extraAttacks'] as const;
 for(const trait of traits)assert.ok(ability(p,trait),trait);
 assert.equal(mayChooseEffectTarget(p),false);
 for(const mode of ['silenced','stasis'] as const) {
  const suppressed=structuredClone(p);
  if(mode==='silenced')suppressed.silenced=true;
  else suppressed.stasis=1;
  for(const trait of traits)assert.equal(ability(suppressed,trait),undefined,mode+': '+trait);
  assert.equal(mayChooseEffectTarget(suppressed),false,'Printed Majestic must not become selectable by targeted effects');
 }
 assert.equal(mayChooseEffectTarget(make(2)),true);
});

test('Guard + Flying checks both sides and can be suppressed independently',()=>{
 const flyingAttacker=make(1,{flying:true});
 const guard=make(2,{guard:true});
 assert.equal(canGuardIntercept(guard),true);
 assert.equal(canInterceptFlyingAttack(flyingAttacker,guard),false);
 const wingedGuard=make(3,{guard:true,flying:true});
 assert.equal(canGuardIntercept(wingedGuard),true);
 assert.equal(canInterceptFlyingAttack(flyingAttacker,wingedGuard),true);
 wingedGuard.stasis=1;
 assert.equal(canGuardIntercept(wingedGuard),false);
 assert.equal(canInterceptFlyingAttack(flyingAttacker,wingedGuard),false);
 flyingAttacker.silenced=true;
 assert.equal(canInterceptFlyingAttack(flyingAttacker,guard),true);
});

test('Stealth only stops declared creature attacks; Majestic does not',()=>{
 const stealth=make(1,{stealth:true});
 const majestic=make(2,{majestic:true});
 assert.equal(canSelectAsAttackTarget(stealth),false);
 assert.equal(canSelectAsAttackTarget(majestic),true);
 stealth.silenced=true;
 assert.equal(canSelectAsAttackTarget(stealth),true);
 assert.equal(mayChooseEffectTarget(majestic),false);
});

test('Haste, Zeal, Extra Attacks and First Strike are independent checks',()=>{
 const zeal=make(1,{zeal:true});
 assert.equal(hasImmediateAttack(zeal),false);
 assert.equal(hasCreatureOnlyImmediateAttack(zeal,'creature'),true);
 assert.equal(hasCreatureOnlyImmediateAttack(zeal,'player'),false);
 const haste=make(2,{haste:true,extraAttacks:1,firstStrike:true});
 assert.equal(hasImmediateAttack(haste),true);
 assert.equal(canAttackAgain({...haste,attacksMade:1}),true);
 assert.equal(canAttackAgain({...haste,attacksMade:2}),false);
 assert.equal(strikeOrder(haste,make(3)),'attacker');
 assert.equal(strikeOrder(haste,make(4,{firstStrike:true})),'simultaneous');
 assert.equal(strikeOrder(make(3),haste),'defender');
 haste.silenced=true;
 assert.equal(hasImmediateAttack(haste),false);
 assert.equal(canAttackAgain({...haste,attacksMade:1}),false);
});

test('Shield + Lifesteal + combat poison respect actual dealt damage and suppression',()=>{
 const source=make(1,{lifesteal:true,poisonHit:{strength:2,ticks:3}});
 const target=make(2,{}, {shield:3});
 const owner=player();owner.hp=20;
 const absorbed=absorbShield(target,2);
 assert.equal(absorbed,0);
 assert.equal(target.shield,1);
 assert.equal(owner.hp,20);
 // Poison is an on-hit effect, only dispatched from combat.ts on positive damage.
 const dealt=absorbShield(target,4);
 assert.equal(dealt,3);
 healFromLifesteal(owner,source,dealt);
 assert.equal(owner.hp,23);
 applyPoisonFromHit(target,source);
 assert.deepEqual(target.poison,{strength:2,ticks:3});
 const weak=make(3,{poisonHit:{strength:1,ticks:5}});
 applyPoisonFromHit(target,weak);
 assert.equal(target.poison?.strength,2,'Poison replacement prioritizes strength');
 source.silenced=true;
 const other=make(4);
 applyPoisonFromHit(other,source);
 assert.equal(other.poison,undefined);
 healFromLifesteal(owner,source,2);
 assert.equal(owner.hp,23);
});

test('Poison ticks through shield after Stasis pauses it, independent of printed Majestic',()=>{
 const p=player();
 p.main=[make(1,{majestic:true}, {poison:{strength:2,ticks:2},stasis:1,shield:1})];
 tickStatusesAtTurnStart(p);
 assert.equal(p.main[0].damage,0);
 assert.equal(p.main[0].poison?.ticks,2);
 p.main[0].stasis=undefined;
 tickStatusesAtTurnStart(p);
 assert.equal(p.main[0].damage,1);
 assert.equal(p.main[0].shield,0);
 assert.equal(p.main[0].poison?.ticks,1);
 tickStatusesAtTurnStart(p);
 assert.equal(p.main[0].damage,3);
 assert.equal(p.main[0].poison,undefined);
});

test('Ritual sacrifice excludes majestic, stunned and stasis creatures in both zones',()=>{
 const p=player();
 p.main=[make(1,{majestic:true,sacrifice:true},{sacrifice:true}),make(2,{sacrifice:true},{sacrifice:true}),
   make(3,{sacrifice:true},{sacrifice:true,stunned:true})];
 p.auxiliary=[make(4,{createdToken:true,sacrifice:true},{sacrifice:true,stasis:1}),
  make(5,{createdToken:true,sacrifice:true},{sacrifice:true})];
 assert.deepEqual(eligibleVictims(p,'neutral').map(u=>u.objectId),[2,5]);
});

test('Majestic remains vulnerable to non-targeted AoE, random selection and creature attack',async()=>{
 const {invokeEffect}=await import('../src/mechanics/effects-registry.ts');
 const {damage}=await import('../src/mechanics/combat.ts');
 const {nextRandom}=await import('../src/ritual.ts');
 const g=initialGame(player(),player());g.turn=1;
 g.players[0].main=[make(1,{attack:2,health:20})];
 g.players[1].main=[make(2,{majestic:true,health:20})];
 const starter=apply(g,{type:'attack',actor:0,attackerId:1,target:{kind:'creature',objectId:2},
  expectedRevision:g.revision,key:'maj-matrix-attack'} as Command);
 const combat=apply(starter,{type:'intercept',actor:1,interceptorId:null,
  expectedRevision:starter.revision,key:'maj-matrix-resolve'} as Command);
 assert.equal(combat.players[1].main[0].damage,2);
 invokeEffect('death','damageAllCreatures',{game:combat,actor:0,source:g.players[0].main[0].card,amount:2});
 assert.equal(combat.players[1].main[0].damage,4);
 const pool=[combat.players[1].main[0],combat.players[0].main[0]];
 let seed=1;while(nextRandom(seed,2).value!==0&&seed<100)seed++;
 assert.ok(seed<100);
 damage(pool[nextRandom(seed,2).value],1);
 assert.equal(combat.players[1].main[0].damage,5,'Random damage selection must keep Majestic eligible');
});
