/** Canonical serializable game state contracts. This layer has no engine imports. */
export const RULES_VERSION = '0.9.15-alpha';
export const STARTING_RULER_HP = 40;
export type PlayerId = 0 | 1;
export type Aspect = 'red' | 'blue' | 'green' | 'gold' | 'violet';
export type Energy = Aspect | 'neutral';
export type Cost = { colored: Partial<Record<Aspect, number>>; generic: number };
export type RitualColor = Aspect | 'neutral';
export type RitualSpec = { color: RitualColor; threshold: number; duration: number; rewardPool: [Card, Card, Card, Card, Card] };
export interface EntryEffectSpecs {
  summon:{cards:Card[]}; healRuler:{amount:number}; draw:{amount:number}; stunEnemy:{amount:number}; stasisEnemy:{amount:number};
}
export interface TechniqueEffectSpecs {
  reanimate:{amount:number}; damageOpponent:{amount:number}; healRuler:{amount:number}; draw:{amount:number};
  cleanse:{amount:number}; ward:{amount:number}; silence:{amount:number}; bind:{amount:number};
}
export interface LoyaltyEffectSpecs {
  healRuler:{amount:number}; damageOpponent:{amount:number}; draw:{amount:number}; recoverCreature:{amount:number};
  summon:{cards:Card[];completeRitual?:boolean};
}
export interface DeathEffectSpecs {
  damageController:{amount:number}; damageOpponent:{amount:number}; damageAllCreatures:{amount:number};
}
type Variant<M>={[K in keyof M & string]:{kind:K}&M[K]}[keyof M & string];
export type EntryEffect=Variant<EntryEffectSpecs>;
export type TechniqueEffect=Variant<TechniqueEffectSpecs>;
export type LoyaltyEffect={delta:number}&Variant<LoyaltyEffectSpecs>;
export type DeathEffect=Variant<DeathEffectSpecs>;
export type RitualEffect = {
  id:string; color:RitualColor; threshold:number; rewardPool:readonly [Card,Card,Card,Card,Card]; requiresSource:boolean;
};
export type RitualPlan = {effectId:string;chosenObjectIds:number[];offeredRewardIds:string[];seedAfter:number};
export interface Card {
  id:string; name:string; nameEn?:string;
  kind:'domain'|'creature'|'technique'|'legend'|'artifact';
  aspects?:readonly Aspect[]; basic?:boolean; unique?:boolean; produces?:Energy; cost?:Cost;
  attack?:number; health?:number; guard?:boolean; flying?:boolean; firstStrike?:boolean; piercing?:boolean;
  lifesteal?:boolean; haste?:boolean; zeal?:boolean; extraAttacks?:number; untiring?:boolean; stealth?:boolean;
  poisonHit?:{strength:number;ticks:number}; shield?:number; majestic?:boolean; cannotAttack?:boolean;
  ritualReward?:boolean; createdToken?:boolean; sacrifice?:boolean; ritual?:RitualSpec; ritualDrawBonus?:number;
  onDeath?:DeathEffect; onEntry?:EntryEffect; secondChance?:EntryEffect; techniqueEffect?:TechniqueEffect;
  loyalty?:number; loyaltyAbility?:LoyaltyEffect; loyaltyAbilities?:readonly LoyaltyEffect[]; auraAttack?:number;
  lore?:{state:string;organization:string;summary?:string;note?:string};
  abilities?:readonly string[];
}
export interface Permanent {
  objectId:number; card:Card; exhausted:boolean; damage:number; shield:number; enteredTurn:number; interceptions:number;
  sacrifice?:boolean; stunned?:boolean; stasis?:number; ritualReward?:boolean; loyalty?:number; lastActivatedTurn?:number;
  attacksMade?:number; silenced?:boolean; poison?:{strength:number;ticks:number};
}
export interface Player {
  hp:number; deck:Card[]; hand:Card[]; discard:Card[]; erased:Card[];
  domains:Permanent[]; main:Permanent[]; auxiliary:Permanent[]; legends:Permanent[];
  energy:Record<Energy,number>; domainsPlayed:number; rituals:(RitualEffect&{remainingStarts:number})[];
  lastRulerDrawTurn?:number;
}
export type ReadyRitual={effect:RitualEffect;eligibleIds:number[]};
export type PendingReward={owner:PlayerId;offeredIds:string[];pool:[Card,Card,Card,Card,Card]};
export interface Game {
  schemaVersion:1; rulesVersion:typeof RULES_VERSION; revision:number; nextObjectId:number; turn:number; active:PlayerId;
  phase:'mulligan'|'main'|'intercept'|'discard'|'ritual'|'reward'|'paused'|'finished';
  winner:PlayerId|'draw'|null; mulliganReady?:[boolean,boolean]; mulliganSeeds?:[number,number]; seed?:number;
  readyRituals?:ReadyRitual[]; pendingReward?:PendingReward|null; pauseReason?:string; operationsUsed?:number;
  timeoutStreak?:[number,number];
  pendingAttack:null|{attackerId:number;target:{kind:'player'}|{kind:'creature'|'legend';objectId:number};defender:PlayerId};
  players:[Player,Player]; processed:Record<string,{revision:number;command:string}>;
}
