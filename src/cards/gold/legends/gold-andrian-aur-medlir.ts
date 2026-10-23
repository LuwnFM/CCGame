/** Immutable card identity: gold-андриан-аур-медлир. Edit stats and effect data here. */
export default {
  "id": "gold-андриан-аур-медлир",
  "name": "Андриан аур Медлир",
  "kind": "legend",
  "aspects": [
    "gold"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 5
  },
  "loyalty": 5,
  "loyaltyAbilities": [
    {
      "kind": "shieldTeam",
      "amount": 1,
      "delta": 1
    },
    {
      "kind": "healRuler",
      "amount": 6,
      "delta": -3
    }
  ],
  "loyaltyAbility": {
    "kind": "healRuler",
    "amount": 6,
    "delta": -3
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Андриан аур Медлир ведёт Королевские рыцари в сражении."
  }
};
