import type {Card} from '../core.ts';
import * as red from './red/index.ts';
import * as blue from './blue/index.ts';
import * as green from './green/index.ts';
import * as gold from './gold/index.ts';
import * as violet from './violet/index.ts';
import * as neutral from './neutral/index.ts';
export type ArchetypeId='red'|'blue'|'green'|'gold'|'violet'|'neutral';
export const ARCHETYPES=[
  {
    "id": "red",
    "name": "Стальное королевство · Горная стража",
    "state": "Стальное королевство",
    "organization": "Горная стража"
  },
  {
    "id": "blue",
    "name": "Талдрейк · Воздушная флотилия",
    "state": "Талдрейк",
    "organization": "Воздушная флотилия"
  },
  {
    "id": "green",
    "name": "Сувар · Дозор Кайров",
    "state": "Королевство Сувар",
    "organization": "Дом Кайров"
  },
  {
    "id": "gold",
    "name": "Ивелтин · Королевские рыцари",
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари"
  },
  {
    "id": "violet",
    "name": "Искажение · Сокровищница Ван Троупов",
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы"
  },
  {
    "id": "neutral",
    "name": "Орден Хранителей · Новые хранители",
    "state": "Межгосударственный орден",
    "organization": "Новые хранители"
  }
] as const;
export const STARTER:Record<ArchetypeId,readonly {card:Card;copies:number}[]>={red:red.starter,blue:blue.starter,green:green.starter,gold:gold.starter,violet:violet.starter,neutral:neutral.starter};
export const EXTRA_DOMAINS:readonly Card[]=[...red.additional,...blue.additional,...green.additional,...gold.additional,...violet.additional,...neutral.additional];
export const CARD_CATALOG:readonly Card[]=[...Object.values(STARTER).flatMap(a=>a.map(v=>v.card)),...EXTRA_DOMAINS];
if(new Set(CARD_CATALOG.map(c=>c.id)).size!==CARD_CATALOG.length)throw new Error('Duplicate catalog Card ID');
