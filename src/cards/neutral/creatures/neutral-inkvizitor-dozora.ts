/** Immutable card identity: neutral-инквизитор-дозора. Edit stats and effect data here. */
export default {
  "id": "neutral-инквизитор-дозора",
  "name": "Инквизитор дозора",
  "kind": "creature",
  "aspects": [],
  "cost": {
    "colored": {},
    "generic": 3
  },
  "attack": 2,
  "health": 4,
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Инквизитор дозора выступает на стороне Новые хранители."
  },
  "onEntry": {
    "kind": "stunEnemy",
    "amount": 1
  }
};
