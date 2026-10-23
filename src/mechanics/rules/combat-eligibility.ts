import type {Permanent} from '../../model/index.ts';
import {ability} from '../abilities.ts';
import {hasImmediateAttack} from '../traits/haste.ts';
import {hasCreatureOnlyImmediateAttack} from '../traits/zeal.ts';
import {isAttackProhibited} from '../traits/cannotAttack.ts';

/** Shared attack readiness: suppression comes from the trait registry,
 * while Stun, Stasis and Exhaustion are independent action blockers.
 */
export function canDeclareAttack(unit:Permanent,turn:number,targetKind?:string):boolean{
 return !isAttackProhibited(unit)&&!unit.exhausted&&!unit.stunned&&!unit.stasis &&
   (unit.attacksMade??0)<1+(ability(unit,'extraAttacks')??0) &&
   (unit.enteredTurn<turn || hasImmediateAttack(unit) || hasCreatureOnlyImmediateAttack(unit,targetKind));
}
export function isInterceptorReady(unit:Permanent):boolean {
 return !unit.exhausted&&!unit.stasis&&unit.interceptions===0;
}
