import {registerTrait,printedTrait} from '../trait-registry.ts';
/** majestic: independently registered, suppressible and attachable to any card data. */
registerTrait('majestic',printedTrait('majestic'));

/** Printed Majestic is untargetable by techniques and non-combat abilities,
 * even in legacy games with a previously applied suppressing status.
 * Ordinary creature attacks and their on-hit consequences are not effects.
 */
export function mayTargetWithEffect(unit:import('../../model/index.ts').Permanent):boolean {
 return !unit.card.majestic;
}
