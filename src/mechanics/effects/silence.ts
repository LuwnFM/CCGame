import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {requireChosenTarget} from '../rules/targets.ts';

registerEffect('technique','silence',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount),'Неверная Техника');
 const target=requireChosenTarget(game,actor,targetId,{side:'enemy',includeLegends:true});
 target.silenced=true;
});
