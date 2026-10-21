/** Plugin bootstrap. New command modules register handlers in commands/index.ts. */
import './effects/index.ts';
import './plugins/index.ts';
import './commands/index.ts';
export {registerCommand,registeredCommands,executeCommand} from './command-router.ts';
