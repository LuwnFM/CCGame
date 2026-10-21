/** Immutable card identity: red-последний-дозорный. Edit stats and effect data here. */
export default {
  "id": "red-последний-дозорный",
  "name": "Последний дозорный",
  "kind": "creature",
  "aspects": [
    "red"
  ],
  "cost": {
    "colored": {
      "red": 1
    },
    "generic": 2
  },
  "attack": 2,
  "health": 3,
  "onDeath": {
    "kind": "damageOpponent",
    "amount": 1
  },
  "lore": {
    "state": "Стальное королевство",
    "organization": "Горная стража",
    "summary": "Последний дозорный выступает на стороне Горная стража."
  }
};
