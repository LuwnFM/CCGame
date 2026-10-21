import type {Card,Permanent} from '../core.ts';
/** Suppression is a view, never mutation of a printed card or previously applied status. */
export function ability<K extends keyof Card>(unit:Permanent,key:K):Card[K]|undefined {
 return unit.stasis || unit.silenced ? undefined : unit.card[key];
}
