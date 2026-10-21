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
