import {validateDeck,type Card} from './core.ts';
import {ARCHETYPES,EXTRA_DOMAINS,STARTER,type ArchetypeId} from './cards/catalog.ts';
export {ARCHETYPES,EXTRA_DOMAINS};
export type {ArchetypeId};
export function testDeck(id:ArchetypeId):Card[]{
 const entries=STARTER[id];if(!entries)throw new Error('Неизвестная колода');
 const cards=entries.flatMap(({card,copies})=>Array.from({length:copies},()=>structuredClone(card)));
 const problems=validateDeck(cards);if(problems.length)throw new Error(id+': '+problems.join('; '));
 return cards;
}
