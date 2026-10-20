import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';
import { initialGame, player } from '../src/core.ts';
import { MatchHistory, analyzeArchive } from '../src/history.ts';
test('private compressed match history survives restarts and is analyzable',()=>{
 const folder=mkdtempSync(join(tmpdir(),'fw-history-'));
 try {
  const file=join(folder,'game.sqlite'),db=new DatabaseSync(file);
  db.exec('CREATE TABLE rooms(code TEXT PRIMARY KEY,host TEXT,guest TEXT,game TEXT)');
  const journal=new MatchHistory(db,file);
  const game=initialGame(player(),player());
  db.prepare('INSERT INTO rooms VALUES(?,?,?,?)').run('AABBCCDD','user-1','user-2',JSON.stringify(game));
  journal.open('AABBCCDD','user-1','user-2',game);
  const next={...game,revision:1,turn:1};
  journal.record('AABBCCDD','player',{type:'startTurn',actor:0,expectedRevision:0,key:'SESSION_SECRET'},game,next);
  const end={...next,revision:2,phase:'finished' as const,winner:0 as const,turn:2};
  journal.record('AABBCCDD','timeout',{type:'endTurn',actor:0,expectedRevision:1,key:'SESSION_SECRET2'},next,end);
  db.prepare('UPDATE rooms SET game=? WHERE code=?').run(JSON.stringify(end),'AABBCCDD');
  const result=journal.exportMatch('AABBCCDD');
  assert.ok(result&&existsSync(result.path));assert.equal(result.sha256.length,64);
  const stats=analyzeArchive(result.path);
  assert.equal(stats.actionsTotal,2);assert.equal(stats.timeoutCount,1);
  assert.equal(stats.winner,0);assert.equal(stats.commands.startTurn,1);
  db.close();
  const db2=new DatabaseSync(file),restored=new MatchHistory(db2,file);
  restored.archiveCompleted();
  assert.equal(restored.summary('AABBCCDD').events.length,2);
  assert.equal(restored.exportMatch('AABBCCDD')?.sha256,result.sha256);
  db2.close();
 }finally{rmSync(folder,{recursive:true,force:true})}
});
