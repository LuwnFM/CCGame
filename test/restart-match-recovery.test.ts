import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createApp} from '../src/server.ts';
import {restoreActiveMatchTimers,RESUME_CLOCK_MS} from '../src/match-recovery.ts';

test('unfinished human and bot games survive process restart with state, sessions and clocks intact',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'firewell-restart-matches-'));
 const options={databasePath:join(dir,'rooms.sqlite'),accessPassword:'restart-alpha-password'};
 let app:any;
 const launch=async()=>{app=createApp(options);await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));return 'http://127.0.0.1:'+app.server.address().port};
 const stop=async()=>{if(!app)return;await new Promise<void>(resolve=>app.server.close(resolve));app.db.close();app=null};
 const request=async(base:string,path:string,token='',body?:object)=>{
  const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  return {status:response.status,data:await response.json()};
 };
 try{
  let base=await launch();
  const a=await request(base,'/api/register','',{login:'ResumeHost',password:'private-password-123',accessPassword:options.accessPassword});
  const b=await request(base,'/api/register','',{login:'ResumeGuest',password:'private-password-123',accessPassword:options.accessPassword});
  assert.equal(a.status,200);assert.equal(b.status,200);
  const host=a.data.token,guest=b.data.token;
  const pvp=(await request(base,'/api/rooms',host,{deckId:'red'})).data.code;
  assert.equal((await request(base,'/api/rooms/'+pvp+'/join',guest,{deckId:'blue'})).status,200);
  const bot=(await request(base,'/api/bot',host,{deckId:'green'})).data.code;
  const before=new Map([pvp,bot].map(code=>[code,app.db.prepare('SELECT * FROM rooms WHERE code=?').get(code)]));
  // Simulate long downtime spanning the existing deadlines.
  const expired=Date.now()-600_000;
  for(const code of [pvp,bot]){
   app.db.prepare('UPDATE rooms SET deadline=?,turn_deadline=?,intercept_started=? WHERE code=?').run(expired,expired,0,code);
  }
  await stop();
  base=await launch();
  for(const code of [pvp,bot]){
   const now=Date.now();
   const saved=app.db.prepare('SELECT * FROM rooms WHERE code=?').get(code);
   const previous=before.get(code) as any;
   assert.equal(saved.game,previous.game,'Serialized cards, RNG, revision and phase unchanged');
   assert.equal(saved.host,previous.host);
   assert.equal(saved.guest,previous.guest);
   assert.ok(saved.deadline>now+RESUME_CLOCK_MS.mulligan-6000,code+' lost recovery window');
   const visible=await request(base,'/api/rooms/'+code,host);
   assert.equal(visible.status,200,JSON.stringify(visible.data));
   assert.notEqual(visible.data.game.phase,'finished');
   assert.notEqual(visible.data.game.phase,'paused');
   const lobby=await request(base,'/api/lobby',host);
   assert.ok(lobby.data.activeMatches.some((m:any)=>m.code===code),'Room absent after boot '+code);
  }
  const botView=await request(base,'/api/rooms/'+bot,host);
  const continued=await request(base,'/api/rooms/'+bot+'/commands',host,
    {type:'mulligan',indices:[],expectedRevision:botView.data.game.revision,key:'resume-bot-mulligan'});
  assert.equal(continued.status,200,JSON.stringify(continued.data));
  assert.notEqual(continued.data.game.phase,'finished');
  assert.equal((await request(base,'/api/me',host)).status,200,'Session survives restart');
  const guestView=await request(base,'/api/rooms/'+pvp,guest);
  assert.equal(guestView.status,200);
  const guestMove=await request(base,'/api/rooms/'+pvp+'/commands',guest,
    {type:'mulligan',indices:[],expectedRevision:guestView.data.game.revision,key:'resume-pvp-mulligan'});
  assert.equal(guestMove.status,200,JSON.stringify(guestMove.data));
  assert.equal((await request(base,'/api/me',guest)).status,200);
 }finally{await stop();await rm(dir,{recursive:true,force:true})}
});

test('recovery honors finished/paused games, reaction clocks, and never edits state JSON',async()=>{
 const app=createApp({databasePath:':memory:',accessPassword:'recovery-test-password'});
 try{
  const before=Date.now()-3600_000;
  const dummy=(phase:string,winner:any,turn=4)=>JSON.stringify({phase,winner,turn,revision:12,seed:99});
  const insert=app.db.prepare('INSERT INTO rooms (code,host,guest,game,deadline,turn_deadline,intercept_started) VALUES (?,?,?,?,?,?,?)');
  const rows=[
   ['11111111','main',null],
   ['22222222','intercept',null],
   ['33333333','reward',null],
   ['44444444','finished',1],
   ['55555555','paused',null]
  ] as const;
  for(const [code,phase,winner] of rows)insert.run(code,'player','enemy',dummy(phase,winner),before,before,before);
  const original=new Map(rows.map(([code])=>[code,app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code).game]));
  const now=Date.now();
  assert.equal(restoreActiveMatchTimers(app.db,now),3);
  for(const [code,phase] of rows){
   const row=app.db.prepare('SELECT * FROM rooms WHERE code=?').get(code);
   assert.equal(row.game,original.get(code),'Must never mutate a serialized game');
   if(phase==='finished'||phase==='paused'){
    assert.equal(row.deadline,before,'Terminal state timers never touched');
   }else{
    assert.ok(row.deadline>=now+RESUME_CLOCK_MS[phase]);
    assert.ok(row.turn_deadline>=now+RESUME_CLOCK_MS[phase]);
    if(phase==='intercept')assert.equal(row.intercept_started,now);
   }
  }
 }finally{app.db.close()}
});
