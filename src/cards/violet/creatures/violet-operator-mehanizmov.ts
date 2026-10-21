/** Immutable card identity: violet-оператор-механизмов. Edit stats and effect data here. */
export default {
  "id": "violet-оператор-механизмов",
  "name": "Оператор механизмов",
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
  "health": 4,
  "sacrifice": true,
  "onDeath": {
    "kind": "damageAllCreatures",
    "amount": 1
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Оператор механизмов служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
