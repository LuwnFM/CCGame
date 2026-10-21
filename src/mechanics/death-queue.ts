import { RuleError, sendToDiscard, type Game, type Player, type Permanent, type PlayerId } from '../core.ts';
import { damage } from './combat.ts';

export class EffectLimitError extends Error {}
export const MAX_EFFECT_OPERATIONS = 128;
type Death = { unit: Permanent; owner: PlayerId };
export function removePermanents(owner: Player, ids: readonly number[]): Permanent[] {
  const removed: Permanent[] = [];
  for (const id of ids) {
    const zone = [owner.main, owner.auxiliary].find(group => group.some(unit => unit.objectId === id));
    if (!zone) throw new RuleError('Существо уже покинуло поле');
    removed.push(zone.splice(zone.findIndex(unit => unit.objectId === id), 1)[0]);
  }
  return removed;
}
export function collectLethal(game: Game): Death[] {
  const dead: Death[] = [];
  for (const owner of [0, 1] as const) {
    const player = game.players[owner];
    for (const zone of [player.main, player.auxiliary]) {
      for (let i = zone.length - 1; i >= 0; i--) {
        const unit = zone[i];
        if (unit.card.health !== undefined && unit.damage >= unit.card.health)
          dead.push({ unit: zone.splice(i, 1)[0], owner });
      }
    }
  }
  // Active player resolves their simultaneous deaths first; stable ordering by object id.
  return dead.sort((a, b) => (a.owner === game.active ? 0 : 1) - (b.owner === game.active ? 0 : 1) || a.unit.objectId - b.unit.objectId);
}
export function resolveDeaths(game: Game, initial: Death[]): void {
  const queue = [...initial];
  while (queue.length) {
    if ((game.operationsUsed = (game.operationsUsed ?? 0) + 1) > MAX_EFFECT_OPERATIONS)
      throw new EffectLimitError('Превышен бюджет обязательных эффектов; матч приостановлен');
    const { unit, owner } = queue.shift()!;
    const effect = unit.stasis || unit.silenced ? undefined : unit.card.onDeath;
    if (effect) {
      if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) throw new RuleError('Неверный эффект гибели');
      if (effect.kind === 'damageController') game.players[owner].hp -= effect.amount;
      else if (effect.kind === 'damageOpponent') game.players[(1 - owner) as PlayerId].hp -= effect.amount;
      else if (effect.kind === 'damageAllCreatures') {
        for (const side of game.players) for (const creature of [...side.main, ...side.auxiliary]) damage(creature, effect.amount);
        queue.push(...collectLethal(game));
      } else throw new RuleError('Неизвестный обязательный эффект гибели');
    }
    sendToDiscard(game.players[owner], unit.card, unit.ritualReward);
  }
}
export function finishIfLethal(game: Game): boolean {
  const [a, b] = game.players;
  if (a.hp > 0 && b.hp > 0) return false;
  game.winner = a.hp <= 0 && b.hp <= 0 ? 'draw' : a.hp <= 0 ? 1 : 0;
  game.phase = 'finished';
  return true;
}


