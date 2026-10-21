/** Immutable card identity: red-хранитель-горного-прохода. Edit stats and effect data here. */
export default {
  "id": "red-хранитель-горного-прохода",
  "name": "Хранитель горного прохода",
  "kind": "legend",
  "aspects": [
    "red"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "red": 1
    },
    "generic": 5
  },
  "loyalty": 5,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "healRuler",
      "amount": 1
    },
    {
      "delta": -2,
      "kind": "damageOpponent",
      "amount": 2
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "damageOpponent",
    "amount": 2
  },
  "lore": {
    "state": "Стальное королевство",
    "organization": "Горная стража",
    "summary": "Хранитель горного прохода ведёт Горная стража в сражении."
  }
};
