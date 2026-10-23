import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { apply, initialGame, player, sendToDiscard, validateDeck, type Card, type Game, type Command } from '../src/core.ts';
import { payForCard } from '../src/mechanics/energy.ts';
const land: Card = { id: 'l', name: 'Базовое красное Владение', kind: 'domain', basic: true, produces: 'red' };
const creature: Card = { id: 'c', name: 'Ученик', kind: 'creature', cost: { colored: { red: 1 }, generic: 1 }, attack: 2, health: 2 };
function step(g: Game, command: Omit<Command, 'expectedRevision' | 'key'>, key: string): Game {
  return apply(g, { ...command, expectedRevision: g.revision, key } as Command);
}
test('first player skips draw, second draws; energy clears and domain refreshes', () => {
  let g = initialGame(player([land], [land]), player([creature], [land]));
  g = step(g, { type: 'startTurn', actor: 0 }, 'start');
  assert.equal(g.players[0].hand.length, 1);
  g = step(g, { type: 'playDomain', actor: 0, handIndex: 0 }, 'land');
  g = step(g, { type: 'tapDomain', actor: 0, objectId: 1 }, 'tap');
  g = step(g, { type: 'endTurn', actor: 0 }, 'end');
  assert.equal(g.players[0].energy.red, 0);
  assert.equal(g.players[1].hand.length, 2);
  g = step(g, { type: 'endTurn', actor: 1 }, 'end2');
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.players[0].domains[0].exhausted, false);
});
test('duplicate command is idempotent; stale revision and invalid action leave state intact', () => {
  let g = step(initialGame(player([], [land]), player()), { type: 'startTurn', actor: 0 }, 's');
  const cmd: Command = { type: 'playDomain', actor: 0, handIndex: 0, expectedRevision: g.revision, key: 'l' };
  g = apply(g, cmd);
  assert.equal(apply(g, cmd), g);
  assert.throws(() => apply(g, { ...cmd, type: 'endTurn' }), /Ключ команды/);
  assert.throws(() => apply(g, { ...cmd, key: 'l2' }), /ревизия/);
  assert.throws(() => step(g, { type: 'playDomain', actor: 0, handIndex: 0 }, 'bad'), /Владение уже/);
  assert.equal(g.players[0].domains.length, 1);
});
test('colored cost cannot be paid with neutral; failed payment does not mutate game', () => {
  const neutral: Card = { ...land, id: 'n', name: 'Нейтральное Владение', produces: 'neutral' };
  let g = step(initialGame(player([], [neutral, creature]), player()), { type: 'startTurn', actor: 0 }, 's');
  g = step(g, { type: 'playDomain', actor: 0, handIndex: 0 }, 'n');
  g = step(g, { type: 'tapDomain', actor: 0, objectId: 1 }, 'tap');
  assert.throws(() => step(g, { type: 'playCreature', actor: 0, handIndex: 0 }, 'c'), /цветной/);
  assert.equal(g.players[0].hand.length, 1);
  assert.equal(g.players[0].energy.neutral, 1);
});
test('automatic payment exhausts basic domains first; manual payment honors selected ids',()=>{
  const special={...land,id:'special',name:'Особое Владение',basic:false,produces:'red' as const};
  const owner=player();
  owner.domains.push(
    {objectId:1,card:special,exhausted:false,shield:0},
    {objectId:2,card:land,exhausted:false,shield:0}
  );
  const cost={colored:{red:1},generic:0};
  payForCard(owner,cost);
  assert.equal(owner.domains[0].exhausted,false);
  assert.equal(owner.domains[1].exhausted,true);
  const generic=player();
  generic.domains.push({objectId:4,card:{...special,produces:'neutral'},exhausted:false,shield:0},{objectId:5,card:land,exhausted:false,shield:0});
  payForCard(generic,{colored:{},generic:1});
  assert.equal(generic.domains[0].exhausted,false);
  assert.equal(generic.domains[1].exhausted,true);
  const manual=player();
  manual.domains.push({objectId:1,card:land,exhausted:false,shield:0},{objectId:2,card:special,exhausted:false,shield:0});
  payForCard(manual,cost,[2]);
  assert.equal(manual.domains[0].exhausted,false);
  assert.equal(manual.domains[1].exhausted,true);
  assert.throws(()=>payForCard(manual,cost,[3]),/недоступно/);
});
test('discard exactly down to 8 at end of turn', () => {
  let g = step(initialGame(player([], Array(10).fill(creature)), player()), { type: 'startTurn', actor: 0 }, 's');
  g = step(g, { type: 'endTurn', actor: 0 }, 'e');
  assert.equal(g.phase, 'discard');
  g = step(g, { type: 'discard', actor: 0, handIndex: 0 }, 'd1');
  g = step(g, { type: 'discard', actor: 0, handIndex: 0 }, 'd2');
  assert.equal(g.active, 1);
  assert.equal(g.players[0].hand.length, 8);
});
test('70 cards, 26 domains, basic colored domain and copy limits', () => {
  const deck = [...Array(26).fill(land), ...Array.from({ length: 44 }, (_, i) => ({ ...creature, id: `c${i}`, name: `Ученик ${i}` }))];
  assert.deepEqual(validateDeck(deck), []);
  assert.ok(validateDeck(Array(70).fill(creature)).length >= 2);
});
test('attack declaration waits for defender; Guard intercepts a creature attack', () => {
  const guard = { ...creature, id: 'g', name: 'Страж', guard: true, attack: 1, health: 3 };
  let g = step(initialGame(player([], []), player([], [])), { type: 'startTurn', actor: 0 }, 's');
  g.players[0].main.push({ objectId: 1, card: creature, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: 0 });
  g.players[1].main.push({ objectId: 2, card: creature, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: 0 });
  g.players[1].main.push({ objectId: 3, card: guard, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: 0 });
  g = step(g, { type: 'attack', actor: 0, attackerId: 1, target: { kind: 'creature', objectId: 2 } }, 'a');
  assert.equal(g.phase, 'intercept');
  assert.throws(() => step(g, { type: 'endTurn', actor: 0 }, 'e'), /Недоступная фаза/);
  g = step(g, { type: 'intercept', actor: 1, interceptorId: 3 }, 'i');
  assert.equal(g.phase, 'main');
  assert.equal(g.players[1].main.find(x => x.objectId === 2)?.damage, 0);
  assert.equal(g.players[1].main.find(x => x.objectId === 3)?.damage, 2);
  assert.equal(g.players[0].main.find(x => x.objectId === 1)?.damage, 1);
});
test('stunned but ready defender can intercept, Stasis cannot', () => {
  let g = step(initialGame(player(), player()), { type: 'startTurn', actor: 0 }, 'stun-start');
  const attacker = { objectId: 1, card: { ...creature, attack: 1 }, exhausted: false, damage: 0,
    shield: 0, interceptions: 0, enteredTurn: 0 };
  const blocker = { objectId: 2, card: { ...creature, attack: 0, health: 4 }, exhausted: false,
    damage: 0, shield: 0, interceptions: 0, enteredTurn: 0, stunned: true };
  g.players[0].main.push(attacker);
  g.players[1].main.push(blocker);
  g = step(g, { type: 'attack', actor: 0, attackerId: 1, target: { kind: 'player' } }, 'stun-attack');
  g = step(g, { type: 'intercept', actor: 1, interceptorId: 2 }, 'stun-intercept');
  assert.equal(g.players[1].hp, 40);
  assert.equal(g.players[1].main[0].interceptions, 1);
  const g2 = step(initialGame(player(), player()), { type: 'startTurn', actor: 0 }, 'stasis-start');
  g2.players[0].main.push({ ...attacker });
  g2.players[1].main.push({ ...blocker, stasis: 1, stunned: false });
  const pending = step(g2, { type: 'attack', actor: 0, attackerId: 1, target: { kind: 'player' } }, 'stasis-attack');
  assert.throws(() => step(pending, { type: 'intercept', actor: 1, interceptorId: 2 }, 'stasis-intercept'), /недоступен/);
});
test('shield absorbs damage and direct attack lowers ruler HP', () => {
  let g = step(initialGame(player(), player()), { type: 'startTurn', actor: 0 }, 's');
  g.players[0].main.push({ objectId: 1, card: creature, exhausted: false, damage: 0, shield: 1, interceptions: 0, enteredTurn: 0 });
  g = step(g, { type: 'attack', actor: 0, attackerId: 1, target: { kind: 'player' } }, 'a');
  g = step(g, { type: 'intercept', actor: 1, interceptorId: null }, 'i');
  assert.equal(g.players[1].hp, 38);
});
test('ritual rewards and created tokens erase instead of entering discard', () => {
  const p = player();
  sendToDiscard(p, { ...creature, ritualReward: true });
  sendToDiscard(p, { ...creature, createdToken: true });
  sendToDiscard(p, creature);
  assert.equal(p.erased.length, 2);
  assert.equal(p.discard.length, 1);
});
test('ritual reward death produces ordinary combat result but never enters discard', () => {
  let g = step(initialGame(player(), player()), { type: 'startTurn', actor: 0 }, 's');
  g.players[0].main.push({ objectId: 1, card: creature, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: 0 });
  g.players[1].main.push({ objectId: 2, card: { ...creature, health: 1 }, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: 0, ritualReward: true });
  g = step(g, { type: 'attack', actor: 0, attackerId: 1, target: { kind: 'creature', objectId: 2 } }, 'attack');
  g = step(g, { type: 'intercept', actor: 1, interceptorId: null }, 'damage');
  assert.equal(g.players[1].main.length, 0);
  assert.equal(g.players[1].discard.length, 0);
  assert.equal(g.players[1].erased.length, 1);
});
