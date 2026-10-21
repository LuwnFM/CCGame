import {registerTrait,printedTrait} from '../trait-registry.ts';
/** cannotAttack: independently registered, suppressible and attachable to any card data. */
registerTrait('cannotAttack',printedTrait('cannotAttack'));

import type {Permanent} from '../../core.ts';
import {ability} from '../abilities.ts';
export function isAttackProhibited(unit:Permanent):boolean{return !!unit.card.cannotAttack}
