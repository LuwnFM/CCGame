/** Immutable card identity: neutral-верховный-хранитель-данте. Edit stats and effect data here. */
export default {
  "id": "neutral-верховный-хранитель-данте",
  "name": "Верховный хранитель Данте",
  "kind": "legend",
  "aspects": [],
  "unique": true,
  "cost": {
    "colored": {},
    "generic": 5
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [
        {
          "id": "neutral-watch-token",
          "name": "Часовой Ордена",
          "kind": "creature",
          "aspects": [],
          "attack": 1,
          "health": 1,
          "createdToken": true,
          "guard": true,
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
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Верховный хранитель Данте ведёт Новые хранители в сражении."
  }
};
