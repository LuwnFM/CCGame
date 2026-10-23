import {registerTrait,printedTrait} from '../trait-registry.ts';
/** majestic: independently registered, suppressible and attachable to any card data. */
registerTrait('majestic',printedTrait('majestic'));

/** A player cannot individually choose printed Majestic as the target
 * of a Technique or ability (including friendly effects and entry triggers).
 * This also holds in legacy saves where some status is already applied.
 *
 * ONLY use this predicate at manual/explicit-target selection sites.
 * DO NOT filter it out of untargeted/global effects, randomized damage pools,
 * creature combat, or damage triggered by a combat hit.
 */
export function mayChooseEffectTarget(unit:import('../../model/index.ts').Permanent):boolean {
 return !unit.card.majestic;
}

/** Printed Majestic cannot be displaced, including Unique-name replacement. */
export function canBeDisplaced(unit:import('../../model/index.ts').Permanent):boolean {
 return !unit.card.majestic;
}
