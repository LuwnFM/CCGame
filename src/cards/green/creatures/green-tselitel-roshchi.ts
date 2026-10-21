/** Immutable card identity: green-целитель-рощи. Edit stats and effect data here. */
export default {
  "id": "green-целитель-рощи",
  "name": "Целитель рощи",
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
  "health": 4,
  "onEntry": {
    "kind": "healRuler",
    "amount": 1
  },
  "lore": {
    "state": "Королевство Сувар",
    "organization": "Дом Кайров",
    "summary": "Целитель рощи выступает на стороне Дом Кайров."
  }
};
