import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync, renameSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import { DatabaseSync } from 'node:sqlite';
import type { Command, Game } from './core.ts';
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const safe=new Set(['type','handIndex','objectId','discardIndex','keepExisting','indices','attackerId','target','interceptorId','effectId','objectIds','rewardId','replaceId']);
export class MatchHistory {
 private folder:string|null;
 private db:DatabaseSync;
 constructor(db:DatabaseSync,dbPath:string){
  this.db=db;
  this.folder=dbPath===':memory:'?null:join(dirname(dbPath),'match-archives');
  db.exec('CREATE TABLE IF NOT EXISTS match_history (room TEXT PRIMARY KEY,host TEXT NOT NULL,guest TEXT NOT NULL,started_at INTEGER NOT NULL,finished_at INTEGER,winner TEXT,initial_game TEXT NOT NULL,archive_path TEXT,archive_sha256 TEXT)');
  db.exec('CREATE TABLE IF NOT EXISTS match_events (seq INTEGER PRIMARY KEY AUTOINCREMENT,room TEXT NOT NULL,timestamp INTEGER NOT NULL,source TEXT NOT NULL,actor INTEGER NOT NULL,action TEXT NOT NULL,revision_before INTEGER NOT NULL,revision_after INTEGER NOT NULL,state_hash TEXT NOT NULL,turn INTEGER NOT NULL,phase TEXT NOT NULL,active INTEGER NOT NULL,hp0 INTEGER NOT NULL,hp1 INTEGER NOT NULL)');
  db.exec('CREATE INDEX IF NOT EXISTS match_events_room ON match_events(room,seq)');
 }
 open(room:string,host:string,guest:string,game:Game,now=Date.now()){
  if(!/^[A-F0-9]{8}$/.test(room))throw Error('Invalid room');
  this.db.prepare('INSERT OR IGNORE INTO match_history(room,host,guest,started_at,initial_game) VALUES (?,?,?,?,?)').run(room,host,guest,now,JSON.stringify(game));
 }
 record(room:string,source:'player'|'timeout',command:Command,before:Game,after:Game,now=Date.now()){
  if(after.revision<=before.revision)return;
  if(!this.db.prepare('SELECT room FROM match_history WHERE room=?').get(room)){
   const row=this.db.prepare('SELECT host,guest FROM rooms WHERE code=?').get(room) as {host:string;guest:string|null}|undefined;
   if(!row?.guest)throw Error('No match participants');
   this.open(room,row.host,row.guest,before,now);
  }
  const action=Object.fromEntries(Object.entries(command).filter(([key])=>safe.has(key)));
  this.db.prepare('INSERT INTO match_events(room,timestamp,source,actor,action,revision_before,revision_after,state_hash,turn,phase,active,hp0,hp1) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').run(room,now,source,command.actor,JSON.stringify(action),before.revision,after.revision,sha(JSON.stringify(after)),after.turn,after.phase,after.active,after.players[0].hp,after.players[1].hp);
  if(after.phase==='finished'||after.phase==='paused')
   this.db.prepare('UPDATE match_history SET finished_at=?,winner=? WHERE room=? AND finished_at IS NULL').run(now,after.phase==='paused'?'paused':String(after.winner),room);
 }
 summary(room:string){
  return {match:this.db.prepare('SELECT * FROM match_history WHERE room=?').get(room),
    events:this.db.prepare('SELECT * FROM match_events WHERE room=? ORDER BY seq').all(room)};
 }
 archiveCompleted(){
  if(!this.folder)return;
  for(const {room} of this.db.prepare('SELECT room FROM match_history WHERE finished_at IS NOT NULL AND (archive_path IS NULL OR archive_sha256 IS NULL)').all() as {room:string}[])
   this.exportMatch(room);
 }
 exportMatch(room:string):{path:string;sha256:string}|null{
  if(!this.folder)return null;
  const m=this.db.prepare('SELECT * FROM match_history WHERE room=?').get(room) as any;
  if(!m?.finished_at)return null;
  if(m.archive_path&&m.archive_sha256&&existsSync(m.archive_path)){
    const actual=sha(readFileSync(m.archive_path));
    if(actual===m.archive_sha256)return {path:m.archive_path,sha256:m.archive_sha256};
    // A mismatched or damaged archive is recreated from the authoritative DB.
  }
  const row=this.db.prepare('SELECT game FROM rooms WHERE code=?').get(room) as {game:string}|undefined;
  if(!row)return null;
  const log={format:'firewell-match-v1',room,startedAt:m.started_at,finishedAt:m.finished_at,
   players:[m.host,m.guest],status:m.winner==='paused'?'paused':'finished',
   winner:m.winner==='paused'?null:m.winner==='draw'?'draw':Number(m.winner),
   startingState:JSON.parse(m.initial_game),finalState:JSON.parse(row.game),
   events:(this.summary(room).events as any[]).map(e=>({seq:e.seq,time:e.timestamp,source:e.source,actor:e.actor,
     action:JSON.parse(e.action),revisionBefore:e.revision_before,revisionAfter:e.revision_after,
     stateHash:e.state_hash,turn:e.turn,phase:e.phase,active:e.active,hp:[e.hp0,e.hp1]}))};
  mkdirSync(this.folder,{recursive:true,mode:0o700});
  const target=join(this.folder,room+'-'+m.started_at+'.json.gz');
  const bytes=gzipSync(Buffer.from(JSON.stringify(log),'utf8'),{level:9});
  writeFileSync(target+'.tmp',bytes,{mode:0o600});renameSync(target+'.tmp',target);
  const checksum=sha(bytes);
  this.db.prepare('UPDATE match_history SET archive_path=?,archive_sha256=? WHERE room=?').run(target,checksum,room);
  return {path:target,sha256:checksum};
 }
}
export function analyzeArchive(file:string){
 const bytes=readFileSync(file),log=JSON.parse(gunzipSync(bytes).toString('utf8'));
 if(log.format!=='firewell-match-v1'||!Array.isArray(log.events))throw Error('Invalid match archive');
 const actions:Record<string,number>={};let timeoutCount=0;
 for(const e of log.events){actions[e.action.type]=(actions[e.action.type]||0)+1;if(e.source==='timeout')timeoutCount++}
 return {room:log.room,players:log.players,winner:log.winner,status:log.status,
  commands:actions,actionsTotal:log.events.length,timeoutCount,turns:log.finalState.turn,
  hp:log.finalState.players.map((p:{hp:number})=>p.hp),sha256:sha(bytes),bytes:bytes.length};
}
