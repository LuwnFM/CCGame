import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
for(const channel of ['entry','technique','loyalty'] as const)registerEffect(channel,'mendTeam',({game,actor,amount})=>{
 requireRule(isValidAmount(amount,8),'Неверная величина эффекта');
 const owner=game.players[actor];
 for(const unit of [...owner.main,...owner.auxiliary].filter(x=>x.card.kind==='creature'))unit.damage=Math.max(0,unit.damage-amount!);
});
