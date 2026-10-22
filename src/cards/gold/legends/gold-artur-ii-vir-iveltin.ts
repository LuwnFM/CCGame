import SHIELD from '../../tokens/gold-shield.ts';
/** Immutable card identity: gold-артур-ii-вир-ивелтин. Edit stats and effect data here. */
export default {
  "id": "gold-артур-ii-вир-ивелтин",
  "name": "Артур II вир Ивелтин",
  "kind": "legend",
  "aspects": [
    "gold"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 4
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [SHIELD]
    },
    {
      "delta": -2,
      "kind": "healRuler",
      "amount": 4
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "healRuler",
    "amount": 4
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Артур II вир Ивелтин ведёт Королевские рыцари в сражении."
  }
};
