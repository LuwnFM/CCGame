import {registerTrait,printedTrait} from '../trait-registry.ts';
/** lifesteal: independently registered, suppressible and attachable to any card data. */
registerTrait('lifesteal',printedTrait('lifesteal'));

import {type Player,type Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
/** Lifesteal restores only effective damage dealt, capped at 30 HP. */
export function healFromLifesteal(owner:Player,source:Permanent,dealt:number):void{
 if(ability(source,'lifesteal'))owner.hp=Math.min(30,owner.hp+dealt);
}
