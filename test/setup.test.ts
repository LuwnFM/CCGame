import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { openingHand, mulligan } from '../src/setup.ts';
import { type Card } from '../src/core.ts';
const basic: Card = { id: 'land', name: 'Базовое Владение', kind: 'domain', basic: true, produces: 'red' };
const neutral: Card = { id: 'neutral', name: 'Базовое нейтральное', kind: 'domain', basic: true, produces: 'neutral' };
const deck: Card[] = [basic, ...Array(25).fill(neutral), ...Array.from({ length: 44 }, (_, i): Card => ({ id: `c${i}`, name: `Существо ${i}`, kind: 'creature', attack: 1, health: 1, cost: { generic: 0, colored: {} } }))];
test('opening and mulligan keep exactly 70 physical positions and a domain in hand', () => {
  for (let seed = 1; seed < 400; seed++) {
    const opened = openingHand(deck, seed);
    assert.equal(opened.hand.length, 7); assert.equal(opened.deck.length, 63);
    assert.ok(opened.hand.some(c => c.kind === 'domain'));
    const replacement = mulligan(opened, [0, 1, 2, 3, 4, 5, 6]);
    assert.equal(replacement.hand.length, 7); assert.equal(replacement.deck.length, 63);
    assert.ok(replacement.hand.some(c => c.kind === 'domain'));
    const ids = [...replacement.hand, ...replacement.deck].map(c => c.id).sort();
    assert.deepEqual(ids, deck.map(c => c.id).sort());
    assert.deepEqual(replacement, mulligan(opened, [0, 1, 2, 3, 4, 5, 6]));
  }
});
test('a retained neutral domain prevents the second guarantee', () => {
  const opened = openingHand(deck, 1234);
  const n = opened.hand.findIndex(c => c.kind === 'domain');
  const chosen = Array.from({ length: 7 }, (_, i) => i).filter(i => i !== n);
  const after = mulligan(opened, chosen);
  assert.equal(after.hand[n], opened.hand[n]);
});
