/** Immutable card identity: gold-госпитальер-короны. Edit stats and effect data here. */
export default {
  "id": "gold-госпитальер-короны",
  "name": "Госпитальер короны",
  "kind": "creature",
  "aspects": [
    "gold"
  ],
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 2
  },
  "attack": 2,
  "health": 3,
  "onEntry": {
    "kind": "healRuler",
    "amount": 2
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Госпитальер короны выступает на стороне Королевские рыцари."
  }
};
