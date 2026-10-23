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
      "kind": "damageOpponent",
      "amount": 1,
      "delta": 1
    },
    {
      "kind": "damageOpponent",
      "amount": 4,
      "delta": -3
    }
  ],
  "loyaltyAbility": {
    "kind": "damageOpponent",
    "amount": 4,
    "delta": -3
  },
  "lore": {
    "state": "Стальное королевство",
    "organization": "Горная стража",
    "summary": "Хранитель горного прохода ведёт Горная стража в сражении."
  }
};
