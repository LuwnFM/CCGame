import type {Card} from '../core.ts';

function token(id:string,name:string,attack:number,health:number,aspects:Card['aspects'],traits:Partial<Card>={}):Card {
  return {id,name,kind:'creature',aspects,attack,health,createdToken:true,...traits,
    lore:{state:'Игровой призыв',organization:'Призванные существа',
      summary:'Призванное существо создаётся общим эффектом Призыв и стирается вместо Сброса.'}};
}
/** All token properties live in card data, not in the summon executor. */
export const SKELETON=token('violet-skeleton-token','Призванный скелет',1,1,['violet'],{sacrifice:true});
export const BONE_BLADE=token('violet-bone-blade','Костяной клинок',2,1,['violet'],{sacrifice:true});
export const BONE_GUARD=token('violet-bone-guard','Костяной заслон',1,2,['violet'],{sacrifice:true});
export const CERA_SERVANT=token('vt-cera-ritual-servant','Умертвие свиты Церы',2,2,['violet'],{sacrifice:true,nameEn:'Cera’s Undead Retainer'});
export const SIGNATURE_TOKENS:Record<'red'|'blue'|'green'|'gold'|'violet'|'neutral',Card>={
  red:token('red-scout-token','Штурмовой новобранец',1,1,['red'],{haste:true}),
  blue:token('blue-wing-token','Крылатый вестник',1,1,['blue'],{flying:true}),
  green:token('green-thorn-token','Терновый зверёк',1,1,['green'],{poisonHit:{strength:1,ticks:2}}),
  gold:token('gold-shield-token','Щитоносец Ивелтина',0,1,['gold'],{guard:true,shield:2,cannotAttack:true}),
  violet:token('violet-sacrifice-token','Слуга некроманта',1,1,['violet'],{sacrifice:true}),
  neutral:token('neutral-watch-token','Часовой Ордена',1,1,[],{guard:true}),
};
