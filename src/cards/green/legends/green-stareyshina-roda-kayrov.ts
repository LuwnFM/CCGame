/** Immutable card identity: green-старейшина-рода-кайров. Edit stats and effect data here. */
export default {
  "id": "green-старейшина-рода-кайров",
  "name": "Старейшина рода Кайров",
  "kind": "legend",
  "aspects": [
    "green"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "green": 1
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
          "id": "green-thorn-token",
          "name": "Терновый зверёк",
          "kind": "creature",
          "aspects": [
            "green"
          ],
          "attack": 1,
          "health": 1,
          "createdToken": true,
          "poisonHit": {
            "strength": 1,
            "ticks": 2
          },
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
    "state": "Королевство Сувар",
    "organization": "Дом Кайров",
    "summary": "Старейшина рода Кайров ведёт Дом Кайров в сражении."
  }
};
