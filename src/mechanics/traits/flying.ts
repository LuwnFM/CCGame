import {registerTrait,printedTrait} from '../trait-registry.ts';
/** flying: independently registered, suppressible and attachable to any card data. */
registerTrait('flying',printedTrait('flying'));

import type {Permanent} from '../../core.ts';
import {ability} from '../abilities.ts';
export function canInterceptFlyingAttack(attacker:Permanent|null,interceptor:Permanent):boolean{return !attacker||!ability(attacker,'flying')||!!ability(interceptor,'flying')}
