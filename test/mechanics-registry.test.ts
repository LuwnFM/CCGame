import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync,existsSync} from 'node:fs';
import {CARD_CATALOG} from '../src/cards/catalog.ts';
import {registeredEffects} from '../src/mechanics/effects-registry.ts';
import {registeredTraits} from '../src/mechanics/trait-registry.ts';

type RecordDef={kind:string;type:'effect'|'trait';channels:string[];implemented:boolean;ui:string;ru:string;en:string;params:string[];testIds:string[]};
const registry=JSON.parse(readFileSync(new URL('../docs/mechanics-registry.json',import.meta.url),'utf8')) as {mechanics:RecordDef[]};
test('mechanics inventory matches modules and runtime registrations',()=>{
 const seen=new Set<string>();
 const runtimeEffects=registeredEffects();
 const runtimeTraits=registeredTraits();
 for(const spec of registry.mechanics){
  const key=spec.type+':'+spec.kind;
  assert.ok(!seen.has(key),'duplicate registry entry '+key);seen.add(key);
  assert.ok(spec.ru&&spec.en&&spec.ui&&spec.testIds.length&&Array.isArray(spec.params),'incomplete metadata '+key);
  assert.ok(existsSync(new URL('../src/mechanics/'+(spec.type==='effect'?'effects':'traits')+'/'+spec.kind+'.ts',import.meta.url)), 'missing module '+key);
  if(spec.type==='trait')assert.ok(runtimeTraits.includes(spec.kind),'unregistered trait '+key);
  else for(const channel of spec.channels)assert.ok(runtimeEffects.includes(channel+':'+spec.kind),'unregistered effect '+channel+':'+spec.kind);
 }
 assert.deepEqual(runtimeTraits,registry.mechanics.filter(x=>x.type==='trait').map(x=>x.kind).sort());
 assert.deepEqual(runtimeEffects,registry.mechanics.filter(x=>x.type==='effect').flatMap(x=>x.channels.map(c=>c+':'+x.kind)).sort());
});
test('shipped cards cannot reference unimplemented or unknown effect kinds',()=>{
 const allowed=new Set(registry.mechanics.filter(x=>x.type==='effect'&&x.implemented).flatMap(x=>x.channels.map(c=>c+':'+x.kind)));
 for(const card of CARD_CATALOG){
  const pairs:[string,unknown][]=[
   ['entry',card.onEntry],['entry',card.secondChance],['technique',card.techniqueEffect],
   ['death',card.onDeath],...((card.loyaltyAbilities??(card.loyaltyAbility?[card.loyaltyAbility]:[])).map(x=>['loyalty',x] as [string,unknown]))
  ];
  for(const [channel,eff] of pairs){
   if(!eff)continue;
   const kind=(eff as {kind:string}).kind;
   assert.ok(allowed.has(channel+':'+kind),card.id+' uses unknown or nonfunctional effect '+channel+':'+kind);
  }
 }
});
