import {RuleError} from '../errors.ts';
import type {Card,Game,PlayerId} from '../model/index.ts';
import {registerEffect,invokeEffect} from './effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard} from './zones.ts';
import {emitGameEvent,onGameEvent} from './events.ts';
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
const numeric=(n:number,max:number)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
/** The entry/revival trigger is processed by the shared deterministic event queue. */
onGameEvent('enter',(game,event)=>{
  const card=event.source;
  if(!card)return; // informational enter events without a card cannot fire effects
  const effect=event.from==='discard'?card.secondChance:card.onEntry;
  if(!effect)return;
  invokeEffect('entry',effect.kind,{game,actor:event.owner,source:card,
    amount:'amount'in effect?effect.amount:undefined,
    cards:'cards'in effect?effect.cards:undefined,targetId:event.targetId});
});
export function enterTrigger(game:Game,actor:PlayerId,card:Card,origin:'hand'|'discard',targetId?:number):void{
  emitGameEvent(game,{type:'enter',owner:actor,cardId:card.id,source:card,from:origin,to:'main',targetId});
}
export function resolveTechnique(game:Game,actor:PlayerId,card:Card,command:{targetId?:number;discardIndex?:number}):void{
  const effect=card.techniqueEffect;
  requireRule(effect,'Техника не содержит эффекта');
  invokeEffect('technique',effect.kind,{game,actor,source:card,amount:effect.amount,...command});
}
