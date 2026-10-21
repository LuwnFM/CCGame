/** Immutable card identity: blue-мастер-воздушных-путей. Edit stats and effect data here. */
export default {
  "id": "blue-мастер-воздушных-путей",
  "name": "Мастер воздушных путей",
  "kind": "legend",
  "aspects": [
    "blue"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "blue": 1
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
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Мастер воздушных путей ведёт Воздушная флотилия в сражении."
  }
};
