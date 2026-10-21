import {RuleError} from '../../core.ts';
export function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
