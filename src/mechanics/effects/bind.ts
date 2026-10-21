import {RuleError,type PlayerId} from '../../core.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
registerEffect('technique','bind',({game,actor,amount,targetId})=>{
 requireRule(valid(amount!),'Неверная Техника');
 const p=game.players[(1-actor) as PlayerId],target=[...p.main,...p.auxiliary].find(u=>u.objectId===targetId&&u.card.kind==='creature');
 requireRule(target,'Выберите допустимое Существо');
 if(target.stunned||target.stasis){target.stunned=false;target.stasis=amount;}
 else target.stunned=true;
});
