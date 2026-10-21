/** Immutable card identity: blue-капитан-флотилии. Edit stats and effect data here. */
export default {
  "id": "blue-капитан-флотилии",
  "name": "Капитан флотилии",
  "kind": "creature",
  "aspects": [
    "blue"
  ],
  "cost": {
    "colored": {
      "blue": 1
    },
    "generic": 3
  },
  "attack": 3,
  "health": 5,
  "guard": true,
  "onEntry": {
    "kind": "stasisEnemy",
    "amount": 1
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Капитан флотилии выступает на стороне Воздушная флотилия."
  }
};
