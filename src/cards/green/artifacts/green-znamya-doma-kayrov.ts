/** Immutable card identity: green-знамя-дома-кайров. Edit stats and effect data here. */
export default {
  "id": "green-знамя-дома-кайров",
  "name": "Знамя дома Кайров",
  "kind": "artifact",
  "aspects": [
    "green"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "green": 1
    },
    "generic": 2
  },
  "lore": {
    "state": "Королевство Сувар",
    "organization": "Дом Кайров",
    "summary": "Знамя дома Кайров укрепляет бойцов Дом Кайров."
  },
  "turnStartEffect": {
    "kind": "mendTeam",
    "amount": 1
  }
};
