import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
import {initialGame,player,type Card,type Permanent} from '../src/core.ts';
import {registeredTraits} from '../src/mechanics/trait-registry.ts';
import {registeredEffects} from '../src/mechanics/effects-registry.ts';
import {isValidAmount,requireRule} from '../src/mechanics/rules/validation.ts';
import {isTraitSuppressed} from '../src/mechanics/rules/suppression.ts';
import {eligibleChosenTargets,requireChosenTarget} from '../src/mechanics/rules/targets.ts';
import {canDeclareAttack,isInterceptorReady} from '../src/mechanics/rules/combat-eligibility.ts';
import {findNamedConflict,isDisplaceable,findDisplaceable} from '../src/mechanics/rules/placement.ts';

const registry=JSON.parse(readFileSync(new URL('../docs/mechanics-registry.json',import.meta.url),'utf8'));
const make=(id:number,props:Partial<Card>={},state:Partial<Permanent>={}):Permanent=>({
 objectId:id,card:{id:'mechanic-'+id,name:'Creature '+id,kind:'creature',attack:2,health:5,...props},
 exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:0,...state
});

test('canonical registry maps 100% of enabled trait and effect modules, and planned rules are explicit',()=>{
 assert.equal(registry.schemaVersion,2);
 const traitKeys=registry.mechanics.filter((m:any)=>m.type==='trait').map((m:any)=>m.kind).sort();
 const effectKeys=registry.mechanics.filter((m:any)=>m.type==='effect').map((m:any)=>m.kind).sort();
 assert.deepEqual(traitKeys,registeredTraits());
 assert.deepEqual(effectKeys,[...new Set(registeredEffects().map(s=>s.split(':')[1]))].sort());
 for(const row of registry.mechanics){
  assert.ok(row.interactionPolicy&&row.ruleModule,'Missing interaction metadata: '+row.kind);
  assert.ok(existsSync(row.ruleModule),'Missing owning module: '+row.kind);
  assert.ok(row.interactionPolicy.interactions.length>0,'Mechanic has no interaction policy: '+row.kind);
  if(row.type==='trait') {
   assert.equal(typeof row.interactionPolicy.suppressible,'boolean',row.kind);
   assert.ok(row.interactionPolicy.behavior,row.kind);
  }else assert.ok(row.interactionPolicy.target,row.kind);
 }
 assert.equal(registry.mechanics.filter((r:any)=>!r.implemented).length,1);
 assert.equal(registry.mechanics.find((r:any)=>r.kind==='ward').implemented,false);
 assert.equal(registry.plannedMechanics.find((r:any)=>r.key==='ward').state,'registered-blocked');
 assert.equal(new Set(registry.crossRules.map((r:any)=>r.id)).size,registry.crossRules.length);
 for(const relation of registry.crossRules){
  assert.ok(relation.subject&&relation.with&&relation.rule,'Incomplete rule '+relation.id);
  assert.ok(existsSync(relation.test),'Missing evidence test '+relation.id);
 }
 for(const [name,def] of Object.entries(registry.statusPolicies) as [string,any][]){
  assert.ok(existsSync(def.owner),name+' has no owning source');
  assert.ok(def.effects?.length&&def.duration,'Missing status contract '+name);
 }
});

test('shared validators preserve bounds, errors and printed source invariants',()=>{
 for(const value of [0,1,8])assert.equal(isValidAmount(value),true);
 for(const value of [-1,9,1.1,NaN,Infinity,undefined,'2'])assert.equal(isValidAmount(value),false);
 assert.equal(isValidAmount(4,4),true);
 assert.equal(isValidAmount(5,4),false);
 assert.throws(()=>requireRule(false,'Тестовое правило'),/Тестовое правило/);
 const creature=make(1,{cannotAttack:true});
 assert.equal(isTraitSuppressed(creature),false);
 creature.silenced=true;assert.equal(isTraitSuppressed(creature),true);
 creature.silenced=false;creature.stasis=1;assert.equal(isTraitSuppressed(creature),true);
});

test('one explicit-target gate handles friendly/enemy, Legends, statuses and Majestic',()=>{
 const g=initialGame(player(),player());g.turn=2;
 g.players[0].main=[make(1,{majestic:true}),make(2)];
 g.players[0].legends=[make(3,{kind:'legend'})];
 g.players[1].main=[make(4,{majestic:true}),make(5,{}, {stunned:true}),make(6,{}, {stasis:1}),make(7)];
 assert.deepEqual(eligibleChosenTargets(g,0,{side:'enemy',creaturesOnly:true}).map(u=>u.objectId),[5,6,7]);
 assert.deepEqual(eligibleChosenTargets(g,0,{side:'enemy',creaturesOnly:true,unstunned:true,unstasis:true}).map(u=>u.objectId),[7]);
 assert.deepEqual(eligibleChosenTargets(g,0,{side:'own'}).map(u=>u.objectId),[2]);
 assert.deepEqual(eligibleChosenTargets(g,0,{side:'own',includeLegends:true}).map(u=>u.objectId),[2,3]);
 assert.equal(requireChosenTarget(g,0,7,{side:'enemy'}).objectId,7);
 assert.throws(()=>requireChosenTarget(g,0,4,{side:'enemy'}),/Выберите допустимое Существо/);
 assert.throws(()=>requireChosenTarget(g,0,3,{side:'enemy'}),/Выберите допустимое Существо/);
 assert.equal(g.players[1].main[0].card.majestic,true,'Selector must not mutate printed traits');
});

test('combat readiness separates suppressible Cannot Attack and hard action blockers',()=>{
 const unit=make(1,{cannotAttack:true},{enteredTurn:1});
 assert.equal(canDeclareAttack(unit,2,'player'),false);
 unit.silenced=true;
 assert.equal(canDeclareAttack(unit,2,'player'),true,'Nemota removes Cannot Attack');
 unit.stunned=true;assert.equal(canDeclareAttack(unit,2,'player'),false);
 unit.stunned=false;unit.stasis=1;assert.equal(canDeclareAttack(unit,2,'player'),false);
 unit.stasis=undefined;unit.exhausted=true;assert.equal(canDeclareAttack(unit,2,'player'),false);
 unit.exhausted=false;unit.enteredTurn=2;assert.equal(canDeclareAttack(unit,2,'player'),false);
 unit.enteredTurn=1;unit.interceptions=0;assert.equal(isInterceptorReady(unit),true);
 unit.interceptions=1;assert.equal(isInterceptorReady(unit),false);
});

test('shared placement rule respects Majestic and existing Unique identity',()=>{
 const majestic=make(1,{majestic:true,name:'Twin'});
 const ordinary=make(2,{name:'Twin'});
 assert.equal(findNamedConflict([majestic,ordinary],ordinary),majestic);
 assert.equal(isDisplaceable(majestic),false);
 assert.equal(isDisplaceable(ordinary),true);
 assert.equal(findDisplaceable([majestic,ordinary],1),undefined);
 assert.equal(findDisplaceable([majestic,ordinary],2),ordinary);
});

test('effect sources do not reintroduce duplicated validation or private manual-target checks',()=>{
 const directory=join(process.cwd(),'src/mechanics/effects');
 const files=readdirSync(directory).filter(p=>p.endsWith('.ts')&&p!=='index.ts');
 for(const name of files){
  const code=readFileSync(join(directory,name),'utf8');
  assert.ok(!code.includes('const valid=(amount:number'),'Duplicate number validator: '+name);
  assert.ok(!code.includes('function requireRule('),'Duplicate effect assertion: '+name);
 }
 for(const name of ['bind','cleanse','silence','ward','stunEnemy','stasisEnemy']){
  const code=readFileSync(join(directory,name+'.ts'),'utf8');
  assert.ok(code.includes('rules/targets.ts'),'Manual targeting bypass in '+name);
 }
});
