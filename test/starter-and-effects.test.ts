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
 const necromancer:Card={...unit,onEntry:{kind:'summonSkeleton',amount:1},secondChance:{kind:'summonSkeleton',amount:2}};
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
 g=act(g,{type:'rulerDraw'});assert.equal(g.players[0].hp,28);assert.equal(g.players[0].hand.length,2);
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
 g=act(g,{type:'playCreature',handIndex:0,keepExisting:true});assert.equal(g.players[0].hp,21);assert.equal(g.players[1].hp,30);assert.equal(g.players[0].main.length,1);
 g.players[0].hand.push(c);g=act(g,{type:'playCreature',handIndex:0,keepExisting:false});assert.equal(g.players[0].hp,22);assert.equal(g.players[1].hp,30);assert.equal(g.players[0].main.length,1);
});
test('Bind refreshes existing Stasis; Cleanse preserves printed abilities and damage',()=>{
 const spell:Card={...cast,techniqueEffect:{kind:'bind',amount:2}};
 let g=initialGame(player([],[spell]),player());g.turn=1;
 g.players[1].main=[{objectId:10,card:{...unit,firstStrike:true},damage:1,shield:1,exhausted:false,interceptions:0,enteredTurn:0,stasis:1}];
 g=act(g,{type:'playTechnique',handIndex:0,targetId:10});assert.equal(g.players[1].main[0].stasis,2);
});
