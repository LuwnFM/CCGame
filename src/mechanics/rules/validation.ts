import {RuleError} from '../../errors.ts';

/** Stable assertions shared by command and effect modules. */
export function requireRule(ok:unknown,message:string):asserts ok {
 if(!ok)throw new RuleError(message);
}
/** Only the value check is shared; the individual effect chooses its cap. */
export function isValidAmount(amount:unknown,max=8):amount is number {
 return typeof amount==='number' && Number.isSafeInteger(amount) && amount>=0 && amount<=max;
}
