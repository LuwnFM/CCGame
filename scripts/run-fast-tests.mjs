import {readdirSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
const tests=readdirSync('test').filter(name=>name.endsWith('.test.ts')&&name!=='simulation.test.ts').sort().map(name=>'test/'+name);
if(!tests.length)throw new Error('No fast tests found');
const result=spawnSync(process.execPath,['--experimental-strip-types','--test',...tests],{stdio:'inherit'});
if(result.error)throw result.error;
process.exit(result.status??1);
