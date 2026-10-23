import {registerEffect} from '../effects-registry.ts';
import {requireChosenTarget} from '../rules/targets.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {damage} from '../combat.ts';
registerEffect('technique','damageCreature',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount),'Неверная величина урона');
 damage(requireChosenTarget(game,actor,targetId,{side:'enemy',creaturesOnly:true}),amount!);
});
