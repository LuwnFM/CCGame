import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
import {isValidAmount as valid,requireRule} from '../rules/validation.ts';
registerEffect('loyalty','recoverCreature',({game,actor,discardIndex})=>{
 const owner=game.players[actor];
 requireRule(Number.isSafeInteger(discardIndex)&&owner.discard[discardIndex!]?.kind==='creature','Выберите Существо из сброса для возвращения в руку');
 transferCard(game,actor,'discard','hand',discardIndex!);
});
