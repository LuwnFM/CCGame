/** Immutable card identity: neutral-полевое-знамя-ордена. Edit stats and effect data here. */
export default {
  "id": "neutral-полевое-знамя-ордена",
  "name": "Полевое знамя Ордена",
  "kind": "artifact",
  "aspects": [],
  "unique": true,
  "cost": {
    "colored": {},
    "generic": 3
  },
  "lore": {
    "state": "Межгосударственный орден",
    "organization": "Новые хранители",
    "summary": "Полевое знамя Ордена укрепляет бойцов Новые хранители."
  },
  "turnStartEffect": {
    "kind": "healRuler",
    "amount": 1
  },
  "neutralAffinity": {
    "zone": "battlefield",
    "bonus": 1
  }
};
