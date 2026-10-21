import {RuleError,type PlayerId} from '../../core.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {SKELETON,BONE_BLADE,BONE_GUARD,CERA_SERVANT,SIGNATURE_TOKENS} from '../../cards/tokens.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
registerEffect('entry','stunEnemy',({game,actor,amount,targetId})=>{
 requireRule(valid(amount!,4),'Неверное количество контроля');
 const enemy=game.players[(1-actor) as PlayerId];
 const targets=[...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature'&&!u.stasis&&!u.stunned);
 if(targets.length){
  requireRule(Number.isSafeInteger(targetId),'Выберите цель синего контроля');
  const target=targets.find(u=>u.objectId===targetId);
  requireRule(target,'Недоступная цель синего контроля');
  target.stunned=true;
 }else requireRule(targetId===undefined,'Нет допустимой цели контроля');
});
