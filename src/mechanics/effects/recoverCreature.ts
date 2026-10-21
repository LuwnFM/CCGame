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
registerEffect('loyalty','recoverCreature',({game,actor,discardIndex})=>{
 const owner=game.players[actor];
 requireRule(Number.isSafeInteger(discardIndex)&&owner.discard[discardIndex!]?.kind==='creature','Выберите Существо из сброса для возвращения в руку');
 transferCard(game,actor,'discard','hand',discardIndex!);
});
