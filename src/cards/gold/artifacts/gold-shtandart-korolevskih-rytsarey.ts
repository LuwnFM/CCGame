/** Immutable card identity: gold-штандарт-королевских-рыцарей. Edit stats and effect data here. */
export default {
  "id": "gold-штандарт-королевских-рыцарей",
  "name": "Штандарт королевских рыцарей",
  "kind": "artifact",
  "aspects": [
    "gold"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 3
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Штандарт королевских рыцарей укрепляет бойцов Королевские рыцари."
  },
  "turnStartEffect": {
    "kind": "shieldTeam",
    "amount": 1
  }
};
