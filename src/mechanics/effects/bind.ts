import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {requireChosenTarget} from '../rules/targets.ts';

registerEffect('technique','bind',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount),'Неверная Техника');
 const target=requireChosenTarget(game,actor,targetId,{side:'enemy',creaturesOnly:true});
 if(target.stunned||target.stasis){target.stunned=false;target.stasis=amount;}
 else target.stunned=true;
});
