import {registerTrait,printedTrait} from '../trait-registry.ts';
/** stealth: independently registered, suppressible and attachable to any card data. */
registerTrait('stealth',printedTrait('stealth'));

import type {Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
export function canSelectAsAttackTarget(unit:Permanent):boolean{return !ability(unit,'stealth')}
