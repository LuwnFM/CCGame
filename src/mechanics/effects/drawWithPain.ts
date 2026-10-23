import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {drawCards} from '../zones.ts';
for(const channel of ['entry','technique','loyalty'] as const)registerEffect(channel,'drawWithPain',({game,actor,amount})=>{
 requireRule(isValidAmount(amount,8),'Неверная величина эффекта');
 const owner=game.players[actor];
 requireRule(owner.hp>amount!,'Недостаточно HP для добора');owner.hp-=amount!;drawCards(owner,amount!,game,actor);
});
