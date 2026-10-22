import {registerTrait,printedTrait} from '../trait-registry.ts';
/** haste: independently registered, suppressible and attachable to any card data. */
registerTrait('haste',printedTrait('haste'));

import type {Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
export function hasImmediateAttack(unit:Permanent):boolean{return !!ability(unit,'haste')}
