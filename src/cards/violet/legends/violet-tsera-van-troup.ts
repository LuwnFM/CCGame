import SACRIFICE from '../../tokens/violet-sacrifice.ts';
import CERA_SERVANT from '../../tokens/violet-cera-servant.ts';
/** Immutable card identity: violet-цера-ван-троуп. Edit stats and effect data here. */
export default {
  "id": "violet-цера-ван-троуп",
  "name": "Цера Ван Троуп",
  "nameEn": "Cera Van Troupe",
  "kind": "legend",
  "aspects": [
    "violet"
  ],
  "unique": true,
  "cost": {
    "colored": {
      "violet": 1
    },
    "generic": 5
  },
  "loyalty": 5,
  "ritualDrawBonus": 1,
  "loyaltyAbilities": [
    {
      "delta": 1,
      "kind": "summon",
      "cards": [SACRIFICE]
    },
    {
      "delta": -2,
      "kind": "summon",
      "cards": [CERA_SERVANT],
      "completeRitual": true
    }
  ],
  "loyaltyAbility": {
    "delta": -2,
    "kind": "summon",
    "cards": [CERA_SERVANT],
    "completeRitual": true
  },
  "lore": {
    "state": "Сепер (игровая привязка альфы)",
    "organization": "Ван Троупы",
    "summary": "Цера Ван Троуп собирает ритуальную свиту умертвий.",
    "note": "Цера Ван Троуп — девушка, умертвие-некромант дома Ван Троуп; создаёт ритуальную Жертву и даёт дополнительный добор при исполнении Ритуала."
  }
};
