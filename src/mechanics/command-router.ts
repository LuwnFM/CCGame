import {RuleError,type Game,type Command} from '../core.ts';
type Handler<T extends Command['type']>=(game:Game,command:Extract<Command,{type:T}>)=>void;
const commands=new Map<Command['type'],(game:Game,command:Command)=>void>();
export function registerCommand<T extends Command['type']>(type:T,handler:Handler<T>):()=>void{
 if(commands.has(type))throw new RuleError('Команда зарегистрирована повторно: '+type);
 commands.set(type,handler as (game:Game,command:Command)=>void);
 return ()=>{if(commands.get(type)===handler)commands.delete(type)};
}
export function registeredCommands():string[]{return [...commands.keys()].sort();}
export function executeCommand(game:Game,command:Command):void{
 const handler=commands.get(command.type);
 if(!handler)throw new RuleError('Неизвестная команда');
 handler(game,command);
}
