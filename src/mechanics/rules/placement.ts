import type {Permanent,Card} from '../../model/index.ts';
import {canBeDisplaced} from '../traits/majestic.ts';

/** Common permanent identity/replacement checks, regardless of zone.
 * Unique's keep-existing choice is distinct from displacing its incumbent.
 */
export function findNamedConflict(units:readonly Permanent[],card:Card):Permanent|undefined{
 return units.find(unit=>unit.card.name===card.name);
}
export function isDisplaceable(unit:Permanent):boolean{
 return canBeDisplaced(unit);
}
export function findDisplaceable(units:readonly Permanent[],objectId:number|undefined):Permanent|undefined{
 return units.find(unit=>unit.objectId===objectId&&isDisplaceable(unit));
}
