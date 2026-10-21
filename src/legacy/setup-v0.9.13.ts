import { RuleError, validateDeck, type Card } from './core-v0.9.13.ts';
import { nextRandom } from './ritual-v0.9.13.ts';

const basicColored = (card: Card) => card.kind === 'domain' && card.basic && card.produces !== 'neutral';
function shuffle(cards: Card[], seed: number): { cards: Card[]; seed: number } {
  const out = [...cards]; let current = seed;
  for (let i = out.length - 1; i > 0; i--) {
    const roll = nextRandom(current, i + 1); current = roll.seed;
    [out[i], out[roll.value]] = [out[roll.value], out[i]];
  }
  return { cards: out, seed: current };
}
function guarantee(hand: Card[], deck: Card[], seed: number, eligibleHandIndices: number[], reserve: Card[] = []) {
  if (hand.some(c => c.kind === 'domain')) return { hand, deck: [...deck, ...reserve], seed };
  if (!eligibleHandIndices.length) throw new RuleError('Нет нового слота для гарантийного Владения');
  const pool = [...deck, ...reserve];
  const candidates = pool.map((c, i) => basicColored(c) ? i : -1).filter(i => i >= 0);
  if (!candidates.length) throw new RuleError('Нет базового цветного Владения для гарантии');
  let roll = nextRandom(seed, candidates.length); seed = roll.seed;
  const [chosen] = pool.splice(candidates[roll.value], 1);
  roll = nextRandom(seed, eligibleHandIndices.length); seed = roll.seed;
  const replacedIndex = eligibleHandIndices[roll.value];
  const replaced = hand[replacedIndex]; hand[replacedIndex] = chosen;
  return { hand, deck: [...pool, replaced], seed };
}
export function openingHand(cards: readonly Card[], seed: number) {
  const errors = validateDeck(cards);
  if (errors.length) throw new RuleError(errors.join('; '));
  const shuffled = shuffle([...cards], seed);
  const hand = shuffled.cards.slice(0, 7);
  const guaranteed = guarantee(hand, shuffled.cards.slice(7), shuffled.seed, [0, 1, 2, 3, 4, 5, 6]);
  const rest = shuffle(guaranteed.deck, guaranteed.seed);
  return { hand: guaranteed.hand, deck: rest.cards, seedAfter: rest.seed };
}
/** One optional selective mulligan. Old selected cards cannot be drawn normally. */
export function mulligan(opening: { hand: Card[]; deck: Card[]; seedAfter: number }, indices: readonly number[]) {
  if (new Set(indices).size !== indices.length || indices.some(i => !Number.isInteger(i) || i < 0 || i > 6))
    throw new RuleError('Неверный выбор муллигана');
  const hand = [...opening.hand]; let deck = [...opening.deck]; let seed = opening.seedAfter;
  const setAside = indices.map(i => hand[i]);
  for (const i of indices) hand[i] = deck.shift()!;
  const guaranteed = guarantee(hand, deck, seed, [...indices], setAside);
  const rest = shuffle(guaranteed.deck, guaranteed.seed);
  return { hand: guaranteed.hand, deck: rest.cards, seedAfter: rest.seed };
}
