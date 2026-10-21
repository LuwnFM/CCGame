/** Immutable card identity: violet-ученик-некроманта. Edit stats and effect data here. */
export default {
  "id": "violet-ученик-некроманта",
  "name": "Ученик Некроманта",
  "kind": "creature",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 4
  },
  "attack": 2,
  "health": 3,
  "onEntry": {
    "kind": "summon",
    "cards": [
      {
        "id": "violet-bone-blade",
        "name": "Костяной клинок",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 2,
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
        "id": "violet-bone-guard",
        "name": "Костяной заслон",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 1,
        "health": 2,
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
      }
    ]
  },
  "sacrifice": true,
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Ученик Некроманта служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
