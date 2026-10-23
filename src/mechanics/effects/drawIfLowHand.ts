import {registerEffect} from '../effects-registry.ts';
import {requireRule,isValidAmount} from '../rules/validation.ts';
import {drawCards} from '../zones.ts';
for(const channel of ['entry','loyalty'] as const)registerEffect(channel,'drawIfLowHand',({game,actor,amount})=>{
 requireRule(isValidAmount(amount),'Неверный добор');
 const owner=game.players[actor];
 // Evaluate before the ordinary start-of-turn draw. This never forces a discard.
 if(owner.hand.length>3)return;
 drawCards(owner,amount!,game,actor);
});
