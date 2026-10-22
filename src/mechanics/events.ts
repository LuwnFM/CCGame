import type {Game,Card} from '../model/index.ts';
import {EffectLimitError,MAX_EFFECT_OPERATIONS} from './limits.ts';
export type GameEventType='enter'|'revive'|'death'|'zoneMoved'|'turnStart'|'turnEnd'|'ritual'|'rewardChosen'|'domainTapped'|'commandApplied'|'combatResolved';
export type GameEvent={type:GameEventType;owner:0|1;cardId?:string;objectId?:number;from?:string;to?:string;source?:Card;targetId?:number;suppressed?:boolean;commandType?:string};
export type GameEventHandler=(game:Game,event:GameEvent)=>void;
const listeners=new Map<GameEventType,Set<GameEventHandler>>();
const queues=new WeakMap<Game,{pending:GameEvent[];resolving:boolean}>();
export function onGameEvent(type:GameEventType,handler:GameEventHandler):()=>void{
  const group=listeners.get(type)??new Set<GameEventHandler>();
  group.add(handler);listeners.set(type,group);
  return ()=>group.delete(handler);
}
/** FIFO synchronous resolution. Reentrant triggers append to the queue. Queue bookkeeping
 * is not persisted on Game, keeping match serialization and replay deterministic.
 */
export function emitGameEvent(game:Game,event:GameEvent):void{
  let state=queues.get(game);
  if(!state){state={pending:[],resolving:false};queues.set(game,state);}
  state.pending.push(event);
  if(state.resolving)return;
  state.resolving=true;
  try{
    let processed=0;
    while(state.pending.length){
      if(++processed>MAX_EFFECT_OPERATIONS)throw new EffectLimitError('Переполнена очередь событий');
      const next=state.pending.shift()!;
      for(const handle of listeners.get(next.type)??[])handle(game,next);
    }
  }finally{state.resolving=false;if(state.pending.length)state.pending.length=0;}
}
