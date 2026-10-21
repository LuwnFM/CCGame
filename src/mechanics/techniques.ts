import {RuleError,type Card,type Game,type PlayerId} from '../core.ts';
import {registerEffect,invokeEffect} from './effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard} from './zones.ts';
import {emitGameEvent,onGameEvent} from './events.ts';
import {SKELETON,BONE_BLADE,BONE_GUARD} from '../cards/tokens.ts';
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
const numeric=(n:number,max:number)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
for(const channel of ['entry','technique'] as const){
  registerEffect(channel,'healRuler',({game,actor,amount})=>{
    requireRule(numeric(amount!,channel==='entry'?4:8),'Неверное лечение');
    game.players[actor].hp=Math.min(30,game.players[actor].hp+amount!);
  });
  registerEffect(channel,'draw',({game,actor,amount})=>{
    requireRule(numeric(amount!,channel==='entry'?4:8),'Неверный добор');
    drawCards(game.players[actor],amount!);
  });
}
registerEffect('entry','summon',({game,actor,cards})=>summon(game,actor,cards??[]));
// Legacy aliases are registered once, not copied into new cards.
registerEffect('entry','summonSkeleton',({game,actor,amount})=>{
  requireRule(numeric(amount!,4),'Неверное число скелетов');
  summon(game,actor,Array.from({length:amount!},()=>SKELETON));
});
registerEffect('entry','summonBonePair',({game,actor,amount})=>{
  requireRule(amount===2,'Неверная костяная пара');
  summon(game,actor,[BONE_BLADE,BONE_GUARD]);
});
for(const kind of ['stunEnemy','stasisEnemy'] as const){
  registerEffect('entry',kind,({game,actor,amount,targetId})=>{
    requireRule(numeric(amount!,4),'Неверное количество контроля');
    const enemy=game.players[(1-actor) as PlayerId];
    const targets=[...enemy.main,...enemy.auxiliary].filter(x=>x.card.kind==='creature'&&!x.stasis&&(kind==='stasisEnemy'||!x.stunned));
    if(targets.length){
      requireRule(Number.isSafeInteger(targetId),'Выберите цель синего контроля');
      const target=targets.find(x=>x.objectId===targetId);
      requireRule(target,'Недоступная цель синего контроля');
      if(kind==='stunEnemy')target.stunned=true;
      else target.stasis=amount;
    }else requireRule(targetId===undefined,'Нет допустимой цели контроля');
  });
}
registerEffect('technique','damageOpponent',({game,actor,amount})=>{
  requireRule(numeric(amount!,8),'Неверный урон');
  game.players[(1-actor) as PlayerId].hp-=amount!;
});
registerEffect('technique','reanimate',({game,actor,discardIndex})=>{
  const owner=game.players[actor];
  requireRule(Number.isSafeInteger(discardIndex)&&owner.discard[discardIndex!]?.kind==='creature',
    'Выберите Существо из сброса');
  requireRule(owner.main.length<8,'Нет места для воскрешённого Существа');
  const card=takeCard(owner,'discard',discardIndex!);
  const unit=placePermanent(game,actor,'main',card);
  emitGameEvent(game,{type:'revive',owner:actor,cardId:card.id,objectId:unit.objectId,from:'discard',to:'main'});
  enterTrigger(game,actor,card,'discard');
});
for(const kind of ['cleanse','ward','silence','bind'] as const){
  registerEffect('technique',kind,({game,actor,amount,targetId})=>{
    requireRule(numeric(amount!,8),'Неверная Техника');
    const enemy=kind==='silence'||kind==='bind';
    const side=game.players[enemy?(1-actor) as PlayerId:actor];
    const target=(kind==='bind'?[...side.main,...side.auxiliary]:[...side.main,...side.auxiliary,...side.legends])
      .find(u=>u.objectId===targetId&&(kind!=='bind'||u.card.kind==='creature'));
    requireRule(target,'Выберите допустимое Существо');
    if(kind==='cleanse'){target.poison=undefined;target.stunned=false;target.stasis=undefined;target.silenced=false;}
    else if(kind==='ward')throw new RuleError('Оберег ещё не реализован; это не Щит');
    else if(kind==='silence')target.silenced=true;
    else {if(target.stunned||target.stasis){target.stunned=false;target.stasis=amount;}else target.stunned=true;}
  });
}
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
