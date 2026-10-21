/** Plugin bootstrap. New command modules register handlers in commands/index.ts. */
import './commands/index.ts';
export {registerCommand,registeredCommands,executeCommand} from './command-router.ts';
