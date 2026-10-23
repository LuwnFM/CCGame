import {RuleError} from '../../errors.ts';
import type {Game,Permanent,PlayerId} from '../../model/index.ts';
import {mayChooseEffectTarget} from '../traits/majestic.ts';

export type ChosenTargetPolicy={
 side:'own'|'enemy';
 includeLegends?:boolean;
 creaturesOnly?:boolean;
 unstunned?:boolean;
 unstasis?:boolean;
};
/** Explicitly chosen Technique/ability targets only. Never use this
 * function for attacks, AoE, randomized damage, or automatic damage.
 * Majestic owns its exclusion rule in traits/majestic.ts.
 */
export function eligibleChosenTargets(game:Game,actor:PlayerId,policy:ChosenTargetPolicy):Permanent[]{
 const owner=game.players[policy.side==='own'?actor:(1-actor) as PlayerId];
 const zones=[...owner.main,...owner.auxiliary,...(policy.includeLegends?owner.legends:[])];
 return zones.filter(unit=>mayChooseEffectTarget(unit) &&
   (!policy.creaturesOnly||unit.card.kind==='creature') &&
   (!policy.unstunned||!unit.stunned)&&(!policy.unstasis||!unit.stasis));
}
export function requireChosenTarget(game:Game,actor:PlayerId,id:number|undefined,
 policy:ChosenTargetPolicy,message='Выберите допустимое Существо'):Permanent{
 const target=eligibleChosenTargets(game,actor,policy).find(unit=>unit.objectId===id);
 if(!target)throw new RuleError(message);
 return target;
}
