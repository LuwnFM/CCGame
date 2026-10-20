import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from '../src/server.ts';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

async function fixture() {
  const app=createApp({databasePath:':memory:',accessPassword:'shared-alpha-password',clientOrigin:'https://ccgame-omega.vercel.app'});
  await new Promise<void>(resolve=>app.server.listen(0,resolve));
  const address=app.server.address();
  if (!address || typeof address==='string') throw new Error('No port');
  const base=`http://127.0.0.1:${address.port}`;
  async function request(path:string, token='', data?:object, method?:string, origin?:string) {
    const response=await fetch(base+path,{method:method||(data?'POST':'GET'),
      headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{}),...(origin?{origin}:{})},
      body:data?JSON.stringify(data):undefined});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  async function register(login:string) {
    const response=await request('/api/register','',{login,password:'private-password-123',accessPassword:'shared-alpha-password'});
    assert.equal(response.status,200,JSON.stringify(response.body));
    return response.body as {token:string;account:{id:string;login:string}};
  }
  return {app,request,register};
}

test('registration, permanent ID, case-insensitive login, rename and feedback',async()=>{
  const {app,request,register}=await fixture();
  try {
    assert.equal((await request('/api/lobby')).status,401);
    assert.equal((await request('/api/register','',{login:'Warden',password:'private-password-123',accessPassword:'wrong'})).status,403);
    const first=await register('Warden');
    assert.match(first.account.id,/^[a-f0-9-]{36}$/);
    assert.equal((await request('/api/register','',{login:'warden',password:'private-password-123',accessPassword:'shared-alpha-password'})).status,409);
    const other=await register('Other');
    assert.equal((await request('/api/me/rename',first.token,{login:'OTHER'})).status,409);
    const renamed=await request('/api/me/rename',first.token,{login:'New_Warden'});
    assert.equal(renamed.body.account.id,first.account.id);
    const relog=await request('/api/login','',{login:'new_warden',password:'private-password-123'});
    assert.equal(relog.body.account.id,first.account.id);
    assert.equal((await request('/api/feedback',first.token,{category:'bug',text:'Проверка ошибки в игре'})).status,201);
    assert.equal((await request('/api/chat',first.token,{text:'Привет всем'})).status,201);
    const lobby=await request('/api/lobby',other.token);
    assert.equal(lobby.body.online,2);
    assert.equal(lobby.body.chat[0].accountId,first.account.id);
    assert.equal(lobby.body.chat[0].login,'New_Warden');
    assert.equal((await request('/api/me/delete',first.token,{password:'private-password-123'})).status,200);
    assert.equal((await request('/api/me',first.token)).status,401);
    assert.equal((await request('/api/me',relog.body.token)).status,401);
  } finally {app.close()}
});

test('catalog, 70-card custom deck, uniqueness and queue match retain hidden hands',async()=>{
  const {app,request,register}=await fixture();
  try {
    const a=await register('Alpha'),b=await register('Beta');
    const catalog=(await request('/api/catalog',a.token)).body;
    assert.equal(catalog.presets.length,6);
    assert.ok(catalog.cards.some((c:{name:string})=>c.name==='Колдрейк Шоу'));
    const starter=catalog.presets.find((p:{id:string})=>p.id==='violet');
    assert.equal(starter.cards.length,70);
    assert.equal((await request('/api/my-decks',a.token,{name:'Микс',cards:starter.cards.slice(0,69)})).status,409);
    const saved=await request('/api/my-decks',a.token,{name:'Ритуал',cards:starter.cards});
    assert.equal(saved.status,201,JSON.stringify(saved.body));
    const custom=saved.body.deck.id;
    assert.equal((await request('/api/queue',a.token,{deckId:custom})).body.searching,true);
    assert.equal((await request('/api/lobby',a.token)).body.searching,1);
    const joined=await request('/api/queue',b.token,{deckId:'blue'});
    const code=joined.body.room;
    assert.match(code,/^[A-F0-9]{8}$/);
    assert.equal((await request('/api/lobby',a.token)).body.room,code);
    const viewA=(await request('/api/rooms/'+code,a.token)).body.game;
    const viewB=(await request('/api/rooms/'+code,b.token)).body.game;
    assert.equal(viewA.phase,'mulligan');
    assert.equal(viewA.players[1].hand,undefined);
    assert.equal(viewB.players[0].hand,undefined);
    assert.equal(viewA.players[0].hand.length,7);
    assert.equal((await request('/api/rooms/'+code+'/commands',b.token,{type:'playDomain',expectedRevision:0,key:'wrong',handIndex:0})).status,409);
    assert.equal((await request('/api/rooms/'+code+'/commands',a.token,{type:'mulligan',indices:[],expectedRevision:0,key:'m0'})).status,200);
    const started=await request('/api/rooms/'+code+'/commands',b.token,{type:'mulligan',indices:[],expectedRevision:1,key:'m1'});
    assert.equal(started.body.game.phase,'main');
    const relog=await request('/api/login','',{login:'Alpha',password:'private-password-123'});
    assert.equal((await request('/api/rooms/'+code,relog.body.token)).status,200);
    assert.equal((await request('/api/rooms/'+code,'')).status,401);
    assert.equal((await request('/api/my-decks/'+custom,a.token,undefined,'DELETE')).status,200);
  } finally {app.close()}
});

test('expiry makes deterministic legal auto choices; CORS only permits configured client',async()=>{
  const {app,request,register}=await fixture();
  try {
    const a=await register('ClockOne'),b=await register('ClockTwo');
    const code=(await request('/api/rooms',a.token,{deckId:'red'})).body.code;
    await request('/api/rooms/'+code+'/join',b.token,{deckId:'blue'});
    const good=await request('/api/lobby',a.token,undefined,'GET','https://ccgame-omega.vercel.app');
    assert.equal(good.headers.get('access-control-allow-origin'),'https://ccgame-omega.vercel.app');
    assert.equal((await request('/api/lobby',a.token,undefined,'GET','https://hostile.example')).status,403);
    const expire=app.db.prepare('UPDATE rooms SET deadline=? WHERE code=?');
    expire.run(Date.now()-1,code);
    let game=(await request('/api/rooms/'+code,a.token)).body.game;
    assert.deepEqual(game.mulliganReady,[true,false]);
    expire.run(Date.now()-1,code);
    game=(await request('/api/rooms/'+code,b.token)).body.game;
    assert.equal(game.phase,'main');
    expire.run(Date.now()-1,code);
    game=(await request('/api/rooms/'+code,a.token)).body.game;
    assert.equal(game.turn,2);
    assert.equal(game.timeoutStreak[0],1);
  } finally {app.close()}
});

test('SQLite startup creates a consistent retained backup with game data',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'firewell-backup-'));
  const file=join(dir,'firewell.sqlite');
  try {
    const first=createApp({databasePath:file,accessPassword:'backup-test-password'});
    first.db.prepare("INSERT INTO feedback (account_id,category,body,created_at) VALUES ('backup-user','idea','backup checked',1)").run();
    first.db.close();
    const second=createApp({databasePath:file,accessPassword:'backup-test-password'});
    const files=await readdir(join(dir,'backups'));
    assert.equal(files.length,1);
    const snapshot=new DatabaseSync(join(dir,'backups',files[0]));
    assert.equal(snapshot.prepare("SELECT COUNT(*) AS total FROM feedback").get()?.total,1);
    snapshot.close();second.db.close();
  } finally {await rm(dir,{recursive:true,force:true})}
});
