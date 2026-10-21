import {registerTrait,printedTrait} from '../trait-registry.ts';
/** guard: independently registered, suppressible and attachable to any card data. */
registerTrait('guard',printedTrait('guard'));

import type {Permanent} from '../../core.ts';
import {ability} from '../abilities.ts';
export function canGuardIntercept(unit:Permanent):boolean{return !!ability(unit,'guard')}
