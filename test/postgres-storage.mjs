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
  await stop();
  app = createApp({ databasePath: ':memory:', accessPassword:password });
  base = await start();
  result = await request(base, '/api/login', 'POST', { login, password:'ProfilePass123' });
  assert.equal(result.status, 200, JSON.stringify(result.data));
  assert.equal(result.data.account.id, account.id);
  result = await request(base, '/api/feedback/mine', 'GET', undefined, result.data.token);
  assert.equal(result.status, 200);
  assert.equal(result.data.reports[0].title, 'Storage smoke');
  console.log('PostgreSQL smoke: registration, chat, feedback, lobby, restart/login PASS');
} finally {
  try { await stop(); } catch { /* already closed */ }
}
