import type {Game,PlayerId,ReadyRitual} from '../model/index.ts';
import {emptyEnergy} from './energy.ts';
import {drawCards} from './zones.ts';
import {tickStatusesAtTurnStart} from './statuses.ts';
import {resolveDeaths,collectLethal,finishIfLethal} from './death-queue.ts';
import {eligibleVictims} from '../ritual.ts';
import {emitGameEvent} from './events.ts';
export function advance(game:Game):void {
  game.active = (1 - game.active) as PlayerId;
  game.turn++;
  game.operationsUsed = 0;
  game.phase = 'main';
  emitGameEvent(game,{type:'turnStart',owner:game.active});
  const p = game.players[game.active];
  p.domainsPlayed = 0;
  for (const domain of p.domains) domain.exhausted = false;
  for (const creature of p.main) creature.exhausted = false;
  for (const creature of p.auxiliary) creature.exhausted = false;
  for (const creature of [...p.main, ...p.auxiliary]) creature.attacksMade = 0;
  // A defender's per-opponent-turn intercept limit resets when that opponent starts.
  for (const creature of game.players[1 - game.active].main) creature.interceptions = 0;
  for (const creature of game.players[1 - game.active].auxiliary) creature.interceptions = 0;
  drawCards(p,1,game,game.active);
  tickStatusesAtTurnStart(p);
  resolveDeaths(game, collectLethal(game));
  if (finishIfLethal(game)) return;
  const ready: ReadyRitual[] = [];
  for (const effect of p.rituals) {
    const victims = eligibleVictims(p, effect.color).map(unit => unit.objectId);
    if (victims.length >= effect.threshold) ready.push({ effect: structuredClone(effect), eligibleIds: victims });
    effect.remainingStarts--;
  }
  p.rituals = p.rituals.filter(effect => effect.remainingStarts > 0);
  game.readyRituals = ready;
  if (ready.length) game.phase = 'ritual';
}
