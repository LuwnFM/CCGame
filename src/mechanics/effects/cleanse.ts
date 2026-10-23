import {mayTargetWithEffect} from '../traits/majestic.ts';
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
registerEffect('technique','cleanse',({game,actor,amount,targetId})=>{
 requireRule(valid(amount!),'Неверная Техника');
 const p=game.players[actor],target=[...p.main,...p.auxiliary,...p.legends].find(u=>u.objectId===targetId);
 requireRule(target && mayTargetWithEffect(target),'Выберите допустимое Существо');
 target.poison=undefined;target.stunned=false;target.stasis=undefined;target.silenced=false;
});
