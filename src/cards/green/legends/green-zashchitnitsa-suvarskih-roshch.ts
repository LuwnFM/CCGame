/** Immutable card identity: green-защитница-суварских-рощ. Edit stats and effect data here. */
export default {
  "id": "green-защитница-суварских-рощ",
  "name": "Защитница суварских рощ",
  "kind": "legend",
  "aspects": [
    "green"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "green": 1
    },
    "generic": 5
  },
  "loyalty": 5,
  "loyaltyAbilities": [
    {
      "kind": "mendTeam",
      "amount": 1,
      "delta": 1
    },
    {
      "kind": "recoverCreature",
      "amount": 1,
      "delta": -2
    }
  ],
  "loyaltyAbility": {
    "kind": "recoverCreature",
    "amount": 1,
    "delta": -2
  },
  "lore": {
    "state": "Королевство Сувар",
    "organization": "Дом Кайров",
    "summary": "Защитница суварских рощ ведёт Дом Кайров в сражении."
  }
};
