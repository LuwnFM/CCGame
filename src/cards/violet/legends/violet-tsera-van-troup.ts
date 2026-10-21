/** Immutable card identity: violet-цера-ван-троуп. Edit stats and effect data here. */
export default {
  "id": "violet-цера-ван-троуп",
  "name": "Цера Ван Троуп",
  "nameEn": "Cera Van Troupe",
  "kind": "legend",
  "aspects": [
    "violet"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 5
  },
  "loyalty": 5,
  "ritualDrawBonus": 1,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [
        {
          "id": "violet-sacrifice-token",
          "name": "Слуга некроманта",
          "kind": "creature",
          "aspects": [
            "violet"
          ],
          "attack": 1,
          "health": 1,
          "createdToken": true,
          "sacrifice": true,
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
      "kind": "summon",
      "cards": [
        {
          "id": "vt-cera-ritual-servant",
          "name": "Умертвие свиты Церы",
          "kind": "creature",
          "aspects": [
            "violet"
          ],
          "attack": 2,
          "health": 2,
          "createdToken": true,
          "sacrifice": true,
          "nameEn": "Cera’s Undead Retainer",
          "lore": {
            "state": "Игровой призыв",
            "organization": "Призванные существа",
            "summary": "Призванное существо создаётся общим эффектом Призыв и стирается вместо Сброса."
          }
        }
      ],
      "completeRitual": true
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "summon",
    "cards": [
      {
        "id": "vt-cera-ritual-servant",
        "name": "Умертвие свиты Церы",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 2,
        "health": 2,
        "createdToken": true,
        "sacrifice": true,
        "nameEn": "Cera’s Undead Retainer",
        "lore": {
          "state": "Игровой призыв",
          "organization": "Призванные существа",
          "summary": "Призванное существо создаётся общим эффектом Призыв и стирается вместо Сброса."
        }
      }
    ],
    "completeRitual": true
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Цера Ван Троуп собирает ритуальную свиту умертвий.",
    "note": "Цера Ван Троуп — девушка, умертвие-некромант дома Ван Троуп; создаёт ритуальную Жертву и даёт дополнительный добор при исполнении Ритуала."
  }
};
