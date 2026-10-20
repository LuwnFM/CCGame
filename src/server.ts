import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { apply, initialGame, player, RuleError, type Card, type Command, type Game, type PlayerId } from './core.ts';

const cookieName = 'firewell_alpha';
const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' });
  res.end(JSON.stringify(body));
};
const digest = (s: string) => createHash('sha256').update(s).digest();
function checkPassword(given: string, expected: string): boolean {
  if (typeof given !== 'string' || given.length > 4096) return false;
  return timingSafeEqual(digest(given), digest(expected));
}
async function body(req: IncomingMessage): Promise<any> {
  let data = '';
  for await (const chunk of req) {
    data += chunk;
    if (data.length > 20000) throw new RuleError('Слишком большой запрос');
  }
  try { return JSON.parse(data || '{}'); } catch { throw new RuleError('Неверный JSON'); }
}
function sessionId(req: IncomingMessage): string | null {
  const found = (req.headers.cookie ?? '').split(';').map(x => x.trim()).find(x => x.startsWith(cookieName + '='));
  const value = found?.slice(cookieName.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
function demoDeck(): Card[] {
  const land: Card = { id: 'red-domain', name: 'Базовое красное Владение', kind: 'domain', basic: true, produces: 'red' };
  return [land, ...Array.from({ length: 6 }, (_, i): Card => ({ id: `init-${i}`, name: `Стражник ${i + 1}`, kind: 'creature', aspects: ['red'], cost: { colored: { red: 1 }, generic: 0 }, attack: 2, health: 2, abilities: [] })),
    ...Array(25).fill(land), ...Array.from({ length: 38 }, (_, i): Card => ({ id: `deck-${i}`, name: `Боец ${i + 1}`, kind: 'creature', aspects: ['red'], cost: { colored: { red: 1 }, generic: 0 }, attack: 2, health: 2, abilities: [] }))];
}
function demoGame(): Game {
  const a = demoDeck(), b = demoDeck();
  return apply(initialGame(player(a.slice(7), a.slice(0, 7)), player(b.slice(7), b.slice(0, 7))),
    { type: 'startTurn', actor: 0, expectedRevision: 0, key: 'server-initial-turn' });
}
function view(game: Game, seat: PlayerId) {
  return {
    rulesVersion: game.rulesVersion, revision: game.revision, turn: game.turn,
    active: game.active, phase: game.phase, winner: game.winner, pendingAttack: game.pendingAttack,
    seat, players: game.players.map((p, i) => ({ hp: p.hp, hand: i === seat ? p.hand : undefined,
      handCount: p.hand.length, deckCount: p.deck.length, discardCount: p.discard.length,
      erasedCount: p.erased.length, domains: p.domains, main: p.main, auxiliary: p.auxiliary,
      energy: p.energy, domainsPlayed: p.domainsPlayed }))
  };
}
export function createApp(options: { databasePath: string; accessPassword: string }) {
  if (!options.accessPassword || options.accessPassword.length < 12) throw new Error('FIREWELL_ALPHA_PASSWORD должен содержать не менее 12 символов');
  const db = new DatabaseSync(options.databasePath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL, guest TEXT, game TEXT NOT NULL);`);
  const selectSession = db.prepare('SELECT id FROM sessions WHERE id=? AND expires>?');
  const selectRoom = db.prepare('SELECT * FROM rooms WHERE code=?');
  const insertRoom = db.prepare('INSERT INTO rooms (code,host,guest,game) VALUES (?, ?, NULL, ?)');
  const updateRoom = db.prepare('UPDATE rooms SET game=? WHERE code=?');
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://local');
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'x-content-type-options': 'nosniff' });
        res.end(await readFile(new URL('../web/index.html', import.meta.url)));
        return;
      }
      if (url.pathname === '/api/access' && req.method === 'POST') {
        const input = await body(req);
        if (!checkPassword(input.password, options.accessPassword)) return json(res, 403, { error: 'Неверный пароль' });
        const sid = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions (id, expires) VALUES (?, ?)').run(sid, Date.now() + 7 * 86400_000);
        res.setHeader('set-cookie', `${cookieName}=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=604800`);
        return json(res, 200, { ok: true });
      }
      const sid = sessionId(req);
      if (!sid || !selectSession.get(sid, Date.now())) return json(res, 401, { error: 'Нужен пароль альфы' });
      if (req.method === 'POST' && req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
        return json(res, 403, { error: 'Недопустимый источник' });
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        let code = '';
        do code = randomBytes(4).toString('hex').toUpperCase(); while (selectRoom.get(code));
        insertRoom.run(code, sid, JSON.stringify(demoGame()));
        return json(res, 201, { code, seat: 0 });
      }
      const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|commands))?$/.exec(url.pathname);
      if (!match) return json(res, 404, { error: 'Не найдено' });
      const code = match[1], action = match[2];
      if (action === 'join' && req.method === 'POST') {
        db.exec('BEGIN IMMEDIATE');
        try {
          const row = selectRoom.get(code) as { host: string; guest: string | null } | undefined;
          if (!row || (row.guest && row.guest !== sid) || row.host === sid) throw new RuleError('Комната недоступна');
          db.prepare('UPDATE rooms SET guest=? WHERE code=?').run(sid, code);
          db.exec('COMMIT');
          return json(res, 200, { code, seat: 1 });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      const row = selectRoom.get(code) as { host: string; guest: string | null; game: string } | undefined;
      if (!row || (row.host !== sid && row.guest !== sid)) return json(res, 404, { error: 'Комната недоступна' });
      const seat: PlayerId = row.host === sid ? 0 : 1;
      if (req.method === 'GET' && !action) return json(res, 200, { code, ready: !!row.guest, game: view(JSON.parse(row.game), seat) });
      if (req.method === 'POST' && action === 'commands') {
        if (!row.guest) throw new RuleError('Ожидание второго игрока');
        const input = await body(req);
        if (!input || typeof input !== 'object' || !['playDomain', 'tapDomain', 'playCreature', 'attack', 'intercept', 'endTurn', 'discard'].includes(input.type))
          throw new RuleError('Недопустимая команда');
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = selectRoom.get(code) as { game: string };
          const next = apply(JSON.parse(current.game), { ...input, actor: seat } as Command);
          updateRoom.run(JSON.stringify(next), code);
          db.exec('COMMIT');
          return json(res, 200, { game: view(next, seat) });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      return json(res, 404, { error: 'Не найдено' });
    } catch (error) {
      return json(res, error instanceof RuleError ? 409 : 500, { error: error instanceof Error ? error.message : 'Ошибка сервера' });
    }
  });
  return { server, db, close: () => { server.close(); db.close(); } };
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = createApp({ databasePath: process.env.FIREWELL_DB ?? './firewell.sqlite', accessPassword: process.env.FIREWELL_ALPHA_PASSWORD ?? '' });
  const port = Number(process.env.PORT ?? 3000);
  app.server.listen(port, () => process.stdout.write(`Firewell CCG: http://localhost:${port}\n`));
}
