/** Immutable card identity: red-снабженец-горной-стражи. Edit stats and effect data here. */
export default {
  "id": "red-снабженец-горной-стражи",
  "name": "Снабженец горной стражи",
  "kind": "creature",
  "aspects": [
    "red"
  ],
  "cost": {
    "colored": {
      "red": 1
    },
    "generic": 3
  },
  "attack": 3,
  "health": 3,
  "onEntry": {
    "kind": "draw",
    "amount": 1
  },
  "lore": {
    "state": "Стальное королевство",
    "organization": "Горная стража",
    "summary": "Снабженец горной стражи выступает на стороне Горная стража."
  }
};
