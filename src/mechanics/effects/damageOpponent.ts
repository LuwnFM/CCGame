import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
import {isValidAmount as valid,requireRule} from '../rules/validation.ts';
for(const channel of ['technique','loyalty','death'] as const)registerEffect(channel,'damageOpponent',({game,actor,amount})=>{
 requireRule(valid(amount!,8),'Неверный урон');
 game.players[(1-actor) as PlayerId].hp-=amount!;
});
