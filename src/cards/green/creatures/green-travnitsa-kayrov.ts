/** Immutable card identity: green-травница-кайров. Edit stats and effect data here. */
export default {
  "id": "green-травница-кайров",
  "name": "Травница Кайров",
  "kind": "creature",
  "aspects": [
    "green"
  ],
  "cost": {
    "colored": {
      "green": 1
    },
    "generic": 2
  },
  "attack": 2,
  "health": 3,
  "onEntry": {
    "kind": "healRuler",
    "amount": 2
  },
  "lore": {
    "state": "Королевство Сувар",
    "organization": "Дом Кайров",
    "summary": "Травница Кайров выступает на стороне Дом Кайров."
  }
};
