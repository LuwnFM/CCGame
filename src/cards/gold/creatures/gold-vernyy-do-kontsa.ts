/** Immutable card identity: gold-верный-до-конца. Edit stats and effect data here. */
export default {
  "id": "gold-верный-до-конца",
  "name": "Верный до конца",
  "kind": "creature",
  "aspects": [
    "gold"
  ],
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 3
  },
  "attack": 3,
  "health": 4,
  "guard": true,
  "onDeath": {
    "kind": "damageOpponent",
    "amount": 1
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Верный до конца выступает на стороне Королевские рыцари."
  }
};
