import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {eligibleChosenTargets,requireChosenTarget} from '../rules/targets.ts';

registerEffect('entry','stunEnemy',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount,4),'Неверное количество контроля');
 const policy={side:'enemy',creaturesOnly:true,unstasis:true,unstunned:true} as const;
 if(eligibleChosenTargets(game,actor,policy).length){
  requireRule(Number.isSafeInteger(targetId),'Выберите цель синего контроля');
  const target=requireChosenTarget(game,actor,targetId,policy,'Недоступная цель синего контроля');
  target.stunned=true;
 }else requireRule(targetId===undefined,'Нет допустимой цели контроля');
});
