import {RuleError,type Game} from '../core.ts';
import {EffectLimitError,MAX_EFFECT_OPERATIONS} from './limits.ts';
export type GameEventType='enter'|'revive'|'death'|'zoneMoved'|'turnStart'|'turnEnd'|'ritual'|'combatResolved';
export type GameEvent={type:GameEventType;owner:0|1;cardId?:string;objectId?:number;from?:string;to?:string};
export type GameEventHandler=(game:Game,event:GameEvent)=>void;
const listeners=new Map<GameEventType,Set<GameEventHandler>>();
export function onGameEvent(type:GameEventType,handler:GameEventHandler):()=>void{
  const group=listeners.get(type)??new Set<GameEventHandler>();
  group.add(handler);listeners.set(type,group);
  return ()=>group.delete(handler);
}
/** FIFO, bounded and serialized with Game. Reentrant events are queued, never recursive. */
export function emitGameEvent(game:Game,event:GameEvent):void{
  const state=game as Game&{effectEvents?:GameEvent[];resolvingEvents?:boolean};
  (state.effectEvents??=[]).push(event);
  if(state.resolvingEvents)return;
  state.resolvingEvents=true;
  try{
    let processed=0;
    while(state.effectEvents.length){
      if(++processed>MAX_EFFECT_OPERATIONS)throw new EffectLimitError('Переполнена очередь событий');
      const next=state.effectEvents.shift()!;
      for(const handle of listeners.get(next.type)??[])handle(game,next);
    }
  }finally{state.resolvingEvents=false;}
}
