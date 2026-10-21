import {RuleError,type PlayerId} from '../../core.ts';
import {registerEffect} from '../effects-registry.ts';
import {summon,drawCards,placePermanent,takeCard,transferCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {SKELETON,BONE_BLADE,BONE_GUARD,CERA_SERVANT,SIGNATURE_TOKENS} from '../../cards/tokens.ts';
import {eligibleVictims} from '../../ritual.ts';
import {damage} from '../combat.ts';
import {enterTrigger} from '../techniques.ts';
const valid=(amount:number,max=8)=>Number.isSafeInteger(amount)&&amount>=0&&amount<=max;
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
registerEffect('technique','silence',({game,actor,amount,targetId})=>{
 requireRule(valid(amount!),'Неверная Техника');
 const p=game.players[(1-actor) as PlayerId],target=[...p.main,...p.auxiliary,...p.legends].find(u=>u.objectId===targetId);
 requireRule(target,'Выберите допустимое Существо');
 target.silenced=true;
});
