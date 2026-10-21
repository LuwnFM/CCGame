import {registerTrait,printedTrait} from '../trait-registry.ts';
/** auraAttack: independently registered, suppressible and attachable to any card data. */
registerTrait('auraAttack',printedTrait('auraAttack'));

import type {Permanent,Player} from '../../core.ts';
import {ability} from '../abilities.ts';
export function alliedAuraBonus(owner:Player):number{return owner.auxiliary.filter(x=>!x.stasis&&!x.silenced).reduce((sum,x)=>sum+(ability(x,'auraAttack')??0),0)}
