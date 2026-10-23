import type {Permanent} from '../../model/index.ts';

/** Printed traits are inactive during Silence (Nemota) and Stasis.
 * Suppression never mutates immutable card data; Stasis still blocks actions.
 */
export function isTraitSuppressed(unit:Permanent):boolean {
 return !!unit.silenced || !!unit.stasis;
}
