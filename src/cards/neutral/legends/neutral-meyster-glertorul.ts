/** Immutable card identity: neutral-мейстер-глерторул. Edit stats and effect data here. */
export default {
  "id": "neutral-мейстер-глерторул",
  "name": "Мейстер Глерторул",
  "kind": "legend",
  "aspects": [],
  "unique": true,
  "cost": {
    "colored": {},
    "generic": 6
  },
  "loyalty": 5,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "healRuler",
      "amount": 1
    },
    {
      "delta": -2,
      "kind": "damageOpponent",
      "amount": 2
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "damageOpponent",
    "amount": 2
  },
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Мейстер Глерторул ведёт Новые хранители в сражении."
  }
};
