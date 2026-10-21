import type {Card} from '../core.ts';
/** Extend these interfaces from a new mechanic module using declaration merging.
 * Data contracts live outside the game kernel; no per-card source code is executed.
 * Every serialized kind must be backed by a registered runtime handler.
 */
export interface EntryEffectSpecs {
  summon:{cards:Card[]};
  healRuler:{amount:number};
  draw:{amount:number};
  stunEnemy:{amount:number};
  stasisEnemy:{amount:number};
}
export interface TechniqueEffectSpecs {
  reanimate:{amount:number};
  damageOpponent:{amount:number};
  healRuler:{amount:number};
  draw:{amount:number};
  cleanse:{amount:number};
  ward:{amount:number};
  silence:{amount:number};
  bind:{amount:number};
}
export interface LoyaltyEffectSpecs {
  healRuler:{amount:number};
  damageOpponent:{amount:number};
  draw:{amount:number};
  recoverCreature:{amount:number};
  summon:{cards:Card[];completeRitual?:boolean};
}
export interface DeathEffectSpecs {
  damageController:{amount:number};
  damageOpponent:{amount:number};
  damageAllCreatures:{amount:number};
}
type Variant<M>={[K in keyof M & string]:{kind:K}&M[K]}[keyof M & string];
export type EntryEffect=Variant<EntryEffectSpecs>;
export type TechniqueEffect=Variant<TechniqueEffectSpecs>;
export type LoyaltyEffect={delta:number}&Variant<LoyaltyEffectSpecs>;
export type DeathEffect=Variant<DeathEffectSpecs>;

