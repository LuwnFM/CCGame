import {registerTrait,printedTrait} from '../trait-registry.ts';
/** poisonHit: independently registered, suppressible and attachable to any card data. */
registerTrait('poisonHit',printedTrait('poisonHit'));

import {type Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
/** Poison updates a target with the stronger/longer printed poison payload. */
export function applyPoisonFromHit(target:Permanent,source:Permanent):void{
 const incoming=ability(source,'poisonHit');
 if(!incoming)return;
 const old=target.poison;
 if(!old||incoming.strength>old.strength||
    incoming.strength===old.strength&&incoming.ticks>old.ticks)
   target.poison={...incoming};
}
