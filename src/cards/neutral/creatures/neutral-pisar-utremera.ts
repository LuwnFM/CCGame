/** Immutable card identity: neutral-писарь-утремера. Edit stats and effect data here. */
export default {
  "id": "neutral-писарь-утремера",
  "name": "Писарь утремера",
  "kind": "creature",
  "aspects": [],
  "cost": {
    "colored": {},
    "generic": 2
  },
  "attack": 1,
  "health": 3,
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Писарь утремера выступает на стороне Новые хранители."
  },
  "onEntry": {
    "kind": "draw",
    "amount": 0
  },
  "neutralAffinity": {
    "zone": "hand",
    "bonus": 1
  }
};
