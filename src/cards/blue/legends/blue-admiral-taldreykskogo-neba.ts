import WING from '../../tokens/blue-wing.ts';
/** Immutable card identity: blue-адмирал-талдрейкского-неба. Edit stats and effect data here. */
export default {
  "id": "blue-адмирал-талдрейкского-неба",
  "name": "Адмирал талдрейкского неба",
  "kind": "legend",
  "aspects": [
    "blue"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "blue": 1
    },
    "generic": 4
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [WING]
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
    "state": "Талдрейк",
    "organization": "Воздушная флотилия",
    "summary": "Адмирал талдрейкского неба ведёт Воздушная флотилия в сражении."
  }
};
