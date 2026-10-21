import SCOUT from '../../tokens/red-scout.ts';
/** Immutable card identity: red-командор-стального-рубежа. Edit stats and effect data here. */
export default {
  "id": "red-командор-стального-рубежа",
  "name": "Командор стального рубежа",
  "kind": "legend",
  "aspects": [
    "red"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "red": 1
    },
    "generic": 4
  },
  "loyalty": 4,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [SCOUT]
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
    "state": "Стальное королевство",
    "organization": "Горная стража",
    "summary": "Командор стального рубежа ведёт Горная стража в сражении."
  }
};
