import WATCH from '../../tokens/neutral-watch.ts';
/** Immutable card identity: neutral-верховный-хранитель-данте. Edit stats and effect data here. */
export default {
  "id": "neutral-верховный-хранитель-данте",
  "name": "Верховный хранитель Данте",
  "kind": "legend",
  "aspects": [],
  "unique": true,
  "cost": {
    "colored": {},
    "generic": 5
  },
  "loyalty": 4,
  "neutralAffinity": {"zone":"battlefield","bonus":1},
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [WATCH]
    },
    {
      "delta": -2,
      "kind": "mendTeam",
      "amount": 2
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "mendTeam",
    "amount": 2
  },
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Верховный хранитель Данте ведёт Новые хранители в сражении."
  }
};
