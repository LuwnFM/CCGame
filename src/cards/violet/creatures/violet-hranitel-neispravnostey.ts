/** Immutable card identity: violet-хранитель-неисправностей. Edit stats and effect data here. */
export default {
  "id": "violet-хранитель-неисправностей",
  "name": "Хранитель неисправностей",
  "kind": "creature",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 1
  },
  "attack": 2,
  "health": 3,
  "sacrifice": true,
  "onDeath": {
    "kind": "damageOpponent",
    "amount": 1
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Хранитель неисправностей служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
