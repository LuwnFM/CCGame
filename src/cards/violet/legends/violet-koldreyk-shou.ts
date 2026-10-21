/** Immutable card identity: violet-колдрейк-шоу. Edit stats and effect data here. */
export default {
  "id": "violet-колдрейк-шоу",
  "name": "Колдрейк Шоу",
  "nameEn": "Coldrake Shaw",
  "kind": "legend",
  "aspects": [
    "violet"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 4
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "healRuler",
      "amount": 1
    },
    {
      "delta": -2,
      "kind": "recoverCreature",
      "amount": 1
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "recoverCreature",
    "amount": 1
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Лич Колдрейк Шоу возвращает погибших слуг в строй.",
    "note": "Колдрейк Шоу — лич. Возвращает Существо из сброса в руку; игровая трактовка некромантии."
  }
};
