import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
import {isValidAmount as valid,requireRule} from '../rules/validation.ts';
registerEffect('technique','reanimate',({game,actor,discardIndex})=>{
 const owner=game.players[actor];
 requireRule(Number.isSafeInteger(discardIndex)&&owner.discard[discardIndex!]?.kind==='creature','Выберите Существо из сброса');
 requireRule(owner.main.length<8,'Нет места для воскрешённого Существа');
 const card=takeCard(owner,'discard',discardIndex!,game,actor);
 const unit=placePermanent(game,actor,'main',card);
 emitGameEvent(game,{type:'revive',owner:actor,cardId:card.id,objectId:unit.objectId,from:'discard',to:'main'});
 enterTrigger(game,actor,card,'discard');
});
