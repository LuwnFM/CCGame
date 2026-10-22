/** Firewell CCG transactional kernel. All mechanics and commands are registered modules. */
import type {Command} from './mechanics/command-contracts.ts';
import {executeCommand} from './mechanics/command-registry.ts';
import {emptyEnergy} from './mechanics/energy.ts';
import {leaveCard} from './mechanics/zones.ts';
import {emitGameEvent} from './mechanics/events.ts';
import {EffectLimitError,MAX_EFFECT_OPERATIONS} from './mechanics/limits.ts';
export {MAX_EFFECT_OPERATIONS} from './mechanics/limits.ts';
export {validateDeck} from './mechanics/deck-rules.ts';
export {RULES_VERSION,STARTING_RULER_HP} from './model/index.ts';
import {RULES_VERSION,STARTING_RULER_HP} from './model/index.ts';
import type {Card,Game,Player,PlayerId} from './model/index.ts';
export type {PlayerId,Aspect,Energy,Cost,RitualSpec,Card,Permanent,Player,ReadyRitual,PendingReward,Game} from './model/index.ts';
export type {DeathEffect,EntryEffect,LoyaltyEffect,TechniqueEffect} from './mechanics/effect-contracts.ts';
export type {Command} from './mechanics/command-contracts.ts';

export class RuleError extends Error {}
export function player(deck: Card[] = [], hand: Card[] = []): Player {
  return { hp: STARTING_RULER_HP, deck: [...deck], hand: [...hand], discard: [], erased: [], domains: [], main: [], auxiliary: [], legends: [], energy: emptyEnergy(), domainsPlayed: 0, rituals: [] };
}
/** A ritual reward or created token can never enter the discard zone. */
export function sendToDiscard(owner:Player,card:Card,ritualReward=false):void{
  leaveCard(owner,card,ritualReward);
}
/** Fixtures must state their initial hand/deck explicitly until mulligan is formalized. */
export function initialGame(first: Player, second: Player): Game {
  return { schemaVersion: 1, rulesVersion: RULES_VERSION, revision: 0, nextObjectId: 1,
    turn: 0, active: 0, phase: 'main', winner: null, pendingAttack: null, players: [structuredClone(first), structuredClone(second)], processed: {}, timeoutStreak: [0, 0] };
}
/** Each seat sees only its own seven cards until both have answered. */
export function openingGame(first: { hand: Card[]; deck: Card[]; seedAfter: number }, second: { hand: Card[]; deck: Card[]; seedAfter: number }): Game {
  const game = initialGame(player(first.deck, first.hand), player(second.deck, second.hand));
  game.phase = 'mulligan';
  game.mulliganReady = [false, false];
  game.mulliganSeeds = [first.seedAfter, second.seedAfter];
  game.seed = second.seedAfter;
  return game;
}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
/** Automatically exhaust the minimum necessary ready Domains when the energy pool is short.
 * Colored requirements are reserved first; generic energy prefers neutral, then other colors.
 * Changes occur only on apply()'s cloned game, so invalid actions never exhaust Domains.
 */
export function apply(game: Game, command: Command): Game {
  requireRule(typeof command.key === 'string' && command.key.length > 0, 'Нужен ключ идемпотентности');
  const fingerprint = JSON.stringify(command, (key, value) => key === 'expectedRevision' ? undefined : value);
  if (Object.hasOwn(game.processed, command.key)) {
    requireRule(game.processed[command.key].command === fingerprint, 'Ключ команды уже использован для другого действия');
    return game;
  }
  requireRule(game.revision === command.expectedRevision, 'Устаревшая ревизия');
  requireRule(game.phase !== 'finished' && game.phase !== 'paused' && command.actor === (command.type === 'mulligan' ? command.actor : command.type === 'intercept' ? game.pendingAttack?.defender : game.active), 'Не ваш ход');
  const next = structuredClone(game);
  const p = next.players[command.actor];
  try {
  if ((next.operationsUsed = (next.operationsUsed ?? 0) + 1) > MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет операций за ход; матч приостановлен');
  executeCommand(next,command);
  emitGameEvent(next,{type:'commandApplied',owner:command.actor,commandType:command.type});
  
  } catch (error) {
    if (!(error instanceof EffectLimitError)) throw error;
    const paused = structuredClone(game);
    paused.phase = 'paused'; paused.pauseReason = error.message;
    paused.revision++;
    paused.processed[command.key] = { revision: paused.revision, command: fingerprint };
    return paused;
  }
  next.revision++;
  next.processed[command.key] = { revision: next.revision, command: fingerprint };
  return next;
}
