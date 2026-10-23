/** Immutable card identity: neutral-странствующий-хранитель. Edit stats and effect data here. */
export default {
  "id": "neutral-странствующий-хранитель",
  "name": "Странствующий хранитель",
  "kind": "creature",
  "aspects": [],
  "cost": {
    "colored": {},
    "generic": 4
  },
  "attack": 1,
  "health": 4,
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Странствующий хранитель выступает на стороне Новые хранители."
  },
  "onEntry": {
    "kind": "stasisEnemy",
    "amount": 1
  },
  "neutralAffinity": {
    "zone": "battlefield",
    "bonus": 1
  }
};
