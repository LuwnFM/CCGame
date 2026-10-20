import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import { apply, openingGame, RuleError, type Command, type Game, type PlayerId } from './core.ts';
import { openingHand } from './setup.ts';
import { ARCHETYPES, testDeck, type ArchetypeId } from './decks.ts';
import { nextRandom } from './ritual.ts';

type Room = { code: string; host: string; guest: string | null; host_deck: ArchetypeId | null;
  game: string; deadline: number; turn_deadline: number; intercept_started: number; intercept_banks: string };
const TURN_MS = 120_000, INTERCEPT_MS = 15_000, BANK_MS = 45_000, CHOICE_MS = 60_000, MULLIGAN_MS = 90_000;
function timers(before: Game, after: Game, row: Room, now: number) {
  let turn = row.turn_deadline, started = row.intercept_started;
  const banks = JSON.parse(row.intercept_banks) as [number, number];
  if (before.phase === 'intercept' && after.phase !== 'intercept' && started) {
    const defender = before.pendingAttack!.defender;
    const elapsed = Math.max(0, now - started);
    banks[defender] = Math.max(0, banks[defender] - elapsed);
    // Defender's reaction does not use the attacker's 120-second clock.
    if (turn) turn += elapsed;
    started = 0;
  }
  if (before.turn !== after.turn) {
    turn = now + TURN_MS;
    banks[(1 - after.active) as PlayerId] = BANK_MS;
  }
  let deadline = 0;
  if (after.phase === 'mulligan') deadline = now + MULLIGAN_MS;
  if (after.phase === 'main') deadline = turn;
  if (['ritual', 'reward', 'discard'].includes(after.phase)) deadline = Math.min(turn, now + CHOICE_MS);
  if (after.phase === 'intercept') {
    if (!started) started = now;
    const defender = after.pendingAttack!.defender;
    deadline = Math.min(now + INTERCEPT_MS, now + banks[defender]);
  }
  return { deadline, turn, started, banks: JSON.stringify(banks) };
}
function timeoutCommand(game: Game): { command: Command; seed: number } {
  let seed = game.seed ?? 1;
  const roll = (size: number) => { const r = nextRandom(seed, size); seed = r.seed; return r.value; };
  const common = { expectedRevision: game.revision, key: `timeout-${game.revision}` };
  let action: object;
  let actor: PlayerId = game.active;
  switch (game.phase) {
    case 'mulligan': actor = game.mulliganReady?.[0] ? 1 : 0; action = { type: 'mulligan', indices: [] }; break;
    case 'intercept': actor = game.pendingAttack!.defender; action = { type: 'intercept', interceptorId: null }; break;
    case 'main': action = { type: 'endTurn' }; break;
    case 'discard': action = { type: 'discard', handIndex: roll(game.players[actor].hand.length) }; break;
    case 'ritual': {
      const ready = game.readyRituals![roll(game.readyRituals!.length)];
      const candidates = [...ready.eligibleIds], ids: number[] = [];
      for (let i = 0; i < ready.effect.threshold; i++) ids.push(candidates.splice(roll(candidates.length), 1)[0]);
      action = { type: 'chooseRitual', effectId: ready.effect.id, objectIds: ids }; break;
    }
    case 'reward': {
      const pending = game.pendingReward!;
      const rewardId = pending.offeredIds[roll(3)];
      const card = pending.pool.find(c => c.id === rewardId)!;
      const zone = card.createdToken ? game.players[actor].auxiliary : game.players[actor].main;
      const eligible = zone.filter(c => !c.card.majestic);
      const replaceId = zone.length >= (card.createdToken ? 4 : 8) && eligible.length ? eligible[roll(eligible.length)].objectId : undefined;
      action = { type: 'chooseReward', rewardId, replaceId }; break;
    }
    default: throw new RuleError('Нет выбора с истёкшим временем');
  }
  return { command: { ...common, ...action, actor } as Command, seed };
}

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
function deckId(input: unknown): ArchetypeId {
  if (typeof input !== 'string' || !ARCHETYPES.some(a => a.id === input)) throw new RuleError('Выберите тестовую колоду');
  return input as ArchetypeId;
}
function newGame(host: ArchetypeId, guest: ArchetypeId): Game {
  const seed = () => randomBytes(4).readUInt32LE(0) || 1;
  return openingGame(openingHand(testDeck(host), seed()), openingHand(testDeck(guest), seed()));
}
function view(game: Game, seat: PlayerId, row?: Room) {
  return {
    rulesVersion: game.rulesVersion, revision: game.revision, turn: game.turn,
    active: game.active, phase: game.phase, winner: game.winner, pendingAttack: game.pendingAttack,
    seat, mulliganReady: game.mulliganReady, deadlineAt: row?.deadline, turnDeadlineAt: row?.turn_deadline,
    timeoutStreak: game.timeoutStreak,
    readyRituals: game.active === seat ? game.readyRituals?.map(r => ({ id: r.effect.id, threshold: r.effect.threshold, color: r.effect.color, eligibleIds: r.eligibleIds })) : undefined,
    pendingReward: game.pendingReward?.owner === seat ? game.pendingReward.offeredIds.map(id => game.pendingReward!.pool.find(card => card.id === id)) : undefined,
    pauseReason: game.pauseReason,
    players: game.players.map((p, i) => ({ hp: p.hp, hand: i === seat ? p.hand : undefined,
      handCount: p.hand.length, deckCount: p.deck.length, discardCount: p.discard.length,
      erasedCount: p.erased.length, domains: p.domains, main: p.main, auxiliary: p.auxiliary, legends: p.legends,
      energy: p.energy, domainsPlayed: p.domainsPlayed, rituals: p.rituals.map(r => ({ id: r.id, color: r.color, threshold: r.threshold, remainingStarts: r.remainingStarts })) }))
  };
}
export function createApp(options: { databasePath: string; accessPassword: string }) {
  if (!options.accessPassword || options.accessPassword.length < 12) throw new Error('FIREWELL_ALPHA_PASSWORD должен содержать не менее 12 символов');
  const db = new DatabaseSync(options.databasePath);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL, guest TEXT, game TEXT NOT NULL,
      host_deck TEXT, deadline INTEGER NOT NULL DEFAULT 0, turn_deadline INTEGER NOT NULL DEFAULT 0,
      intercept_started INTEGER NOT NULL DEFAULT 0, intercept_banks TEXT NOT NULL DEFAULT '[45000,45000]');`);
  const columns = new Set((db.prepare('PRAGMA table_info(rooms)').all() as { name: string }[]).map(c => c.name));
  for (const [column, definition] of Object.entries({ host_deck: 'TEXT', deadline: 'INTEGER NOT NULL DEFAULT 0',
    turn_deadline: 'INTEGER NOT NULL DEFAULT 0', intercept_started: 'INTEGER NOT NULL DEFAULT 0',
    intercept_banks: `TEXT NOT NULL DEFAULT '[45000,45000]'` }))
    if (!columns.has(column)) db.exec(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`);
  const selectSession = db.prepare('SELECT id FROM sessions WHERE id=? AND expires>?');
  const selectRoom = db.prepare('SELECT * FROM rooms WHERE code=?');
  const insertRoom = db.prepare('INSERT INTO rooms (code,host,guest,game,host_deck) VALUES (?, ?, NULL, ?, ?)');
  const updateRoom = db.prepare('UPDATE rooms SET game=?, deadline=?, turn_deadline=?, intercept_started=?, intercept_banks=? WHERE code=?');
  function commitGame(code: string, row: Room, before: Game, next: Game, now: number) {
    const timing = timers(before, next, row, now);
    updateRoom.run(JSON.stringify(next), timing.deadline, timing.turn, timing.started, timing.banks, code);
  }
  function settleExpired(code: string, row: Room, now: number): Room {
    if (!row.guest || !row.deadline || now < row.deadline) return row;
    const before = JSON.parse(row.game) as Game;
    if (before.phase === 'finished' || before.phase === 'paused') return row;
    const { command, seed } = timeoutCommand(before);
    const input = structuredClone(before); input.seed = seed;
    const next = apply(input, command);
    if (before.phase === 'main' && next.phase !== 'paused') {
      next.timeoutStreak ??= [0, 0];
      if (++next.timeoutStreak[before.active] >= 3) {
        next.winner = (1 - before.active) as PlayerId;
        next.phase = 'finished';
      }
    }
    commitGame(code, row, before, next, now);
    return selectRoom.get(code) as Room;
  }
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
      if (url.pathname === '/api/decks' && req.method === 'GET') return json(res, 200, { decks: ARCHETYPES });
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        const choice = deckId((await body(req)).deckId ?? 'red');
        let code = '';
        do code = randomBytes(4).toString('hex').toUpperCase(); while (selectRoom.get(code));
        insertRoom.run(code, sid, '{}', choice);
        return json(res, 201, { code, seat: 0 });
      }
      const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|commands))?$/.exec(url.pathname);
      if (!match) return json(res, 404, { error: 'Не найдено' });
      const code = match[1], action = match[2];
      if (action === 'join' && req.method === 'POST') {
        const choice = deckId((await body(req)).deckId ?? 'red');
        db.exec('BEGIN IMMEDIATE');
        try {
          const row = selectRoom.get(code) as { host: string; guest: string | null; host_deck: ArchetypeId | null } | undefined;
          if (!row || (row.guest && row.guest !== sid) || row.host === sid) throw new RuleError('Комната недоступна');
          if (!row.guest) {
            const game = newGame(row.host_deck ?? 'red', choice);
            db.prepare('UPDATE rooms SET guest=?, game=?, deadline=? WHERE code=?').run(sid, JSON.stringify(game), Date.now() + MULLIGAN_MS, code);
          }
          db.exec('COMMIT');
          return json(res, 200, { code, seat: 1 });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      const row = selectRoom.get(code) as Room | undefined;
      if (!row || (row.host !== sid && row.guest !== sid)) return json(res, 404, { error: 'Комната недоступна' });
      const seat: PlayerId = row.host === sid ? 0 : 1;
      if (req.method === 'GET' && !action) {
        db.exec('BEGIN IMMEDIATE');
        let current: Room;
        try { current = settleExpired(code, selectRoom.get(code) as Room, Date.now()); db.exec('COMMIT'); }
        catch (error) { db.exec('ROLLBACK'); throw error; }
        return json(res, 200, { code, ready: !!current.guest, game: current.guest ? view(JSON.parse(current.game), seat, current) : null });
      }
      if (req.method === 'POST' && action === 'commands') {
        if (!row.guest) throw new RuleError('Ожидание второго игрока');
        const input = await body(req);
        if (!input || typeof input !== 'object' || !['mulligan', 'playDomain', 'tapDomain', 'playCreature', 'playTechnique', 'playLegend', 'activateLegend', 'playArtifact', 'chooseRitual', 'chooseReward', 'attack', 'intercept', 'endTurn', 'discard'].includes(input.type))
          throw new RuleError('Недопустимая команда');
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = settleExpired(code, selectRoom.get(code) as Room, Date.now());
          const before = JSON.parse(current.game) as Game;
          const next = apply(before, { ...input, actor: seat } as Command);
          if (input.type === 'endTurn' && next.phase !== 'paused') {
            next.timeoutStreak ??= [0, 0]; next.timeoutStreak[seat] = 0;
          }
          commitGame(code, current, before, next, Date.now());
          db.exec('COMMIT');
          return json(res, 200, { game: view(next, seat, selectRoom.get(code) as Room) });
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
