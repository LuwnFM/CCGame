/** Immutable card identity: blue-небесный-дуэлянт. Edit stats and effect data here. */
export default {
  "id": "blue-небесный-дуэлянт",
  "name": "Небесный дуэлянт",
  "kind": "creature",
  "aspects": [
    "blue"
  ],
  "cost": {
    "colored": {
      "blue": 1
    },
    "generic": 2
  },
  "attack": 3,
  "health": 3,
  "onEntry": {
    "kind": "stunEnemy",
    "amount": 1
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Небесный дуэлянт выступает на стороне Воздушная флотилия."
  }
};
