import {registerTrait,printedTrait} from '../trait-registry.ts';
/** extraAttacks: independently registered, suppressible and attachable to any card data. */
registerTrait('extraAttacks',printedTrait('extraAttacks'));

import type {Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
export function canAttackAgain(unit:Permanent):boolean{return (unit.attacksMade??0)<=(ability(unit,'extraAttacks')??0)}
