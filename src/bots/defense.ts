import type {Game,Permanent,PlayerId} from '../core.ts';
import {totalAttack} from '../mechanics/combat.ts';
import {ability} from '../mechanics/abilities.ts';
import {canGuardIntercept} from '../mechanics/traits/guard.ts';
import {canInterceptFlyingAttack} from '../mechanics/traits/flying.ts';

/** A deterministic, rules-aware defense policy for all starter archetypes.
 * Evaluates legal blocks, lethal prevention, first strike, shields, poison,
 * combat trades and the opportunity cost of exposing a valuable creature.
 * It is intentionally separate from game legality and never mutates Game.
 */
export function chooseDefensiveInterceptor(g:Game):number|null {
 const pending=g.pendingAttack;
 if(g.phase!=='intercept'||!pending)return null;
 const us=g.players[pending.defender];
 const attacker=g.players[g.active];
 const threat=[...attacker.main,...attacker.auxiliary].find(x=>x.objectId===pending.attackerId);
 if(!threat)return null;
 const incoming=totalAttack(attacker,threat);
 const defenderTarget=pending.target.kind==='creature'
   ?[...us.main,...us.auxiliary].find(x=>x.objectId===pending.target.objectId):undefined;
 const risk=pending.target.kind==='player'
   ?Math.min(incoming,Math.max(0,us.hp))*(us.hp<=incoming?30:us.hp<=incoming*2?4:1.2)
   :pending.target.kind==='legend'?Math.min(incoming,6)*2.4
   :defenderTarget?Math.min(incoming,Math.max(0,(defenderTarget.card.health??0)-defenderTarget.damage+defenderTarget.shield))*1.9:0;
 let best=0;
 let chosen:number|null=null;
 const candidates=[...us.main,...us.auxiliary].filter(unit=>
   unit.card.kind==='creature'&&!unit.exhausted&&!unit.stunned&&!unit.stasis&&unit.interceptions===0&&
   (pending.target.kind!=='creature'||canGuardIntercept(unit))&&
   canInterceptFlyingAttack(threat,unit));
 for(const unit of candidates){
   const ours=totalAttack(us,unit);
   const enemyRemaining=Math.max(0,(threat.card.health??0)-threat.damage+threat.shield);
   const ourRemaining=Math.max(0,(unit.card.health??0)-unit.damage+unit.shield);
   const enemyFirst=!!ability(threat,'firstStrike')&&!ability(unit,'firstStrike');
   const ourFirst=!!ability(unit,'firstStrike')&&!ability(threat,'firstStrike');
   const weKill=ours>=enemyRemaining && !(enemyFirst&&incoming>=ourRemaining);
   const weDie=incoming>=ourRemaining && !(ourFirst&&ours>=enemyRemaining);
   const poisonFromUs=!!ability(unit,'poisonHit')&&!enemyFirst;
   const poisonFromEnemy=!!ability(threat,'poisonHit')&&!ourFirst;
   const unitValue=(unit.card.cost?.generic??1)+Object.values(unit.card.cost?.colored??{}).reduce((n,v)=>n+(v??0),0)+ours*.65+Number(!!ability(unit,'guard'))*1.5;
   const enemyValue=(threat.card.cost?.generic??1)+Object.values(threat.card.cost?.colored??{}).reduce((n,v)=>n+(v??0),0)+incoming*.65+Number(!!ability(threat,'extraAttacks'))*2;
   const prevented=ability(threat,'piercing')?Math.min(incoming,ourRemaining):incoming;
   const benefit=risk*(incoming>0?prevented/incoming:1) + (weKill?enemyValue*1.5:0) + (poisonFromUs?1.6:0);
   const cost=(weDie?unitValue*1.5:Math.max(0,incoming-unit.shield)*.35)+(poisonFromEnemy?2:0);
   const score=benefit-cost;
   if(score>best+1e-8 || (Math.abs(score-best)<1e-8&&chosen!==null&&unit.objectId<chosen)){
     best=score;chosen=unit.objectId;
   }
 }
 return chosen;
}
