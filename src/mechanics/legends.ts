import {RuleError,sendToDiscard,type Command,type Game,type PlayerId} from '../core.ts';
import {eligibleVictims} from '../ritual.ts';
import {finishIfLethal} from './death-queue.ts';
import {invokeEffect,registerEffect} from './effects-registry.ts';
import {drawCards,summon,moveCard} from './zones.ts';
import {SIGNATURE_TOKENS,CERA_SERVANT} from '../cards/tokens.ts';
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
const number=(n:number)=>Number.isSafeInteger(n)&&n>=0&&n<=8;
registerEffect('loyalty','healRuler',({game,actor,amount})=>{
  requireRule(number(amount!),'Неверное лечение');
  game.players[actor].hp=Math.min(30,game.players[actor].hp+amount!);
});
registerEffect('loyalty','damageOpponent',({game,actor,amount})=>{
  requireRule(number(amount!),'Неверный урон');
  game.players[(1-actor) as PlayerId].hp-=amount!;
});
registerEffect('loyalty','draw',({game,actor,amount})=>{
  requireRule(number(amount!),'Неверный добор');
  drawCards(game.players[actor],amount!);
});
registerEffect('loyalty','recoverCreature',({game,actor,discardIndex})=>{
  const owner=game.players[actor];
  requireRule(Number.isSafeInteger(discardIndex)&&owner.discard[discardIndex!]?.kind==='creature',
    'Выберите Существо из сброса для возвращения в руку');
  moveCard(owner,'discard','hand',discardIndex!);
});
function completeOneRitual(next:Game,actor:PlayerId):void{
  const p=next.players[actor];
  const ready=p.rituals.find(effect=>eligibleVictims(p,effect.color).length>=effect.threshold);
  if(ready){
    next.readyRituals=[{effect:structuredClone(ready),eligibleIds:eligibleVictims(p,ready.color).map(u=>u.objectId)}];
    next.phase='ritual';
  }
}
registerEffect('loyalty','summon',({game,actor,cards,completeRitual})=>{
  requireRule(game.players[actor].auxiliary.length<4,'Нет свободного места для призыва');
  summon(game,actor,cards??[]);
  if(completeRitual)completeOneRitual(game,actor);
});
registerEffect('loyalty','summonSignature',({game,actor,source,amount})=>{
  requireRule(amount===1,'Неверное число сигнатурных токенов');
  requireRule(game.players[actor].auxiliary.length<4,'Нет свободного места для призыва');
  const aspect=source.aspects?.[0]??'neutral';
  const template=SIGNATURE_TOKENS[aspect as keyof typeof SIGNATURE_TOKENS];
  requireRule(template,'Неизвестный аспект токена');
  summon(game,actor,[template]);
});
registerEffect('loyalty','raiseSacrifice',({game,actor})=>{
  requireRule(game.players[actor].auxiliary.length<4,'Нет свободного места для призыва');
  summon(game,actor,[CERA_SERVANT]);
  completeOneRitual(game,actor);
});
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
    p.legends.splice(p.legends.indexOf(legend),1);
    sendToDiscard(p,legend.card);
  }
  finishIfLethal(next);
}
