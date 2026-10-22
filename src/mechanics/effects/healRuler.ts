import {RuleError} from '../../errors.ts';
import type {PlayerId} from '../../model/index.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
for(const channel of ['entry','technique','loyalty'] as const)registerEffect(channel,'healRuler',({game,actor,amount})=>{
 requireRule(valid(amount!,channel==='entry'?4:8),'Неверное лечение');
 game.players[actor].hp=Math.min(30,game.players[actor].hp+amount!);
});
