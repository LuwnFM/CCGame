// Dedicated integration smoke with a disposable PostgreSQL database.
// Requires FIREWELL_TEST_POSTGRES_URL; never use a live player database here.
import assert from 'node:assert/strict';
import { createApp } from '../src/server.ts';
const url = process.env.FIREWELL_TEST_POSTGRES_URL;
if (!url) {
  console.log('PostgreSQL smoke skipped (FIREWELL_TEST_POSTGRES_URL not supplied)');
  process.exit(0);
}
process.env.FIREWELL_STORAGE = 'postgres';
process.env.DATABASE_URL = url;
const password = 'TestAlpha12345';
let app = createApp({ databasePath: ':memory:', accessPassword: password });
async function start() {
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  return 'http://127.0.0.1:' + app.server.address().port;
}
async function stop() {
  await new Promise(resolve => app.server.close(resolve));
  app.db.close();
}
async function request(base, path, method = 'GET', body, token) {
  const result = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type':'application/json' } : {}),
      ...(token ? { authorization:'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: result.status, data: await result.json() };
}
const login = 'smoke_' + Math.random().toString(36).slice(2, 12);
try {
  let base = await start();
  let result = await request(base, '/api/health');
  assert.equal(result.status, 200);
  result = await request(base, '/api/register', 'POST', { login, password:'ProfilePass123', accessPassword:password });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const { token, account } = result.data;
  result = await request(base, '/api/feedback', 'POST', {
    category:'idea', title:'Storage smoke', text:'PostgreSQL persisted feedback test'
  }, token);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  assert.ok(Number(result.data.report.id) > 0);
  result = await request(base, '/api/chat', 'POST', { text:'Postgres smoke' }, token);
  assert.equal(result.status, 201, JSON.stringify(result.data));
  result = await request(base, '/api/lobby', 'GET', undefined, token);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  const secondLogin = login + '_b';
  const second = await request(base, '/api/register', 'POST', {
    login:secondLogin, password:'SecondProfile123', accessPassword:password
  });
  assert.equal(second.status, 200, JSON.stringify(second.data));
  const created = await request(base, '/api/rooms', 'POST', { deckId:'red' }, token);
  assert.equal(created.status, 201, JSON.stringify(created.data));
  const room = created.data.code;
  const joined = await request(base, '/api/rooms/' + room + '/join', 'POST',
    { deckId:'green' }, second.data.token);
  assert.equal(joined.status, 200, JSON.stringify(joined.data));
  result = await request(base, '/api/rooms/' + room, 'GET', undefined, token);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.ready, true);
  const revision = result.data.game.revision;
  const botCreated = await request(base,'/api/bot','POST',{deckId:'green'},token);
  assert.equal(botCreated.status,201,JSON.stringify(botCreated.data));
  const botCode=botCreated.data.code;
  const mulligan = await request(base, '/api/rooms/' + room + '/commands', 'POST',
    { type:'mulligan', indices:[], expectedRevision:revision, key:'pg-smoke-mulligan' }, token);
  assert.equal(mulligan.status, 200, JSON.stringify(mulligan.data));
  // Save already-running PvP + bot room state and simulate a restart that
  // takes longer than their old clocks. The new instance must not forfeit.
  const ongoing=[room,botCode].map(code=>({
    code,game:app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code).game
  }));
  for(const entry of ongoing)app.db.prepare('UPDATE rooms SET deadline=?,turn_deadline=? WHERE code=?')
    .run(Date.now()-600000,Date.now()-600000,entry.code);
  await stop();
  app = createApp({ databasePath: ':memory:', accessPassword:password });
  base = await start();
  result = await request(base, '/api/login', 'POST', { login, password:'ProfilePass123' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.account.id, account.id);
  const restoredToken = result.data.token;
  result = await request(base, '/api/feedback/mine', 'GET', undefined, restoredToken);
  assert.equal(result.status, 200);
  assert.equal(result.data.reports[0].title, 'Storage smoke');
  result = await request(base, '/api/rooms/' + room, 'GET', undefined, restoredToken);
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.game.revision >= revision, true);
  for(const entry of ongoing){
    const snapshot=app.db.prepare('SELECT game,deadline FROM rooms WHERE code=?').get(entry.code);
    assert.equal(snapshot.game,entry.game,'No game-state loss on Postgres deployment');
    assert.ok(snapshot.deadline>Date.now()+10000,'Restart clock protection missing');
    const match=await request(base,'/api/rooms/'+entry.code,'GET',undefined,restoredToken);
    assert.equal(match.status,200,JSON.stringify(match.data));
    assert.notEqual(match.data.game.phase,'finished');
  }
  console.log('PostgreSQL smoke: accounts, PvP + bot live rooms, timer recovery and restart PASS');
} finally {
  try { await stop(); } catch { /* already closed */ }
}
