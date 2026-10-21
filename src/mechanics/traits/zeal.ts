import {registerTrait,printedTrait} from '../trait-registry.ts';
/** zeal: independently registered, suppressible and attachable to any card data. */
registerTrait('zeal',printedTrait('zeal'));

import type {Permanent} from '../../core.ts';
import {ability} from '../abilities.ts';
export function hasCreatureOnlyImmediateAttack(unit:Permanent,targetKind:string|undefined):boolean{return !!ability(unit,'zeal')&&targetKind==='creature'}
