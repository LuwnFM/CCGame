import {RuleError,type PlayerId} from '../../core.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
registerEffect('death','damageAllCreatures',({game,amount})=>{
 requireRule(valid(amount!),'Неверный эффект гибели');
 for(const side of game.players)for(const unit of [...side.main,...side.auxiliary])damage(unit,amount!);
});
