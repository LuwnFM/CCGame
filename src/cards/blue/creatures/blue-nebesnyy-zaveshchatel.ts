/** Immutable card identity: blue-небесный-завещатель. Edit stats and effect data here. */
export default {
  "id": "blue-небесный-завещатель",
  "name": "Небесный завещатель",
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
  "health": 3,
  "flying": true,
  "onDeath": {
    "kind": "damageOpponent",
    "amount": 1
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Небесный завещатель выступает на стороне Воздушная флотилия."
  }
};
