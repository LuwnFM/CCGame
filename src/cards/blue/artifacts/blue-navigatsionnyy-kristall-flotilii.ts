/** Immutable card identity: blue-навигационный-кристалл-флотилии. Edit stats and effect data here. */
export default {
  "id": "blue-навигационный-кристалл-флотилии",
  "name": "Навигационный кристалл флотилии",
  "kind": "artifact",
  "aspects": [
    "blue"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "blue": 1
    },
    "generic": 4
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Навигационный кристалл флотилии укрепляет бойцов Воздушная флотилия."
  },
  "turnStartEffect": {
    "kind": "drawIfLowHand",
    "amount": 1
  }
};
