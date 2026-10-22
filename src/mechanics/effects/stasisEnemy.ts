import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
registerEffect('entry','stasisEnemy',({game,actor,amount,targetId})=>{
 requireRule(valid(amount!,4),'Неверное количество контроля');
 const enemy=game.players[(1-actor) as PlayerId];
 const targets=[...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature'&&!u.stasis);
 if(targets.length){
  requireRule(Number.isSafeInteger(targetId),'Выберите цель синего контроля');
  const target=targets.find(u=>u.objectId===targetId);
  requireRule(target,'Недоступная цель синего контроля');
  target.stasis=amount;
 }else requireRule(targetId===undefined,'Нет допустимой цели контроля');
});
