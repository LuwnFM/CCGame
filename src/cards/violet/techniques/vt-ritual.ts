/** Immutable card identity: vt-ritual. Edit stats and effect data here. */
export default {
  "id": "vt-ritual",
  "name": "Призыв забытой реликвии",
  "kind": "technique",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 2
  },
  "ritual": {
    "color": "violet",
    "threshold": 3,
    "duration": 2,
    "rewardPool": [
      {
        "id": "vt-echo",
        "name": "Дворянский призрак Ван Троупов",
        "nameEn": "Van Troupe Noble Ghost",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 4,
        "health": 4,
        "shield": 1,
        "lore": {
          "state": "Искажение",
          "organization": "Дом Ван Троуп",
          "summary": "Дворянский призрак Ван Троупов откликается на ритуал сокровищницы.",
          "note": "Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация."
        }
      },
      {
        "id": "vt-mechanism",
        "name": "Некроартофакт Ван Троупов",
        "nameEn": "Van Troupe Necro-Artifice",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 5,
        "health": 3,
        "firstStrike": true,
        "lore": {
          "state": "Искажение",
          "organization": "Дом Ван Троуп",
          "summary": "Некроартофакт Ван Троупов откликается на ритуал сокровищницы.",
          "note": "Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация."
        }
      },
      {
        "id": "vt-guardian",
        "name": "Реликтовый страж Ван Троупов",
        "nameEn": "Van Troupe Relic Sentinel",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 3,
        "health": 6,
        "guard": true,
        "lore": {
          "state": "Искажение",
          "organization": "Дом Ван Троуп",
          "summary": "Реликтовый страж Ван Троупов откликается на ритуал сокровищницы.",
          "note": "Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация."
        }
      },
      {
        "id": "vt-specter",
        "name": "Умертвие родовой крипты",
        "nameEn": "Ancestral Crypt Revenant",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 4,
        "health": 4,
        "lifesteal": true,
        "lore": {
          "state": "Искажение",
          "organization": "Дом Ван Троуп",
          "summary": "Умертвие родовой крипты откликается на ритуал сокровищницы.",
          "note": "Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация."
        }
      },
      {
        "id": "vt-spark",
        "name": "Искра фамильной сокровищницы",
        "nameEn": "Family Vault Spark",
        "kind": "creature",
        "aspects": [
          "violet"
        ],
        "attack": 3,
        "health": 3,
        "createdToken": true,
        "poisonHit": {
          "strength": 1,
          "ticks": 2
        },
        "lore": {
          "state": "Искажение",
          "organization": "Дом Ван Троуп",
          "summary": "Искра фамильной сокровищницы откликается на ритуал сокровищницы.",
          "note": "Награда ритуала из сокровищницы и некромантских артофактов Ван Троупов; название — игровая адаптация."
        }
      }
    ]
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Культ приносит Жертв ради реликвии из сокровищницы."
  }
};
