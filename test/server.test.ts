import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from '../src/server.ts';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Social } from '../src/social.ts';
import { validateDeck } from '../src/core.ts';

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
    const single=await request('/api/lobby',other.token);
    assert.equal(single.body.online,1);
    await request('/api/lobby',first.token);
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

test('chat 5-second throttle, history paging, private feedback and stored ticket fields',async()=>{
  const {app,request,register}=await fixture();
  try {
    const author=await register('ChatArchive'),reader=await register('ChatReader');
    const first=await request('/api/chat',author.token,{text:'first historical chat'});
    assert.equal(first.status,201);assert.ok(first.body.nextAllowedAt>Date.now());
    assert.equal((await request('/api/chat',author.token,{text:'rate limit bypass'})).status,409);
    app.db.prepare('UPDATE chat_messages SET created_at=created_at-5001 WHERE account_id=?').run(author.account.id);
    assert.equal((await request('/api/chat',author.token,{text:'second historical chat'})).status,201);
    const hist=await request('/api/chat/history?limit=1',reader.token);
    assert.equal(hist.status,200);assert.equal(hist.body.messages.length,1);assert.equal(hist.body.hasMore,true);
    const older=await request('/api/chat/history?limit=1&before='+hist.body.nextBefore,reader.token);
    assert.equal(older.body.messages[0].body,'first historical chat');
    assert.equal((await request('/api/chat/history?limit=200',reader.token)).status,409);
    const report=await request('/api/feedback',author.token,{
      category:'problem',title:'Unable to move creature',roomCode:'AABB00CC',
      text:'After joining the room, cannot select a creature'});
    assert.equal(report.status,201);assert.ok(Number.isInteger(report.body.report.id));
    const own=await request('/api/feedback/mine',author.token);
    assert.equal(own.body.reports[0].title,'Unable to move creature');
    assert.equal(own.body.reports[0].status,'new');
    assert.equal((await request('/api/feedback/mine',reader.token)).body.reports.length,0);
    assert.equal((await request('/api/feedback',reader.token,{
      category:'bug',title:'Oops',roomCode:'not a room',text:'Some malformed report'})).status,409);
    const sql=app.db.prepare('SELECT account_id,category,title,room_code,body FROM feedback WHERE id=?')
      .get(report.body.report.id) as any;
    assert.equal(sql.account_id,author.account.id);assert.equal(sql.room_code,'AABB00CC');
  }finally{app.close()}
});

test('Latin username, minimum ten-character account password, locked alpha registration and persistent login',async()=>{
  const {app,request,register}=await fixture();
  try{
    const fail=await request('/api/register','',{login:'Логин',password:'securePass012',accessPassword:'shared-alpha-password'});
    assert.equal(fail.status,409);
    assert.equal((await request('/api/register','',{login:'Test!User',password:'securePass012',accessPassword:'shared-alpha-password'})).status,409);
    assert.equal((await request('/api/register','',{login:'LatinOnly',password:'onlyletters',accessPassword:'shared-alpha-password'})).status,409);
    assert.equal((await request('/api/register','',{login:'LatinOnly',password:'1234567890',accessPassword:'shared-alpha-password'})).status,409);
    assert.equal((await request('/api/register','',{login:'LatinOnly',password:'TestAlpha1',accessPassword:'wrong-password'})).status,403);
    const user=await request('/api/register','',{login:'LatinOnly',password:'TestAlpha1',accessPassword:'shared-alpha-password'});
    assert.equal(user.status,200);
    assert.equal((await request('/api/register','',{login:'latinonly',password:'TestAlpha1',accessPassword:'shared-alpha-password'})).status,409);
    const me=await request('/api/me',user.body.token);
    assert.equal(me.body.account.id,user.body.account.id);
    assert.equal((await request('/api/login','',{login:'LATINONLY',password:'TestAlpha1'})).body.account.id,user.body.account.id);
    const renamed=await request('/api/me/rename',user.body.token,{login:'Latin_Next'});
    assert.equal(renamed.status,200);assert.equal(renamed.body.account.id,user.body.account.id);
    assert.equal((await request('/api/me/rename',user.body.token,{login:'кириллица'})).status,409);
  } finally{app.close()}
});

test('matchmaking pairs distinct accounts, honors persistent identity, rejects stale queues and preserves deck choices',async()=>{
 const {app,request,register}=await fixture();
 try{
  const a=await register('Queue_A'),b=await register('Queue_B'),c=await register('Queue_C');
  const red=(await request('/api/queue',a.token,{deckId:'red'})).body;
  assert.equal(red.searching,true);
  assert.equal((await request('/api/queue',a.token,{deckId:'green'})).body.searching,true);
  const pair=await request('/api/queue',b.token,{deckId:'blue'});
  assert.match(pair.body.room,/^[A-F0-9]{8}$/);
  const persisted=(await request('/api/lobby',a.token)).body;
  assert.equal(persisted.room,pair.body.room);
  assert.equal(persisted.searching,0);
  const room=app.db.prepare('SELECT host,guest,game FROM rooms WHERE code=?').get(pair.body.room) as any;
  assert.equal(room.host,a.account.id);assert.equal(room.guest,b.account.id);
  const deck=JSON.parse(room.game);
  assert.equal(deck.players[0].deck.length+deck.players[0].hand.length,70);
  assert.equal(deck.players[1].deck.length+deck.players[1].hand.length,70);
  assert.equal((await request('/api/queue/leave',a.token,{})).status,200);
  assert.equal((await request('/api/queue/leave',b.token,{})).status,200);
  assert.equal((await request('/api/queue',c.token,{deckId:'green'})).body.searching,true);
  app.db.prepare('UPDATE accounts SET seen_at=? WHERE id=?').run(Date.now()-100000,c.account.id);
  assert.equal((await request('/api/queue',a.token,{deckId:'gold'})).body.searching,true);
  assert.equal((await request('/api/lobby',a.token)).body.searching,1);
  assert.equal((await request('/api/queue',b.token,{deckId:'violet'})).body.room!==null,true);
  assert.equal((await request('/api/queue',a.token,{deckId:'gold'})).body.room!==null,true);
 }finally{app.close()}
});

test('10-minute leaderboard counts completed non-draw wins, uses current account name and stable ID',async()=>{
 const {app,request,register}=await fixture();
 try{
  const a=await register('Winner_A'),b=await register('Winner_B'),c=await register('Winner_C');
  const ids=[a.account.id,b.account.id,c.account.id];
  const save=app.db.prepare("INSERT INTO match_history(room,host,guest,started_at,finished_at,winner,initial_game) VALUES (?,?,?,?,?,?,?)");
  save.run('BBAA0001',ids[0],ids[1],1,2,'0','{}');
  save.run('BBAA0002',ids[1],ids[0],2,3,'1','{}');
  save.run('BBAA0003',ids[1],ids[2],3,4,'draw','{}');
  save.run('BBAA0004',ids[2],ids[1],4,null,null,'{}');
  let board=(await request('/api/lobby',a.token)).body.leaderboard;
  assert.equal(board.entries.length,1);assert.equal(board.entries[0].id,ids[0]);assert.equal(board.entries[0].wins,2);
  assert.equal(board.expiresAt-board.updatedAt,600000);
  assert.equal((await request('/api/me/rename',a.token,{login:'Victory_A'})).status,200);
  const fresh=new Social(app.db).leaderboard(board.expiresAt+1);
  assert.equal(fresh.entries[0].login,'Victory_A');
  assert.equal(fresh.entries[0].id,ids[0]);
  save.run('BBAA0005',ids[1],ids[0],5,6,'0','{}');
  const cached=(await request('/api/lobby',a.token)).body.leaderboard;
  assert.equal(cached.entries[0].wins,2);
 }finally{app.close()}
});

test('extra domains are in combined catalog but never modify preset ratios or basic copy restrictions',async()=>{
 const {app,request,register}=await fixture();
 try{
  const {token}=await register('MixedDeck');
  const data=(await request('/api/catalog',token)).body;
  const additions=data.cards.filter((c:any)=>c.id.startsWith('extra-domain-'));
  assert.equal(additions.length,50);
  for(const color of ['red','blue','green','gold','violet'])
    assert.equal(additions.filter((c:any)=>c.produces===color).length,10);
  for(const p of data.presets){
    const cards=p.cards.map((id:string)=>data.cards.find((c:any)=>c.id===id));
    assert.equal(cards.length,70);assert.equal(cards.filter((c:any)=>c.kind==='domain').length,26);
    assert.equal(cards.filter((c:any)=>c.kind==='legend').length,2);
    assert.equal(cards.filter((c:any)=>c.kind==='artifact').length,1);
    assert.equal(validateDeck(cards).length,0);
  }
  const neutral=data.presets.find((p:any)=>p.id==='neutral');
  const creature=neutral.cards.map((id:string)=>data.cards.find((c:any)=>c.id===id)).filter((c:any)=>c.name==='Свирус Жирникус');
  assert.equal(creature.length,2);assert.equal(creature[0].attack,6);assert.equal(creature[0].health,5);
  const red=data.presets.find((p:any)=>p.id==='red');
  const mixed=red.cards.slice();
  const slot=mixed.findIndex((id:string)=>data.cards.find((c:any)=>c.id===id)?.kind==='domain');
  mixed[slot]='extra-domain-violet-1';
  const test=await request('/api/my-decks',token,{name:'Two-color experiment',cards:mixed});
  assert.equal(test.status,201,JSON.stringify(test.body));
  const invalid=mixed.slice();invalid[slot]='extra-domain-violet-1';
  // nonbasic Domain copy limit is three, unlike unlimited basic Domains
  invalid.splice(0,4,'extra-domain-violet-1','extra-domain-violet-1','extra-domain-violet-1','extra-domain-violet-1');
  assert.equal((await request('/api/my-decks',token,{name:'Illegal domains',cards:invalid})).status,409);
 }finally{app.close()}
});

test('basic thematic Domains preserve stable IDs, Energy and original deck ratios',async()=>{
 const {app,request,register}=await fixture();
 try{
  const user=await register('ThematicLands');
  const {cards,presets}=(await request('/api/catalog',user.token)).body;
  const names:Record<string,string>={red:'Горные угодья Стального королевства',blue:'Воздушные причалы Талдрейка',green:'Лесные владения Кайров',gold:'Королевский двор Ивелтина',violet:'Родовая крипта Ван Троупов',neutral:'Опорный двор Ордена'};
  for(const preset of presets){
    const basic=preset.cards.map((id:string)=>cards.find((c:any)=>c.id===id)).filter((c:any)=>c.kind==='domain');
    assert.equal(basic.length,26);
    assert.ok(basic.some((c:any)=>c.name===names[preset.id]));
    assert.ok(basic.every((c:any)=>c.nameEn&&c.basic));
    if(preset.id!=='neutral')assert.ok(basic.every((c:any)=>c.produces===preset.id));
    else assert.equal(basic.filter((c:any)=>c.produces==='gold').length,2);
    assert.ok([...new Set(basic.map((c:any)=>c.id))].length===13);
  }
 }finally{app.close()}
});


test('registered profile, permanent ID and bearer session survive a full SQLite server restart',async()=>{
 const temp=await mkdtemp(join(tmpdir(),'firewell-account-restart-'));
 const file=join(temp,'players.sqlite'), opts={databasePath:file,accessPassword:'privateAlphaPass1'};
 let first:any=null,second:any=null;
 try{
   first=createApp(opts);
   await new Promise<void>(resolve=>first.server.listen(0,'127.0.0.1',resolve));
   const url1='http://127.0.0.1:'+first.server.address().port;
   const registered=await fetch(url1+'/api/register',{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({login:'RestartPlayer',password:'PrivatePlayerSecret1',accessPassword:'privateAlphaPass1'})});
   assert.equal(registered.status,200);
   const initial=await registered.json();
   const token=initial.token,playerId=initial.account.id;
   await new Promise<void>(resolve=>first.server.close(resolve));first.db.close();first=null;
   second=createApp(opts);
   await new Promise<void>(resolve=>second.server.listen(0,'127.0.0.1',resolve));
   const url2='http://127.0.0.1:'+second.server.address().port;
   const restored=await fetch(url2+'/api/me',{headers:{authorization:'Bearer '+token}});
   assert.equal(restored.status,200);
   assert.equal((await restored.json()).account.id,playerId);
   const relog=await fetch(url2+'/api/login',{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({login:'restartplayer',password:'PrivatePlayerSecret1'})});
   assert.equal(relog.status,200);
   assert.equal((await relog.json()).account.id,playerId);
   const denied=await fetch(url2+'/api/register',{method:'POST',headers:{'content-type':'application/json'},
     body:JSON.stringify({login:'SecondPerson',password:'PrivatePlayerSecret1',accessPassword:'wrong'})});
   assert.equal(denied.status,403);
 }finally{
   for(const app of [first,second])if(app){if(app.server.listening)await new Promise<void>(resolve=>app.server.close(resolve));app.db.close();}
   await rm(temp,{recursive:true,force:true});
 }
});


test('Ruler API eligibility, archive parameters and idempotent commands preserve deadlines',async()=>{
 const {app,request,register}=await fixture();
 try{
  const a=await register('NewRulesA'),b=await register('NewRulesB');
  const code=(await request('/api/rooms',a.token,{deckId:'violet'})).body.code;
  await request('/api/rooms/'+code+'/join',b.token,{deckId:'red'});
  let g=JSON.parse((app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code) as any).game);
  g.phase='main';g.turn=1;g.players[0].hand=[];
  app.db.prepare('UPDATE rooms SET game=?,deadline=?,turn_deadline=? WHERE code=?').run(JSON.stringify(g),Date.now()+120000,Date.now()+120000,code);
  const cmd={type:'rulerDraw',key:'draw-ruler-api',expectedRevision:g.revision};
  const accepted=await request('/api/rooms/'+code+'/commands',a.token,cmd);
  assert.equal(accepted.status,200,JSON.stringify(accepted.body));assert.equal(accepted.body.game.players[0].hp,38);
  assert.equal(accepted.body.game.players[0].lastRulerDrawTurn,1);
  const timing=app.db.prepare('SELECT deadline,turn_deadline FROM rooms WHERE code=?').get(code);
  assert.equal((await request('/api/rooms/'+code+'/commands',a.token,cmd)).status,200);
  assert.deepEqual(app.db.prepare('SELECT deadline,turn_deadline FROM rooms WHERE code=?').get(code),timing);
  assert.equal((await request('/api/rooms/'+code+'/commands',a.token,{...cmd,key:'twice',expectedRevision:accepted.body.game.revision})).status,409);
  g=JSON.parse((app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code) as any).game);
  g.players[0].legends=[{objectId:900,card:{id:'legend',name:'Test legend',kind:'legend',loyaltyAbilities:[{delta:1,kind:'healRuler',amount:1},{delta:-2,kind:'draw',amount:1}]},loyalty:4,exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:1}];
  app.db.prepare('UPDATE rooms SET game=? WHERE code=?').run(JSON.stringify(g),code);
  assert.equal((await request('/api/rooms/'+code+'/commands',a.token,{type:'activateLegend',objectId:900,abilityIndex:0,key:'ability-choice',expectedRevision:g.revision})).status,200);
  const event=app.db.prepare('SELECT action FROM match_events WHERE room=? ORDER BY seq DESC LIMIT 1').get(code) as any;
  assert.equal(JSON.parse(event.action).abilityIndex,0);
 }finally{app.close()}
});



test('tester bot uses an official starter and does not enter public match statistics',async()=>{
 const {app,request,register}=await fixture();
 try{
  const user=await register('BotTester');
  const created=await request('/api/bot',user.token,{deckId:'red'});
  assert.equal(created.status,201,JSON.stringify(created.body));
  assert.equal(created.body.bot,true);
  const code=created.body.code;
  let snapshot=(await request('/api/rooms/'+code,user.token)).body;
  assert.equal(snapshot.bot,true);
  assert.equal(snapshot.game.players[0].hp,40);
  assert.equal(snapshot.game.players[1].hp,40);
  assert.equal(snapshot.game.players[1].hand,undefined,'bot hand must remain hidden');
  assert.equal(snapshot.game.mulliganReady[1],true,'bot accepts its mulligan');
  let done=await request('/api/rooms/'+code+'/commands',user.token,{type:'mulligan',indices:[],expectedRevision:snapshot.game.revision,key:'tester-accept'});
  assert.equal(done.status,200,JSON.stringify(done.body));
  snapshot=(await request('/api/rooms/'+code,user.token)).body;
  assert.equal(snapshot.game.phase,'main');
  // The bot should eventually act without a second user's browser.
  const action=await request('/api/rooms/'+code+'/commands',user.token,{type:'endTurn',expectedRevision:snapshot.game.revision,key:'tester-end'});
  assert.equal(action.status,200,JSON.stringify(action.body));
  snapshot=(await request('/api/rooms/'+code,user.token)).body;
  assert.ok(snapshot.game.turn>=2);
  assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM match_history WHERE room=?').get(code).n,0,'test games cannot affect ratings');
  const lobby=(await request('/api/lobby',user.token)).body;
  assert.equal(lobby.online,1);
 }finally{app.close()}
});

test('test-bot strategy never relies on shuffled own deck order or hidden enemy hand',async()=>{
 const {openingGame}=await import('../src/core.ts');
 const {openingHand}=await import('../src/setup.ts');
 const {testDeck}=await import('../src/decks.ts');
 const {observeBot,drawProbability,chooseBotCommand}=await import('../src/bots/opponent.ts');
 const red=testDeck('red'),blue=testDeck('blue');
 const game=openingGame(openingHand(blue,125),openingHand(red,250));
 const one=observeBot(game,'red');
 const altered=structuredClone(game);
 altered.players[1].deck.reverse();
 altered.players[0].deck.reverse();
 altered.players[0].hand.reverse();
 // Enemy hand identities are hidden: replace cards while preserving hand size.
 altered.players[0].hand=altered.players[0].hand.map(()=>blue[0]);
 const two=observeBot(altered,'red');
 assert.deepEqual([...one.remaining],[...two.remaining]);
 assert.deepEqual([...one.enemyArchetypeOdds],[...two.enemyArchetypeOdds]);
 assert.equal(one.domainDrawChance,two.domainDrawChance);
 assert.deepEqual(chooseBotCommand(game,'red'),chooseBotCommand(altered,'red'));
 assert.equal(drawProbability(10,2,2),1-(8/10)*(7/9));
 assert.equal(drawProbability(10,0,2),0);
 assert.equal(drawProbability(10,10,1),1);
});
