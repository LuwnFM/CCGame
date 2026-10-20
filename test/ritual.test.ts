import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { player, type Card, type Permanent } from '../src/core.ts';
import { eligibleVictims, offerRewards, planRitual, type RitualEffect } from '../src/ritual.ts';
const card: Card = { id: 'victim', name: 'Жертва', kind: 'creature', aspects: ['violet', 'blue'], attack: 1, health: 1 };
const permanent = (id: number, c: Card = card): Permanent => ({ objectId: id, card: c, exhausted: false, damage: 0, shield: 0, enteredTurn: 1, interceptions: 0, sacrifice: true });
const rewards = Array.from({ length: 5 }, (_, id): Card => ({ ...card, id: `reward${id}`, name: `Награда ${id}` })) as RitualEffect['rewardPool'];
test('both zones count, multicolor matches, neutral does not; disabled victims excluded', () => {
  const p = player(); p.main.push(permanent(1), { ...permanent(2), stunned: true });
  p.auxiliary.push(permanent(3), { ...permanent(4), stasis: 2 }, permanent(5, { ...card, majestic: true }));
  assert.deepEqual(eligibleVictims(p, 'violet').map(x => x.objectId), [1, 3]);
  assert.deepEqual(eligibleVictims(p, 'blue').map(x => x.objectId), [1, 3]);
  assert.deepEqual(eligibleVictims(p, 'neutral'), []);
});
test('exactly N distinct legal objects and three distinct offers from five', () => {
  const p = player(); p.main.push(permanent(1)); p.auxiliary.push(permanent(2), permanent(3));
  const effect: RitualEffect = { id: 'r3', color: 'violet', threshold: 3, rewardPool: rewards, requiresSource: false };
  const result = planRitual(p, effect, [1, 2, 3], 12345);
  assert.equal(result.offeredRewardIds.length, 3);
  assert.equal(new Set(result.offeredRewardIds).size, 3);
  assert.deepEqual(result, planRitual(p, effect, [1, 2, 3], 12345));
  assert.throws(() => planRitual(p, effect, [1, 1, 3], 12345), /разных/);
  assert.throws(() => planRitual(p, effect, [1, 2, 4], 12345), /Недопустимая/);
  assert.deepEqual(p.main.map(x => x.objectId), [1]); // preparation never mutates a match
});
test('offers are approximately uniform over deterministic seed samples', () => {
  const counts = new Map(rewards.map(c => [c.id, 0]));
  for (let seed = 1; seed <= 5000; seed++) for (const id of offerRewards(rewards, seed).ids) counts.set(id, counts.get(id)! + 1);
  for (const count of counts.values()) assert.ok(count > 2500 && count < 3500);
});
