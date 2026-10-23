import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
import {isValidAmount as valid,requireRule} from '../rules/validation.ts';
for(const channel of ['entry','technique','loyalty'] as const)registerEffect(channel,'draw',({game,actor,amount})=>{
 requireRule(valid(amount!,channel==='entry'?4:8),'Неверный добор');
 drawCards(game.players[actor],amount!,game,actor);
});
