import {onGameEvent} from './events.ts';
import {invokeEffect} from './effects-registry.ts';
/** Passive items trigger once at their controller's start; silence/stasis suppress them. */
onGameEvent('turnStart',(game,event)=>{
 for(const unit of game.players[event.owner].auxiliary){
  const effect=unit.card.turnStartEffect;
  if(!effect||unit.silenced||unit.stasis)continue;
  if(effect.kind==='drawWithPain'&&game.players[event.owner].hp<=effect.amount)continue;
  invokeEffect('entry',effect.kind,{game,actor:event.owner,source:unit.card,
   amount:'amount'in effect?effect.amount:undefined,cards:'cards'in effect?effect.cards:undefined});
 }
});
