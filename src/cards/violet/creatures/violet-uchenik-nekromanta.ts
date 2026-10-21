import BONE_BLADE from '../../tokens/violet-bone-blade.ts';
import BONE_GUARD from '../../tokens/violet-bone-guard.ts';
import SKELETON from '../../tokens/violet-skeleton.ts';
/** Immutable card identity: violet-ученик-некроманта. Edit stats and effect data here. */
export default {
  "id": "violet-ученик-некроманта",
  "name": "Ученик Некроманта",
  "kind": "creature",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 4
  },
  "attack": 2,
  "health": 3,
  "onEntry": {
    "kind": "summon",
    "cards": [BONE_BLADE, BONE_GUARD]
  },
  "secondChance": {
    "kind": "summon",
    "cards": [SKELETON]
  },
  "sacrifice": true,
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Ученик Некроманта служит дому Ван Троупов в Искажении.",
    "note": "Слуга культа Ван Троупов: нежить, культ или реликтовая механика; игровая интерпретация."
  }
};
