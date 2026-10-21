/** Immutable card identity: blue-адмирал-талдрейкского-неба. Edit stats and effect data here. */
export default {
  "id": "blue-адмирал-талдрейкского-неба",
  "name": "Адмирал талдрейкского неба",
  "kind": "legend",
  "aspects": [
    "blue"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "blue": 1
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
          "id": "blue-wing-token",
          "name": "Крылатый вестник",
          "kind": "creature",
          "aspects": [
            "blue"
          ],
          "attack": 1,
          "health": 1,
          "createdToken": true,
          "flying": true,
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
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Адмирал талдрейкского неба ведёт Воздушная флотилия в сражении."
  }
};
