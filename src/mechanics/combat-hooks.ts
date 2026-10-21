import {RuleError,type Game,type Permanent,type Player} from '../core.ts';
export type CombatStage='beforeCombat'|'afterAttackerHit'|'afterDefenderHit'|'afterCombat';
export type CombatContext={
  game:Game;attacker:Permanent;defender:Permanent|null;legend:Permanent|null;
  attackerOwner:Player;defenderOwner:Player;intercepted:boolean;
  source:Permanent;target:Permanent|null;amount:number;dealt:number;
};
export type CombatHook=(context:CombatContext)=>void;
const stages=new Map<CombatStage,Array<{id:string;priority:number;handler:CombatHook}>>();
/** Deterministic hook ordering: numeric priority then stable string ID. */
export function registerCombatHook(stage:CombatStage,id:string,handler:CombatHook,priority=0):()=>void{
  if(!id||!Number.isSafeInteger(priority))throw new RuleError('Неверный боевой модуль');
  const list=stages.get(stage)??[];
  if(list.some(x=>x.id===id))throw new RuleError('Боевой модуль зарегистрирован повторно: '+id);
  list.push({id,priority,handler});
  list.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id,'en'));
  stages.set(stage,list);
  return ()=>{const at=list.findIndex(x=>x.id===id&&x.handler===handler);if(at>=0)list.splice(at,1)};
}
export function runCombatHooks(stage:CombatStage,ctx:CombatContext):void{
  for(const {handler} of stages.get(stage)??[])handler(ctx);
}
export function registeredCombatHooks():string[]{
  return [...stages].flatMap(([stage,hooks])=>hooks.map(h=>stage+':'+h.id)).sort();
}
