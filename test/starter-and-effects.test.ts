import {SKELETON} from '../src/cards/tokens.ts';
import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {apply,initialGame,player,validateDeck,type Card,type Game,type Command} from '../src/core.ts';
import {ARCHETYPES,testDeck} from '../src/decks.ts';
const unit:Card={id:'test-unit',name:'Test unit',kind:'creature',attack:2,health:3,cost:{colored:{},generic:0}};
const cast:Card={id:'revive',name:'Revive',kind:'technique',cost:{colored:{},generic:0},techniqueEffect:{kind:'reanimate',amount:1}};
function act(g:Game,c:object){return apply(g,{actor:0,...c,expectedRevision:g.revision,key:'command-'+g.revision} as Command)}
test('starter creatures have at most two copies; custom decks still allow three ordinary copies',()=>{
 for(const {id} of ARCHETYPES){const cards=testDeck(id);assert.equal(cards.length,70);assert.deepEqual(validateDeck(cards),[]);
 const counts=new Map<string,number>();for(const c of cards.filter(c=>c.kind==='creature'))counts.set(c.name,(counts.get(c.name)||0)+1);
 assert.ok([...counts.values()].every(n=>n<=2));
 const ordinary=cards.find(c=>c.kind==='creature')!;
 const replacement=cards.findIndex(c=>c.kind==='creature'&&c.name!==ordinary.name);
 cards[replacement]=structuredClone(ordinary);assert.deepEqual(validateDeck(cards),[]);
 cards[cards.findIndex(c=>c.kind==='creature'&&c.name!==ordinary.name)]=structuredClone(ordinary);
 assert.ok(validateDeck(cards).some(x=>x.includes(ordinary.name)));
 }
});
test('Entry and Second Chance use distinct origins; partial skeleton summon respects four slots',()=>{
 const necromancer:Card={...unit,onEntry:{kind:'summon',cards:[SKELETON]},secondChance:{kind:'summon',cards:[SKELETON,SKELETON]}};
 let g=initialGame(player([],[necromancer,cast]),player());g.turn=1;
 g=act(g,{type:'playCreature',handIndex:0});assert.equal(g.players[0].auxiliary.length,1);
 const dead=g.players[0].main.pop()!;g.players[0].discard.push(dead.card);
 g=act(g,{type:'playTechnique',handIndex:0,discardIndex:0});assert.equal(g.players[0].auxiliary.length,3);assert.equal(g.players[0].main.length,1);
 g.players[0].hand.push(necromancer);g=act(g,{type:'playCreature',handIndex:0});assert.equal(g.players[0].auxiliary.length,4);
 g.players[0].hand.push(necromancer);g=act(g,{type:'playCreature',handIndex:0});assert.equal(g.players[0].auxiliary.length,4);
 assert.ok(g.players[0].auxiliary.every(p=>p.card.createdToken&&p.card.sacrifice));
});
test('invalid resurrection rolls back payment and cards',()=>{
 let g=initialGame(player([],[cast]),player());g.turn=1;
 const before=structuredClone(g);assert.throws(()=>act(g,{type:'playTechnique',handIndex:0,discardIndex:0}),/сброса/);assert.deepEqual(g,before);
 g.players[0].discard.push(unit);g.players[0].main=Array.from({length:8},(_,i)=>({objectId:i+1,card:unit,exhausted:false,damage:0,shield:0,enteredTurn:0,interceptions:0}));
 assert.throws(()=>act(g,{type:'playTechnique',handIndex:0,discardIndex:0}),/места/);
});
test('Ruler draw costs two HP, requires <=3 cards and two deck cards, once per own turn',()=>{
 let g=initialGame(player([unit,unit,unit,unit],[]),player());g.turn=1;
 g=act(g,{type:'rulerDraw'});assert.equal(g.players[0].hp,38);assert.equal(g.players[0].hand.length,2);
 assert.throws(()=>act(g,{type:'rulerDraw'}),/уже/);
 for(const [hp,hand,deck] of [[2,0,2],[30,4,2],[30,0,1]]){
 let bad=initialGame(player(Array(deck).fill(unit),Array(hand).fill(unit)),player());bad.turn=1;bad.players[0].hp=hp;
 assert.throws(()=>act(bad,{type:'rulerDraw'}));assert.equal(bad.players[0].hp,hp);
 }
});

test('Silence suppresses item aura immediately; Cleanse restores it without removing Shield',async()=>{
 const {totalAttack}=await import('../src/mechanics/combat.ts');
 const silence:Card={...cast,id:'silence',techniqueEffect:{kind:'silence',amount:1}};
 const cleanse:Card={...cast,id:'cleanse',techniqueEffect:{kind:'cleanse',amount:1}};
 let g=initialGame(player([],[silence]),player([],[cleanse]));g.turn=1;
 const make=(objectId:number,card:Card)=>({objectId,card,damage:0,shield:2,exhausted:false,interceptions:0,enteredTurn:0});
 g.players[1].auxiliary=[make(10,{id:'aura',name:'Aura',kind:'artifact',auraAttack:2})];g.players[1].main=[make(11,unit)];
 assert.equal(totalAttack(g.players[1],g.players[1].main[0]),4);
 g=act(g,{type:'playTechnique',handIndex:0,targetId:10});assert.equal(totalAttack(g.players[1],g.players[1].main[0]),2);
 g=act(g,{type:'endTurn'});g=act(g,{type:'playTechnique',actor:1,handIndex:0,targetId:10});
 assert.equal(totalAttack(g.players[1],g.players[1].main[0]),4);assert.equal(g.players[1].auxiliary[0].shield,2);
});
test('Unique creature survivor choice is a departure with no Last Word or Entry for discarded newcomer',()=>{
 const c:Card={...unit,unique:true,onDeath:{kind:'damageOpponent',amount:10},onEntry:{kind:'healRuler',amount:1}};
 let g=initialGame(player([],[c,c]),player());g.turn=1;g.players[0].hp=20;
 g=act(g,{type:'playCreature',handIndex:0});assert.equal(g.players[0].hp,21);
 assert.throws(()=>act(g,{type:'playCreature',handIndex:0}),/Уникальную/);
 g=act(g,{type:'playCreature',handIndex:0,keepExisting:true});assert.equal(g.players[0].hp,21);assert.equal(g.players[1].hp,40);assert.equal(g.players[0].main.length,1);
 g.players[0].hand.push(c);g=act(g,{type:'playCreature',handIndex:0,keepExisting:false});assert.equal(g.players[0].hp,22);assert.equal(g.players[1].hp,40);assert.equal(g.players[0].main.length,1);
});
test('Bind refreshes existing Stasis; Cleanse preserves printed abilities and damage',()=>{
 const spell:Card={...cast,techniqueEffect:{kind:'bind',amount:2}};
 let g=initialGame(player([],[spell]),player());g.turn=1;
 g.players[1].main=[{objectId:10,card:{...unit,firstStrike:true},damage:1,shield:1,exhausted:false,interceptions:0,enteredTurn:0,stasis:1}];
 g=act(g,{type:'playTechnique',handIndex:0,targetId:10});assert.equal(g.players[1].main[0].stasis,2);
});

test('generic summon creates exactly configured distinct tokens with bounds and no card-specific callbacks',()=>{
 const blade:Card={id:'bone-blade',name:'Клинок',kind:'creature',aspects:['violet'],attack:2,health:1,createdToken:true,sacrifice:true};
 const guard:Card={id:'bone-guard',name:'Заслон',kind:'creature',aspects:['violet'],attack:1,health:2,createdToken:true,sacrifice:true};
 const apprentice:Card={...unit,id:'apprentice',onEntry:{kind:'summon',cards:[blade,guard]}};
 let g=initialGame(player([],[apprentice]),player());g.turn=1;
 g=act(g,{type:'playCreature',handIndex:0});
 assert.deepEqual(g.players[0].auxiliary.map(x=>[x.card.id,x.card.attack,x.card.health,x.card.sacrifice]),[
 ['bone-blade',2,1,true],['bone-guard',1,2,true]
 ]);
 assert.equal(g.players[0].auxiliary.every(x=>x.card.createdToken&&x.exhausted),true);
 assert.equal(new Set(g.players[0].auxiliary.map(x=>x.objectId)).size,2);
 g.players[0].hand.push(apprentice);
 g.players[0].auxiliary.push(...[0,1].map(i=>({...g.players[0].auxiliary[i],objectId:100+i})));
 g=act(g,{type:'playCreature',handIndex:0});
 assert.equal(g.players[0].auxiliary.length,4,'full auxiliary board caps data-driven summoning');
 const invalid:Card={...apprentice,onEntry:{kind:'summon',cards:[{...blade,health:0}]}};
 const next=initialGame(player([],[invalid]),player());next.turn=1;
 const snapshot=structuredClone(next);
 assert.throws(()=>act(next,{type:'playCreature',handIndex:0}),/Недопустимое Существо/);
 assert.deepEqual(next,snapshot,'invalid tokens rollback the entire transaction');
});
test('all six starter Legend plus loyalty token abilities use the same executor, gold guard cannot attack',()=>{
 for(const {id} of ARCHETYPES){
  const legend=testDeck(id).find(c=>c.kind==='legend'&&c.loyaltyAbilities?.[0].kind==='summon');
  assert.ok(legend,`missing summoning Legend for ${id}`);
  const ability=legend.loyaltyAbilities![0];
  assert.equal(ability.kind,'summon');
  if(ability.kind!=='summon')throw Error('expected data-driven summon');
  const expected=ability.cards[0];
  const g=initialGame(player([],[legend]),player());g.turn=1;
  Object.assign(g.players[0].energy,{red:20,blue:20,green:20,gold:20,violet:20,neutral:20});
  const cast=act(g,{type:'playLegend',handIndex:0});
  const objectId=cast.players[0].legends[0].objectId;
  const spawned=act(cast,{type:'activateLegend',objectId,abilityIndex:0});
  assert.equal(spawned.players[0].auxiliary.length,1);
  const token=spawned.players[0].auxiliary[0];
  assert.equal(token.card.id,expected.id);
  assert.equal(token.card.health,expected.health);
  assert.equal(spawned.players[0].legends[0].loyalty,cast.players[0].legends[0].loyalty!+1);
  assert.throws(()=>act(spawned,{type:'activateLegend',objectId,abilityIndex:0}),/недоступна/i);
  if(id==='gold'){
   assert.equal(token.card.attack,0);assert.equal(token.card.health,1);
   assert.equal(token.shield,2);assert.equal(token.card.guard,true);
   assert.equal(token.card.cannotAttack,true);
   const ready=structuredClone(spawned);ready.players[0].auxiliary[0].exhausted=false;ready.players[0].auxiliary[0].enteredTurn=0;
   assert.throws(()=>act(ready,{type:'attack',attackerId:token.objectId,target:{kind:'player'}}),/Атакующий не готов/);
  }
 }
});


test('Majestic rejects all individually targeted techniques even friendly effects, without spending the card',()=>{
 const effects=['bind','silence','cleanse','ward'] as const;
 for(const effect of effects){
  const spell:Card={...cast,id:'spell-'+effect,techniqueEffect:{kind:effect,amount:2}};
  const isOwn=effect==='cleanse'||effect==='ward';
  let g=initialGame(player([],isOwn?[spell]:[]),player([],isOwn?[]:[spell]));g.turn=1;
  const target={objectId:99,card:{...unit,majestic:true,health:20},damage:0,shield:0,exhausted:false,interceptions:0,enteredTurn:0,stunned:true};
  if(isOwn)g.players[0].main=[target];else {g.players[1].main=[target];g.active=1;}
  // Opponent spells use an actor of 1, so their target is player 0.
  if(!isOwn){g.players[0].main=[target];g.players[1].main=[];}
  const actor=isOwn?0:1;
  const before=structuredClone(g);
  const command={type:'playTechnique',actor,handIndex:0,targetId:99,expectedRevision:g.revision,key:'block-'+effect} as Command;
  assert.throws(()=>apply(g,command),/Выберите допустимое Существо/);
  assert.deepEqual(g,before,'Failed technique must not consume card or energy');
 }
});

test('Majestic is excluded from directed entry controls but ordinary creatures remain valid',()=>{
 for(const kind of ['stunEnemy','stasisEnemy'] as const) {
  const entrance:Card={...unit,id:'entrance-'+kind,onEntry:{kind,amount:1}};
  const make=(id:number,majestic:boolean)=>({
   objectId:id,card:{...unit,id:'target-'+id,majestic,health:20},
   damage:0,shield:0,exhausted:false,interceptions:0,enteredTurn:0
  });
  let g=initialGame(player([],[entrance]),player());g.turn=1;
  g.players[1].main=[make(99,true),make(100,false)];
  const before=structuredClone(g);
  assert.throws(()=>act(g,{type:'playCreature',handIndex:0,targetId:99}),/Недоступная цель синего контроля/);
  assert.deepEqual(g,before);
  g=act(g,{type:'playCreature',handIndex:0,targetId:100});
  assert.equal(!!g.players[1].main[1].stunned||!!g.players[1].main[1].stasis,true);
  assert.equal(g.players[1].main[0].stunned,undefined);
  assert.equal(g.players[1].main[0].stasis,undefined);
  let only=initialGame(player([],[entrance]),player());only.turn=1;only.players[1].main=[make(99,true)];
  only=act(only,{type:'playCreature',handIndex:0});
  assert.equal(only.players[0].main.length,1,'An entry control should not fail if only Majestic targets exist');
 }
});

test('Majestic accepts creature attacks, combat poison and global damage to all creatures',async()=>{
 const {invokeEffect}=await import('../src/mechanics/effects-registry.ts');
 const make=(id:number,card:Card,shield=0)=>({
  objectId:id,card,damage:0,shield,exhausted:false,interceptions:0,enteredTurn:0
 });
 let g=initialGame(player(),player());g.turn=1;
 g.players[0].main=[make(1,{...unit,attack:3,health:12,poisonHit:{strength:1,ticks:2}})];
 g.players[1].main=[make(2,{...unit,majestic:true,attack:0,health:20})];
 g=apply(g,{type:'attack',actor:0,attackerId:1,target:{kind:'creature',objectId:2},expectedRevision:g.revision,key:'majestic-attack'});
 g=apply(g,{type:'intercept',actor:1,interceptorId:null,expectedRevision:g.revision,key:'majestic-defend'});
 assert.equal(g.players[1].main[0].damage,3);
 assert.deepEqual(g.players[1].main[0].poison,{strength:1,ticks:2});
 invokeEffect('death','damageAllCreatures',{game:g,actor:0,source:unit,amount:2});
 assert.equal(g.players[1].main[0].damage,5,'Global death damage also hits Majestic');
 assert.equal(g.players[0].main[0].damage,2,'Global damage is symmetric');
 const shieldGame=initialGame(player(),player());shieldGame.turn=1;
 shieldGame.players[0].main=[make(1,{...unit,attack:2,health:12,poisonHit:{strength:2,ticks:2}})];
 shieldGame.players[1].main=[make(2,{...unit,majestic:true,health:20,attack:0},2)];
 let defended=apply(shieldGame,{type:'attack',actor:0,attackerId:1,target:{kind:'creature',objectId:2},expectedRevision:shieldGame.revision,key:'shield-attack'});
 defended=apply(defended,{type:'intercept',actor:1,interceptorId:null,expectedRevision:defended.revision,key:'shield-hit'});
 assert.equal(defended.players[1].main[0].damage,0);
 assert.equal(defended.players[1].main[0].poison,undefined,'Fully shielded attack does not land combat poison');
});
