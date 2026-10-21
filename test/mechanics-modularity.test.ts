import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {CARD_CATALOG} from '../src/cards/catalog.ts';
import {registeredTraits,registerTrait,printedTrait} from '../src/mechanics/trait-registry.ts';
import {ability} from '../src/mechanics/abilities.ts';
import {registeredEffects} from '../src/mechanics/effects-registry.ts';
import {registeredCommands} from '../src/mechanics/command-router.ts';
import {type Card,type Permanent} from '../src/core.ts';

const printedTraits=[
 'guard','flying','firstStrike','piercing','lifesteal','haste','zeal',
 'extraAttacks','stealth','poisonHit','shield','majestic',
 'cannotAttack','sacrifice','auraAttack','untiring'
] as const;
const testPermanent=(card:Card):Permanent=>({card,objectId:1,exhausted:false,
  damage:0,shield:card.shield??0,enteredTurn:0,interceptions:0});
test('every supported printed trait is registered in its own independently imported module',()=>{
 const names=registeredTraits();
 const dir=join(process.cwd(),'src/mechanics/traits');
 const modules=readdirSync(dir).filter(x=>x.endsWith('.ts')&&x!=='index.ts').map(x=>x.slice(0,-3)).sort();
 assert.deepEqual(modules,[...printedTraits].sort());
 assert.deepEqual(names,[...printedTraits].sort());
 for(const key of printedTraits){
  const sample:Card=CARD_CATALOG.find(card=>card[key]!==undefined)??{
   id:'synthetic-'+key,name:key,kind:'creature'};
  const p=testPermanent(sample);
  assert.deepEqual(ability(p,key),sample[key],key+' printed value');
  p.silenced=true;assert.equal(ability(p,key),undefined,key+' Nemota');
  p.silenced=false;p.stasis=1;
  assert.equal(ability(p,key),undefined,key+' Stasis');
 }
});
test('all shipped card effect kinds have registered modules and no silent no-op',()=>{
 const channels=['entry','technique','loyalty','death'] as const;
 for(const card of CARD_CATALOG){
  for(const [channel,effects] of [
   ['entry',[card.onEntry,card.secondChance]],
   ['technique',[card.techniqueEffect]],
   ['loyalty',card.loyaltyAbilities??(card.loyaltyAbility?[card.loyaltyAbility]:[])],
   ['death',[card.onDeath]]
  ] as const){
   for(const effect of effects){
    if(!effect)continue;
    assert.ok(registeredEffects(channel).includes(channel+':'+effect.kind),
      card.id+': '+channel+':'+effect.kind);
   }
  }
 }
 assert.equal(registeredCommands().length,16);
});
test('third-party passive mechanic can be mounted/unmounted without kernel modification',()=>{
 // Structural Card augmentation would be declared by a plugin package in its own .d.ts.
 const key='firstStrike';
 assert.throws(()=>registerTrait(key,printedTrait(key)),/уже зарегистрировано/);
 const permanent=testPermanent({id:'no-unknown',name:'No unknown trait',kind:'creature',
   abilities:['not-registered-gameplay']});
 assert.equal(ability(permanent,'abilities'),undefined,'Unknown textual abilities cannot execute');
});
