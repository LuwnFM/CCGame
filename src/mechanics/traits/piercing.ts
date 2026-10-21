import {registerTrait,printedTrait} from '../trait-registry.ts';
/** piercing: independently registered, suppressible and attachable to any card data. */
registerTrait('piercing',printedTrait('piercing'));

import {type Permanent} from '../../core.ts';
import {ability} from '../abilities.ts';
/** Damage exceeding interception resistance is dealt to the originally declared target. */
export function interceptedOverflow(attacker:Permanent,intercepted:boolean,attack:number,shieldBefore:number,remainingHealth:number):number{
 return intercepted&&ability(attacker,'piercing')
   ?Math.max(0,attack-shieldBefore-remainingHealth):0;
}
