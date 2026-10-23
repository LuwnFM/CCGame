import {neutralAffinityActive} from './rules/neutral-affinity.ts';
import {RuleError} from '../errors.ts';
import type {Game,PlayerId,Card} from '../model/index.ts';
import {EffectLimitError,MAX_EFFECT_OPERATIONS} from './limits.ts';
export type EffectChannel='entry'|'technique'|'loyalty'|'death';
export type EffectContext={game:Game;actor:PlayerId;source:Card;amount?:number;cards?:readonly Card[];
  targetId?:number;discardIndex?:number;completeRitual?:boolean};
export type EffectHandler=(context:EffectContext)=>void;
/** Each registered effect has one implementation, independent of individual cards. */
const handlers=new Map<string,EffectHandler>();
export function registerEffect(channel:EffectChannel,kind:string,handler:EffectHandler):()=>void{
  const key=channel+':'+kind;
  if(!kind||handlers.has(key))throw new RuleError('Эффект уже зарегистрирован или не имеет ID: '+key);
  handlers.set(key,handler);
  return ()=>{if(handlers.get(key)===handler)handlers.delete(key)};
}
export function registeredEffects(channel?:EffectChannel):string[]{
  return [...handlers.keys()].filter(x=>!channel||x.startsWith(channel+':')).sort();
}
export function invokeEffect(channel:EffectChannel,kind:string,context:EffectContext):void{
  const handler=handlers.get(channel+':'+kind);
  if(!handler)throw new RuleError('Неизвестный эффект '+channel+':'+kind);
  if((context.game.operationsUsed=(context.game.operationsUsed??0)+1)>MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет игровых эффектов');
  const bonus=context.source.neutralAffinity;
  if(bonus&&context.amount!==undefined&&neutralAffinityActive(context.game.players[context.actor],context.source))
    context={...context,amount:context.amount+bonus.bonus};
  handler(context);
}
