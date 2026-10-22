/** Canonical serializable game state contracts: no runtime imports from the engine. */
import type {DeathEffect,EntryEffect,LoyaltyEffect,TechniqueEffect} from '../mechanics/effect-contracts.ts';
import type {RitualEffect} from '../ritual.ts';
export const RULES_VERSION = '0.9.15-alpha';
export const STARTING_RULER_HP = 40;
export type PlayerId = 0 | 1;
export type Aspect = 'red' | 'blue' | 'green' | 'gold' | 'violet';
export type Energy = Aspect | 'neutral';
export type Cost = { colored: Partial<Record<Aspect, number>>; generic: number };
export type RitualSpec = { color: Aspect | 'neutral'; threshold: number; duration: number; rewardPool: [Card, Card, Card, Card, Card] };
export type {DeathEffect,EntryEffect,LoyaltyEffect,TechniqueEffect} from './mechanics/effect-contracts.ts';
export interface Card {
  id: string;
  name: string;
  nameEn?: string;
  kind: 'domain' | 'creature' | 'technique' | 'legend' | 'artifact';
  aspects?: readonly Aspect[];
  basic?: boolean;
  unique?: boolean;
  produces?: Energy;
  cost?: Cost;
  attack?: number;
  health?: number;
  guard?: boolean;
  flying?: boolean;
  firstStrike?: boolean;
  piercing?: boolean;
  lifesteal?: boolean;
  haste?: boolean;
  zeal?: boolean;
  extraAttacks?: number;
  untiring?: boolean;
  stealth?: boolean;
  poisonHit?: { strength: number; ticks: number };
  shield?: number;
  majestic?: boolean;
  cannotAttack?: boolean;
  ritualReward?: boolean;
  createdToken?: boolean;
  sacrifice?: boolean;
  ritual?: RitualSpec;
  onDeath?: DeathEffect;
  onEntry?: EntryEffect;
  secondChance?: EntryEffect;
  techniqueEffect?: TechniqueEffect;
  loyalty?: number;
  loyaltyAbility?: LoyaltyEffect;
  loyaltyAbilities?: readonly LoyaltyEffect[];
  auraAttack?: number;
  lore?: { state: string; organization: string; summary?: string; note?: string };
  // Abilities need a separately specified resolver, never arbitrary card scripts.
  abilities?: readonly string[];
}
export interface Permanent { objectId: number; card: Card; exhausted: boolean; damage: number; shield: number; enteredTurn: number; interceptions: number;
  sacrifice?: boolean; stunned?: boolean; stasis?: number; ritualReward?: boolean; loyalty?: number; lastActivatedTurn?: number;
  attacksMade?: number; silenced?: boolean; poison?: { strength: number; ticks: number } }
export interface Player {
  hp: number; deck: Card[]; hand: Card[]; discard: Card[]; erased: Card[];
  domains: Permanent[]; main: Permanent[]; auxiliary: Permanent[]; legends: Permanent[];
  energy: Record<Energy, number>; domainsPlayed: number;
  rituals: (RitualEffect & { remainingStarts: number })[];
  lastRulerDrawTurn?: number;
}
export type ReadyRitual = { effect: RitualEffect; eligibleIds: number[] };
export type PendingReward = { owner: PlayerId; offeredIds: string[]; pool: [Card, Card, Card, Card, Card] };
export interface Game {
  schemaVersion: 1; rulesVersion: typeof RULES_VERSION; revision: number;
  nextObjectId: number; turn: number; active: PlayerId;
  phase: 'mulligan' | 'main' | 'intercept' | 'discard' | 'ritual' | 'reward' | 'paused' | 'finished'; winner: PlayerId | 'draw' | null;
  mulliganReady?: [boolean, boolean]; mulliganSeeds?: [number, number]; seed?: number;
  readyRituals?: ReadyRitual[]; pendingReward?: PendingReward | null; pauseReason?: string;
  operationsUsed?: number;
  timeoutStreak?: [number, number];
  pendingAttack: null | { attackerId: number; target: { kind: 'player' } | { kind: 'creature' | 'legend'; objectId: number }; defender: PlayerId };
  players: [Player, Player]; processed: Record<string, { revision: number; command: string }>;
}
