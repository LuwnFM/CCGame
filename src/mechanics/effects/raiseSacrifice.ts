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
registerEffect('loyalty','raiseSacrifice',({game,actor})=>{
 requireRule(game.players[actor].auxiliary.length<4,'Нет свободного места для призыва');
 summon(game,actor,[CERA_SERVANT]);
 const p=game.players[actor],ready=p.rituals.find(e=>eligibleVictims(p,e.color).length>=e.threshold);
 if(ready){game.readyRituals=[{effect:structuredClone(ready),eligibleIds:eligibleVictims(p,ready.color).map(u=>u.objectId)}];game.phase='ritual';}
});
