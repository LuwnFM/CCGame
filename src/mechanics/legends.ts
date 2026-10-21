import {RuleError,sendToDiscard,type Command,type Game,type PlayerId} from '../core.ts';
import {eligibleVictims} from '../ritual.ts';
import {finishIfLethal} from './death-queue.ts';
import {invokeEffect,registerEffect} from './effects-registry.ts';
import {drawCards,summon,transferCard,departPermanent} from './zones.ts';
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
const number=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=8;
/** Legendary actions are validated once, then resolved through the same registry as card effects. */
export function activateLegend(next:Game,command:Extract<Command,{type:'activateLegend'}>):void{
  const p=next.players[command.actor];
  requireRule(next.turn>0&&next.phase==='main','Недоступная фаза');
  const legend=p.legends.find(unit=>unit.objectId===command.objectId);
  const choices=legend?.card.loyaltyAbilities?.length?legend.card.loyaltyAbilities:
    legend?.card.loyaltyAbility?[legend.card.loyaltyAbility]:[];
  const index=command.abilityIndex??(legend?.card.loyaltyAbilities?.length?1:0);
  const effect=Number.isSafeInteger(index)&&index>=0?choices[index]:undefined;
  requireRule(legend&&effect&&legend.lastActivatedTurn!==next.turn&&
    !legend.stunned&&!legend.stasis&&!legend.silenced,'Способность Легенды недоступна');
  requireRule(Number.isSafeInteger(effect.delta)&&
    (effect.kind==='summon'?Array.isArray(effect.cards):number(effect.amount)),
    'Неверная способность');
  requireRule(legend.loyalty!+effect.delta>=0,'Не хватает Лояльности');
  // The command applies to a cloned Game; invalid effects roll back loyalty and payment.
  legend.loyalty!+=effect.delta;
  legend.lastActivatedTurn=next.turn;
  invokeEffect('loyalty',effect.kind,{game:next,actor:command.actor,source:legend.card,
    amount:'amount'in effect?effect.amount:undefined,
    cards:'cards'in effect?effect.cards:undefined,
    completeRitual:'completeRitual'in effect?effect.completeRitual:undefined,
    discardIndex:command.discardIndex});
  if(legend.loyalty===0){
    departPermanent(next,command.actor,legend.objectId,['legends']);
  }
  finishIfLethal(next);
}
