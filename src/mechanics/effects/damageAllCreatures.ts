import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
import {isValidAmount as valid,requireRule} from '../rules/validation.ts';
registerEffect('death','damageAllCreatures',({game,amount})=>{
 requireRule(valid(amount!),'Неверный эффект гибели');
 for(const side of game.players)for(const unit of [...side.main,...side.auxiliary])damage(unit,amount!);
});
