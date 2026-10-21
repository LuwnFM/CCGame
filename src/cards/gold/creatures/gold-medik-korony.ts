/** Immutable card identity: gold-медик-короны. Edit stats and effect data here. */
export default {
  "id": "gold-медик-короны",
  "name": "Медик короны",
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
  "health": 4,
  "onEntry": {
    "kind": "healRuler",
    "amount": 2
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Медик короны выступает на стороне Королевские рыцари."
  }
};
