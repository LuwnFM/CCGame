import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {requireChosenTarget} from '../rules/targets.ts';

registerEffect('technique','cleanse',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount),'Неверная Техника');
 const target=requireChosenTarget(game,actor,targetId,{side:'own',includeLegends:true});
 target.poison=undefined;target.stunned=false;target.stasis=undefined;target.silenced=false;
});
