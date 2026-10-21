/** Immutable card identity: blue-летописец-флотилии. Edit stats and effect data here. */
export default {
  "id": "blue-летописец-флотилии",
  "name": "Летописец флотилии",
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
  "attack": 2,
  "health": 2,
  "onEntry": {
    "kind": "draw",
    "amount": 1
  },
  "lore": {
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Летописец флотилии выступает на стороне Воздушная флотилия."
  }
};
