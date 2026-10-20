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
    const created = await request('/api/rooms', {}, host);
    assert.equal(created.status, 201);
    const code = created.body.code;
    assert.equal((await request(`/api/rooms/${code}`, undefined, guest)).status, 404);
    assert.equal((await request(`/api/rooms/${code}/join`, {}, guest)).status, 200);
    const guestView = (await request(`/api/rooms/${code}`, undefined, guest)).body.game;
    assert.equal(guestView.players[0].hand, undefined);
    assert.equal(guestView.players[0].handCount, 7);
    assert.equal(guestView.players[1].hand.length, 7);
    const malicious = await request(`/api/rooms/${code}/commands`, { type: 'playDomain', actor: 0, handIndex: 0, expectedRevision: 1, key: 'guest-cheat' }, guest);
    assert.equal(malicious.status, 409);
    const played = await request(`/api/rooms/${code}/commands`, { type: 'playDomain', actor: 1, handIndex: 0, expectedRevision: 1, key: 'host-land' }, host);
    assert.equal(played.status, 200);
    assert.equal(played.body.game.players[0].domains.length, 1);
    assert.equal(played.body.game.players[1].hand, undefined);
  } finally { app.close(); }
});
