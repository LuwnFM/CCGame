import SKELETON from '../../tokens/violet-skeleton.ts';
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
    "cards": [SKELETON, SKELETON]
  },
  "sacrifice": true,
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Некромант родовой крипты служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
