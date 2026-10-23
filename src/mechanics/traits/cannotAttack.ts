import {registerTrait,printedTrait} from '../trait-registry.ts';
/** cannotAttack: independently registered, suppressible and attachable to any card data. */
registerTrait('cannotAttack',printedTrait('cannotAttack'));

import type {Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
export function isAttackProhibited(unit:Permanent):boolean{return !!ability(unit,'cannotAttack')}
