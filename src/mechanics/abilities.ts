import type {Card,Permanent} from '../model/index.ts';
import './traits/index.ts';
import {readTrait} from './trait-registry.ts';
/** Active game traits are only those registered in src/mechanics/traits/.
 * Suppression applies uniformly; unknown arbitrary card metadata remains inert.
 */
export function ability<K extends keyof Card>(unit:Permanent,key:K):Card[K]|undefined{
 return readTrait(unit,key);
}
