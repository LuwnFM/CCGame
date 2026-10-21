import REWARD_VT_ECHO from '../../rewards/vt-echo.ts';
import REWARD_VT_MECHANISM from '../../rewards/vt-mechanism.ts';
import REWARD_VT_GUARDIAN from '../../rewards/vt-guardian.ts';
import REWARD_VT_SPECTER from '../../rewards/vt-specter.ts';
import REWARD_VT_SPARK from '../../rewards/vt-spark.ts';
/** Immutable card identity: vt-ritual. Edit stats and effect data here. */
export default {
  "id": "vt-ritual",
  "name": "Призыв забытой реликвии",
  "kind": "technique",
  "aspects": [
    "violet"
  ],
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 2
  },
  "ritual": {
    "color": "violet",
    "threshold": 3,
    "duration": 2,
    "rewardPool": [REWARD_VT_ECHO, REWARD_VT_MECHANISM, REWARD_VT_GUARDIAN, REWARD_VT_SPECTER, REWARD_VT_SPARK]
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Культ приносит Жертв ради реликвии из сокровищницы."
  }
};
