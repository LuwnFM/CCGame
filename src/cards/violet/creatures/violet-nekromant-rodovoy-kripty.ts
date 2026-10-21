/** Immutable card identity: violet-некромант-родовой-крипты. Edit stats and effect data here. */
export default {
  "id": "violet-некромант-родовой-крипты",
  "name": "Некромант родовой крипты",
  "kind": "creature",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 3
  },
  "attack": 3,
  "health": 3,
  "secondChance": {
    "kind": "summon",
    "cards": [
      {
        "id": "violet-skeleton-token",
        "name": "Призванный скелет",
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
      },
      {
        "id": "violet-skeleton-token",
        "name": "Призванный скелет",
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
  "sacrifice": true,
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Некромант родовой крипты служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
