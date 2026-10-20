import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from '../src/server.ts';

test('password gate, two seats, hidden opposing hand and authoritative actor', async () => {
  const app = createApp({ databasePath: ':memory:', accessPassword: 'test-password-long-enough' });
  await new Promise<void>(resolve => app.server.listen(0, resolve));
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const url = `http://127.0.0.1:${address.port}`;
  async function request(path: string, data?: object, cookie = '') {
    const response = await fetch(url + path, { method: data ? 'POST' : 'GET', headers: { 'content-type': 'application/json', cookie }, body: data ? JSON.stringify(data) : undefined });
    return { status: response.status, cookie: response.headers.get('set-cookie')?.split(';')[0] ?? '', body: await response.json() };
  }
  try {
    assert.equal((await request('/api/rooms', {})).status, 401);
    assert.equal((await request('/api/access', { password: 'wrong' })).status, 403);
    const host = (await request('/api/access', { password: 'test-password-long-enough' })).cookie;
    const guest = (await request('/api/access', { password: 'test-password-long-enough' })).cookie;
    const created = await request('/api/rooms', { deckId: 'violet' }, host);
    assert.equal(created.status, 201);
    const code = created.body.code;
    assert.equal((await request(`/api/rooms/${code}`, undefined, guest)).status, 404);
    assert.equal((await request(`/api/rooms/${code}`, undefined, host)).body.game, null);
    assert.equal((await request(`/api/rooms/${code}/join`, { deckId: 'blue' }, guest)).status, 200);
    const guestView = (await request(`/api/rooms/${code}`, undefined, guest)).body.game;
    assert.equal(guestView.phase, 'mulligan');
    assert.equal(guestView.players[0].hand, undefined);
    assert.equal(guestView.players[0].handCount, 7);
    assert.equal(guestView.players[1].hand.length, 7);
    const malicious = await request(`/api/rooms/${code}/commands`, { type: 'playDomain', actor: 0, handIndex: 0, expectedRevision: 0, key: 'guest-cheat' }, guest);
    assert.equal(malicious.status, 409);
    const chosen = await request(`/api/rooms/${code}/commands`, { type: 'mulligan', actor: 1, indices: [], expectedRevision: 0, key: 'host-mulligan' }, host);
    assert.equal(chosen.status, 200);
    assert.equal(chosen.body.game.phase, 'mulligan');
    const started = await request(`/api/rooms/${code}/commands`, { type: 'mulligan', actor: 0, indices: [], expectedRevision: 1, key: 'guest-mulligan' }, guest);
    assert.equal(started.status, 200);
    assert.equal(started.body.game.phase, 'main');
    const hostView = (await request(`/api/rooms/${code}`, undefined, host)).body.game;
    const domainIndex = hostView.players[0].hand.findIndex((c: { kind: string }) => c.kind === 'domain');
    assert.ok(domainIndex >= 0);
    const played = await request(`/api/rooms/${code}/commands`, { type: 'playDomain', actor: 1, handIndex: domainIndex, expectedRevision: 2, key: 'host-land' }, host);
    assert.equal(played.status, 200);
    assert.equal(played.body.game.players[0].domains.length, 1);
    assert.equal(played.body.game.players[1].hand, undefined);
    assert.equal((await request(`/api/rooms/${code}/join`, { deckId: 'red' }, guest)).status, 200);
    assert.equal((await request(`/api/rooms/${code}`, undefined, host)).body.game.revision, 3);
  } finally { app.close(); }
});

test('expired server deadlines make legal, recorded automatic choices and advance the match', async () => {
  const app = createApp({ databasePath: ':memory:', accessPassword: 'test-password-long-enough' });
  await new Promise<void>(resolve => app.server.listen(0, resolve));
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('No port');
  const base = `http://127.0.0.1:${address.port}`;
  const request = async (path: string, cookie = '', data?: object) => {
    const r = await fetch(base + path, { method: data ? 'POST' : 'GET', headers: { cookie, 'content-type': 'application/json' }, body: data ? JSON.stringify(data) : undefined });
    return { result: await r.json(), cookie: r.headers.get('set-cookie')?.split(';')[0] ?? '' };
  };
  try {
    const host = (await request('/api/access', '', { password: 'test-password-long-enough' })).cookie;
    const guest = (await request('/api/access', '', { password: 'test-password-long-enough' })).cookie;
    const code = (await request('/api/rooms', host, { deckId: 'red' })).result.code;
    await request(`/api/rooms/${code}/join`, guest, { deckId: 'blue' });
    const expire = app.db.prepare('UPDATE rooms SET deadline=? WHERE code=?');
    expire.run(Date.now() - 1, code);
    let match = (await request(`/api/rooms/${code}`, host)).result.game;
    assert.deepEqual(match.mulliganReady, [true, false]);
    assert.ok(match.revision === 1);
    expire.run(Date.now() - 1, code);
    match = (await request(`/api/rooms/${code}`, guest)).result.game;
    assert.equal(match.phase, 'main');
    assert.equal(match.turn, 1);
    expire.run(Date.now() - 1, code);
    match = (await request(`/api/rooms/${code}`, host)).result.game;
    assert.equal(match.turn, 2);
    assert.equal(match.timeoutStreak[0], 1);
  } finally { app.close(); }
});
