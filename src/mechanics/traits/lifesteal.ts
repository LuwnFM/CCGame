import {STARTING_RULER_HP} from '../../model/index.ts';
import {registerTrait,printedTrait} from '../trait-registry.ts';
/** lifesteal: independently registered, suppressible and attachable to any card data. */
registerTrait('lifesteal',printedTrait('lifesteal'));

import {type Player,type Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
/** Lifesteal restores only effective damage dealt, capped at the starting ruler HP. */
export function healFromLifesteal(owner:Player,source:Permanent,dealt:number):void{
 if(ability(source,'lifesteal'))owner.hp=Math.max(owner.hp,Math.min(STARTING_RULER_HP,owner.hp+dealt));
}
