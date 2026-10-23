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
      "kind": "draw",
      "amount": 1,
      "delta": 1
    },
    {
      "kind": "draw",
      "amount": 3,
      "delta": -3
    }
  ],
  "loyaltyAbility": {
    "kind": "draw",
    "amount": 3,
    "delta": -3
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Мастер воздушных путей ведёт Воздушная флотилия в сражении."
  }
};
