import {registerTrait,printedTrait} from '../trait-registry.ts';
/** shield: independently registered, suppressible and attachable to any card data. */
registerTrait('shield',printedTrait('shield'));

import type {Permanent} from '../../core.ts';
/** Shield absorbs incoming damage before HP/damage counters are affected. */
export function absorbShield(target:Permanent,raw:number):number{
 const absorbed=Math.min(target.shield,Math.max(0,raw));
 target.shield-=absorbed;
 return Math.max(0,raw-absorbed);
}
