import {RuleError} from '../../errors.ts';
import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {requireChosenTarget} from '../rules/targets.ts';

registerEffect('technique','ward',({game,actor,amount,targetId})=>{
 requireRule(isValidAmount(amount),'Неверная Техника');
 requireChosenTarget(game,actor,targetId,{side:'own',includeLegends:true});
 throw new RuleError('Оберег ещё не реализован; это не Щит');
});
