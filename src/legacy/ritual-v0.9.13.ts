import { RuleError, type Aspect, type Card, type Permanent, type Player } from './core-v0.9.13.ts';

export type RitualColor = Aspect | 'neutral';
export type RitualEffect = {
  id: string; color: RitualColor; threshold: number;
  rewardPool: readonly [Card, Card, Card, Card, Card];
  /** If true, the source must still be present when the turn starts. */
  requiresSource: boolean;
};
export type RitualPlan = { effectId: string; chosenObjectIds: number[]; offeredRewardIds: string[]; seedAfter: number };

/** The effect belongs to one controller. A multi-aspect creature matches any listed aspect. */
export function eligibleVictims(owner: Player, color: RitualColor): Permanent[] {
  return [...owner.main, ...owner.auxiliary].filter(p =>
    p.card.kind === 'creature' && p.sacrifice === true && !p.card.majestic &&
    !p.stunned && !(p.stasis && p.stasis > 0) &&
    (color === 'neutral' ? !p.card.aspects?.length : p.card.aspects?.includes(color)));
}

/** xorshift32, persisted in the match log. Rejection sampling avoids modulo bias. */
export function nextRandom(seed: number, bound: number): { value: number; seed: number } {
  if (!Number.isSafeInteger(seed) || seed <= 0 || seed > 0xffffffff || !Number.isSafeInteger(bound) || bound < 1 || bound > 0x100000000)
    throw new RuleError('Неверный seed или размер пула');
  let state = seed >>> 0;
  const limit = Math.floor(0x100000000 / bound) * bound;
  for (;;) {
    state ^= state << 13; state ^= state >>> 17; state ^= state << 5;
    state >>>= 0;
    if (state < limit) return { value: state % bound, seed: state };
  }
}

export function offerRewards(pool: RitualEffect['rewardPool'], seed: number): { ids: string[]; seedAfter: number } {
  if (new Set(pool.map(c => c.id)).size !== 5) throw new RuleError('Нужны пять разных наград');
  const entries = [...pool];
  let current = seed;
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    const roll = nextRandom(current, entries.length); current = roll.seed;
    ids.push(entries.splice(roll.value, 1)[0].id);
  }
  return { ids, seedAfter: current };
}

/** Prepare, but never award. A later transactional event resolver must complete all deaths first. */
export function planRitual(owner: Player, effect: RitualEffect, objectIds: readonly number[], seed: number): RitualPlan {
  if (!Number.isSafeInteger(effect.threshold) || effect.threshold < 1) throw new RuleError('Неверный порог');
  if (objectIds.length !== effect.threshold || new Set(objectIds).size !== objectIds.length)
    throw new RuleError('Выберите ровно N разных Жертв');
  const eligible = new Set(eligibleVictims(owner, effect.color).map(p => p.objectId));
  if (!objectIds.every(id => eligible.has(id))) throw new RuleError('Недопустимая Жертва');
  const offered = offerRewards(effect.rewardPool, seed);
  return { effectId: effect.id, chosenObjectIds: [...objectIds], offeredRewardIds: offered.ids, seedAfter: offered.seedAfter };
}
