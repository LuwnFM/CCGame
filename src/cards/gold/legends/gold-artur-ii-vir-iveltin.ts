/** Immutable card identity: gold-артур-ii-вир-ивелтин. Edit stats and effect data here. */
export default {
  "id": "gold-артур-ii-вир-ивелтин",
  "name": "Артур II вир Ивелтин",
  "kind": "legend",
  "aspects": [
    "gold"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "gold": 1
    },
    "generic": 4
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [
        {
          "id": "gold-shield-token",
          "name": "Щитоносец Ивелтина",
          "kind": "creature",
          "aspects": [
            "gold"
          ],
          "attack": 0,
          "health": 1,
          "createdToken": true,
          "guard": true,
          "shield": 2,
          "cannotAttack": true,
          "lore": {
            "state": "Игровой призыв",
            "organization": "Призванные существа",
            "summary": "Призванное существо создаётся общим эффектом Призыв и стирается вместо Сброса."
          }
        }
      ]
    },
    {
      "delta": -2,
      "kind": "healRuler",
      "amount": 4
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "healRuler",
    "amount": 4
  },
  "lore": {
    "state": "Королевство Ивелтин",
    "organization": "Королевские рыцари",
    "summary": "Артур II вир Ивелтин ведёт Королевские рыцари в сражении."
  }
};
