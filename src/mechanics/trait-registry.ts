import type {Card,Permanent} from '../model/index.ts';
import {isTraitSuppressed} from './rules/suppression.ts';
export type TraitResolver<K extends keyof Card>=(unit:Permanent)=>Card[K]|undefined;
const traits=new Map<keyof Card,(unit:Permanent)=>unknown>();
/** One trait module = one resolver. Printed card data is immutable and all
 * suppressed traits read as inactive while Nemota/Stasis applies.
 */
export function registerTrait<K extends keyof Card>(name:K,resolve:TraitResolver<K>):()=>void{
 if(traits.has(name))throw new Error('Игровое свойство уже зарегистрировано: '+String(name));
 traits.set(name,resolve);
 return ()=>{if(traits.get(name)===resolve)traits.delete(name)};
}
export function registeredTraits():string[]{return [...traits.keys()].map(String).sort();}
export function readTrait<K extends keyof Card>(unit:Permanent,name:K):Card[K]|undefined{
 if(isTraitSuppressed(unit))return undefined;
 const handler=traits.get(name);
 // Keep arbitrary Card metadata inert unless a mechanic module explicitly opts in.
 return handler?handler(unit) as Card[K]:undefined;
}
export function printedTrait<K extends keyof Card>(key:K):TraitResolver<K>{
 return unit=>unit.card[key];
}
