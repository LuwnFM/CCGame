import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {spawnSync} from 'node:child_process';
test('each file-backed card is registered in the static catalog',()=>{
 const run=spawnSync(process.execPath,['scripts/sync-card-catalog.mjs','--check'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr||run.stdout);
});
