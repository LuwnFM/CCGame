import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync, statSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { apply, openingGame, RULES_VERSION, RuleError, type Command, type Game, type PlayerId } from './core.ts';
import { apply as applyLegacy, RuleError as LegacyRuleError } from './legacy/core-v0.9.13.ts';
const LEGACY_RULES_VERSION = '0.9.13-alpha';
export function applyForMatch(game: Game, command: Command): Game {
  if (game.rulesVersion === LEGACY_RULES_VERSION) {
    if (command.type === 'rulerDraw') throw new RuleError('Эта способность недоступна в версии старого матча');
    return applyLegacy(game as any, command as any) as Game;
  }
  if (game.rulesVersion === RULES_VERSION) return apply(game, command);
  throw new RuleError('Версия правил матча больше не поддерживается');
}
import { openingHand } from './setup.ts';
import { ARCHETYPES, testDeck, type ArchetypeId } from './decks.ts';
import { nextRandom } from './ritual.ts';
import { Social, catalog } from './social.ts';
import type { Card } from './core.ts';
import { MatchHistory } from './history.ts';

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
export function timeoutCommand(game: Game): { command: Command; seed: number } {
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
function newGame(host: readonly Card[], guest: readonly Card[]): Game {
  const seed = () => randomBytes(4).readUInt32LE(0) || 1;
  return openingGame(openingHand(host, seed()), openingHand(guest, seed()));
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
      handCount: p.hand.length, deckCount: p.deck.length, discardCount: p.discard.length, discard: i === seat ? p.discard : undefined,
      erasedCount: p.erased.length, domains: p.domains, main: p.main, auxiliary: p.auxiliary, legends: p.legends,
      lastRulerDrawTurn: p.lastRulerDrawTurn, energy: p.energy, domainsPlayed: p.domainsPlayed, rituals: p.rituals.map(r => ({ id: r.id, color: r.color, threshold: r.threshold, remainingStarts: r.remainingStarts })) }))
  };
}
export function createApp(options: { databasePath: string; accessPassword: string; clientOrigin?: string }) {
  if (!options.accessPassword || options.accessPassword.length < 10) throw new Error('FIREWELL_ALPHA_PASSWORD должен содержать не менее 10 символов');
  const existingFile = options.databasePath !== ':memory:' && existsSync(options.databasePath) && statSync(options.databasePath).size > 0;
  const db = new DatabaseSync(options.databasePath);
  // SQLite VACUUM INTO produces a transactionally consistent backup, including
  // writes held in the WAL. Keep seven snapshots before applying migrations.
  if (existingFile) {
    const folder = join(dirname(options.databasePath), 'backups');
    mkdirSync(folder, { recursive: true });
    const filename = basename(options.databasePath) + '.' + new Date().toISOString().replace(/[:.]/g, '-') + '-' +
      randomBytes(2).toString('hex') + '.sqlite';
    db.prepare('VACUUM INTO ?').run(join(folder, filename));
    const files = readdirSync(folder).filter(file => file.startsWith(basename(options.databasePath) + '.') && file.endsWith('.sqlite')).sort();
    for (const old of files.slice(0, Math.max(0, files.length - 7))) unlinkSync(join(folder, old));
  }
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, expires INTEGER NOT NULL, user_id TEXT);
    CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, host TEXT NOT NULL, guest TEXT, game TEXT NOT NULL,
      host_deck TEXT, deadline INTEGER NOT NULL DEFAULT 0, turn_deadline INTEGER NOT NULL DEFAULT 0,
      intercept_started INTEGER NOT NULL DEFAULT 0, intercept_banks TEXT NOT NULL DEFAULT '[45000,45000]');`);
  const columns = new Set((db.prepare('PRAGMA table_info(rooms)').all() as { name: string }[]).map(c => c.name));
  for (const [column, definition] of Object.entries({ host_deck: 'TEXT', deadline: 'INTEGER NOT NULL DEFAULT 0',
    turn_deadline: 'INTEGER NOT NULL DEFAULT 0', intercept_started: 'INTEGER NOT NULL DEFAULT 0',
    intercept_banks: `TEXT NOT NULL DEFAULT '[45000,45000]'` }))
    if (!columns.has(column)) db.exec(`ALTER TABLE rooms ADD COLUMN ${column} ${definition}`);
  const sessionColumns = new Set((db.prepare('PRAGMA table_info(sessions)').all() as {name:string}[]).map(c=>c.name));
  if (!sessionColumns.has('user_id')) db.exec('ALTER TABLE sessions ADD COLUMN user_id TEXT');
  const social = new Social(db);
  const history = new MatchHistory(db, options.databasePath);
  function archiveSafely() {
    try { history.archiveCompleted(); }
    catch(error) { console.error('Match archive failed; SQLite journal remains intact for retry:', error); }
  }
  archiveSafely();
  const selectSession = db.prepare('SELECT user_id FROM sessions WHERE id=? AND expires>?');
  const selectRoom = db.prepare('SELECT * FROM rooms WHERE code=?');
  const insertRoom = db.prepare('INSERT INTO rooms (code,host,guest,game,host_deck) VALUES (?, ?, NULL, ?, ?)');
  const updateRoom = db.prepare('UPDATE rooms SET game=?, deadline=?, turn_deadline=?, intercept_started=?, intercept_banks=? WHERE code=?');
  function commitGame(code:string,row:Room,before:Game,next:Game,now:number,
    source:'player'|'timeout',command:Command){
    if(next.revision<=before.revision)return;
    const timing=timers(before,next,row,now);
    updateRoom.run(JSON.stringify(next),timing.deadline,timing.turn,timing.started,timing.banks,code);
    if(next.revision>before.revision)history.record(code,source,command,before,next,now);
  }
  function settleExpired(code: string, row: Room, now: number): Room {
    if (!row.guest || !row.deadline || now < row.deadline) return row;
    const before = JSON.parse(row.game) as Game;
    if (before.phase === 'finished' || before.phase === 'paused') return row;
    const { command, seed } = timeoutCommand(before);
    const input = structuredClone(before); input.seed = seed;
    const next = applyForMatch(input, command);
    if (before.phase === 'main' && next.phase !== 'paused') {
      next.timeoutStreak ??= [0, 0];
      if (++next.timeoutStreak[before.active] >= 3) {
        next.winner = (1 - before.active) as PlayerId;
        next.phase = 'finished';
      }
    }
    commitGame(code, row, before, next, now,'timeout',command);
    return selectRoom.get(code) as Room;
  }
  // Limit online guessing of passwords; the alpha access password gates only registration.
  const authFailures = new Map<string, { attempts: number; blockedUntil: number }>();
  const AUTH_WINDOW_MS = 15 * 60_000;
  const AUTH_MAX_FAILURES = 15;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://local');
      const origin = req.headers.origin;
      if (origin && options.clientOrigin && origin === options.clientOrigin) {
        res.setHeader('access-control-allow-origin', origin);
        res.setHeader('vary', 'Origin');
        res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
        res.setHeader('access-control-allow-methods', 'GET, POST, DELETE, OPTIONS');
      }
      if (req.method === 'OPTIONS') {
        res.writeHead(origin === options.clientOrigin ? 204 : 403);
        return res.end();
      }
      let originHost = '';
      if (origin) { try { originHost = new URL(origin).host; } catch { return json(res,403,{error:'Недопустимый источник'}); } }
      if (origin && originHost !== req.headers.host && origin !== options.clientOrigin)
        return json(res,403,{error:'Недопустимый источник'});
      if (req.method === 'GET' && /^\/versions\/0\.9\.13\/(?:index\.html|app\.js|i18n\.js|rules\.js|style\.css)$/.test(url.pathname)) {
        const file = url.pathname.slice(1);
        const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        res.writeHead(200, {'content-type':contentType+'; charset=utf-8','x-content-type-options':'nosniff'});
        res.end(await readFile(new URL('../web/'+file, import.meta.url)));
        return;
      }
      if (req.method === 'GET' && ['/', '/style.css', '/app.js', '/i18n.js', '/rules.js'].includes(url.pathname)) {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const contentType = file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html';
        res.writeHead(200, { 'content-type': `${contentType}; charset=utf-8`, 'x-content-type-options': 'nosniff' });
        res.end(await readFile(new URL(`../web/${file}`, import.meta.url)));
        return;
      }
      if ((url.pathname === '/api/register' || url.pathname === '/api/login') && req.method === 'POST') {
        const address = req.socket.remoteAddress ?? 'unknown';
        const now = Date.now(), entry = authFailures.get(address);
        if (entry && entry.blockedUntil > now && entry.attempts >= AUTH_MAX_FAILURES)
          return json(res,429,{error:'Слишком много попыток входа. Повторите через 15 минут'});
        const input = await body(req);
        if (!input || typeof input !== 'object' || Array.isArray(input))
          throw new RuleError('Неверные данные профиля');
        let account;
        try {
          if (url.pathname === '/api/register' && !checkPassword(input.accessPassword, options.accessPassword))
            return json(res,403,{error:'Неверный пароль доступа к альфе'});
          account = url.pathname === '/api/register'
            ? social.register(input.login, input.password)
            : social.authenticate(input.login, input.password);
          authFailures.delete(address);
        } catch (error) {
          if (url.pathname === '/api/login') {
            const failures = entry && entry.blockedUntil > now ? entry.attempts + 1 : 1;
            authFailures.set(address,{attempts:failures,blockedUntil:now+AUTH_WINDOW_MS});
          }
          throw error;
        }
        const sid = randomBytes(32).toString('hex');
        db.prepare('INSERT INTO sessions (id, expires, user_id) VALUES (?, ?, ?)').run(sid, Date.now() + 7 * 86400_000,account.id);
        return json(res, 200, { token:sid, account:social.get(account.id) });
      }
      const bearer = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.authorization ?? '')?.[1];
      const sid = bearer ?? sessionId(req);
      const user = sid && selectSession.get(sid, Date.now()) as {user_id:string|null}|undefined;
      if (!user?.user_id) return json(res, 401, { error: 'Войдите в профиль' });
      const uid = user.user_id;
      social.touch(uid);
      if (url.pathname === '/api/me' && req.method === 'GET') return json(res,200,{account:social.get(uid)});
      if (url.pathname === '/api/logout' && req.method === 'POST') {
        db.prepare('DELETE FROM sessions WHERE id=?').run(sid);
        return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/me/rename' && req.method === 'POST')
        return json(res,200,{account:social.rename(uid,(await body(req)).login)});
      if (url.pathname === '/api/me/delete' && req.method === 'POST') {
        const input = await body(req);
        social.authenticate(social.get(uid).login,input.password);
        social.delete(uid);
        return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/decks' && req.method === 'GET') return json(res, 200, { decks: ARCHETYPES });
      if (url.pathname === '/api/catalog' && req.method === 'GET')
        return json(res,200,{cards:[...catalog.values()],presets:ARCHETYPES.map(a=>({ ...a,cards:testDeck(a.id).map(c=>c.id) }))});
      if (url.pathname === '/api/my-decks' && req.method === 'GET')
        return json(res,200,{decks:social.deckList(uid)});
      if (url.pathname === '/api/my-decks' && req.method === 'POST')
        { const input=await body(req); return json(res,201,{deck:social.saveDeck(uid,input.name,input.cards)}); }
      const deckDelete = /^\/api\/my-decks\/([a-f0-9-]{36})$/.exec(url.pathname);
      if (deckDelete && req.method === 'DELETE') {
        social.deleteDeck(uid,deckDelete[1]); return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/lobby' && req.method === 'GET') return json(res,200,social.lobby(uid));
      if (url.pathname === '/api/chat' && req.method === 'POST') {
        return json(res,201,{ok:true,...social.postChat(uid,(await body(req)).text)});
      }
      if (url.pathname === '/api/chat/history' && req.method === 'GET')
        return json(res,200,social.chatHistory(url.searchParams.get('before')??undefined,url.searchParams.get('limit')??50));
      if (url.pathname === '/api/feedback' && req.method === 'POST') {
        const input=await body(req);
        return json(res,201,{report:social.sendFeedback(uid,input.category,input.text,input.title,input.roomCode)});
      }
      if (url.pathname === '/api/feedback/mine' && req.method === 'GET')
        return json(res,200,{reports:social.myFeedback(uid)});
      if (url.pathname === '/api/queue' && req.method === 'DELETE') {
        social.cancel(uid); return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/queue' && req.method === 'POST') {
        const selection = (await body(req)).deckId;
        const cards = social.resolveDeck(uid,selection);
        db.exec('BEGIN IMMEDIATE');
        try {
          let room = social.enqueue(uid,cards);
          if (!room) {
            const candidate = social.opponent(uid);
            if (candidate) {
              do room=randomBytes(4).toString('hex').toUpperCase(); while(selectRoom.get(room));
              const game=newGame(JSON.parse(candidate.deck_json),cards);
              db.prepare('INSERT INTO rooms (code,host,guest,game,host_deck,deadline) VALUES (?,?,?,?,?,?)')
                .run(room,candidate.account_id,uid,JSON.stringify(game),'custom',Date.now()+MULLIGAN_MS);
              social.matched(candidate.account_id,uid,room);
              history.open(room,candidate.account_id,uid,game);
            }
          }
          db.exec('COMMIT');
          return json(res,200,{room,searching:!room});
        } catch(error){db.exec('ROLLBACK');throw error;}
      }
      if (url.pathname === '/api/queue/leave' && req.method === 'POST') {
        social.leaveRoom(uid); return json(res,200,{ok:true});
      }
      if (url.pathname === '/api/rooms' && req.method === 'POST') {
        const choice = (await body(req)).deckId ?? 'red';
        social.resolveDeck(uid,choice);
        let code = '';
        do code = randomBytes(4).toString('hex').toUpperCase(); while (selectRoom.get(code));
        insertRoom.run(code, uid, '{}', choice);
        return json(res, 201, { code, seat: 0 });
      }
      const match = /^\/api\/rooms\/([A-F0-9]{8})(?:\/(join|commands))?$/.exec(url.pathname);
      if (!match) return json(res, 404, { error: 'Не найдено' });
      const code = match[1], action = match[2];
      if (action === 'join' && req.method === 'POST') {
        const choice = (await body(req)).deckId ?? 'red';
        const guestDeck=social.resolveDeck(uid,choice);
        db.exec('BEGIN IMMEDIATE');
        try {
          const row = selectRoom.get(code) as { host: string; guest: string | null; host_deck: ArchetypeId | null } | undefined;
          if (!row || (row.guest && row.guest !== uid) || row.host === uid) throw new RuleError('Комната недоступна');
          if (!row.guest) {
            const game = newGame(social.resolveDeck(row.host,row.host_deck ?? 'red'),guestDeck);
            db.prepare('UPDATE rooms SET guest=?, game=?, deadline=? WHERE code=?').run(uid, JSON.stringify(game), Date.now() + MULLIGAN_MS, code);
            history.open(code,row.host,uid,game);
          }
          db.exec('COMMIT');
          return json(res, 200, { code, seat: 1 });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      const row = selectRoom.get(code) as Room | undefined;
      if (!row || (row.host !== uid && row.guest !== uid)) return json(res, 404, { error: 'Комната недоступна' });
      const seat: PlayerId = row.host === uid ? 0 : 1;
      if (req.method === 'GET' && !action) {
        db.exec('BEGIN IMMEDIATE');
        let current: Room;
        try { current = settleExpired(code, selectRoom.get(code) as Room, Date.now()); db.exec('COMMIT'); }
        catch (error) { db.exec('ROLLBACK'); throw error; }
        archiveSafely();
        return json(res, 200, { code, ready: !!current.guest, game: current.guest ? view(JSON.parse(current.game), seat, current) : null });
      }
      if (req.method === 'POST' && action === 'commands') {
        if (!row.guest) throw new RuleError('Ожидание второго игрока');
        const input = await body(req);
        if (!input || typeof input !== 'object' || !['rulerDraw', 'mulligan', 'playDomain', 'tapDomain', 'playCreature', 'playTechnique', 'playLegend', 'activateLegend', 'playArtifact', 'chooseRitual', 'chooseReward', 'attack', 'intercept', 'endTurn', 'discard'].includes(input.type))
          throw new RuleError('Недопустимая команда');
        db.exec('BEGIN IMMEDIATE');
        try {
          const current = settleExpired(code, selectRoom.get(code) as Room, Date.now());
          const before = JSON.parse(current.game) as Game;
          const next = applyForMatch(before, { ...input, actor: seat } as Command);
          if (input.type === 'endTurn' && next.revision > before.revision && next.phase !== 'paused') {
            next.timeoutStreak ??= [0, 0]; next.timeoutStreak[seat] = 0;
          }
          commitGame(code,current,before,next,Date.now(),'player',{...input,actor:seat} as Command);
          db.exec('COMMIT');
          archiveSafely();
          return json(res, 200, { game: view(next, seat, selectRoom.get(code) as Room) });
        } catch (error) { db.exec('ROLLBACK'); throw error; }
      }
      return json(res, 404, { error: 'Не найдено' });
    } catch (error) {
      return json(res, error instanceof RuleError || error instanceof LegacyRuleError ? 409 : 500, { error: error instanceof Error ? error.message : 'Ошибка сервера' });
    }
  });
  return { server, db, history, close: () => { server.close(); db.close(); } };
}
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = createApp({ databasePath: process.env.FIREWELL_DB ?? './firewell.sqlite', accessPassword: process.env.FIREWELL_ALPHA_PASSWORD ?? '', clientOrigin: process.env.FIREWELL_CLIENT_ORIGIN });
  const port = Number(process.env.PORT ?? 3000);
  app.server.listen(port, process.env.FIREWELL_BIND ?? '127.0.0.1', () => process.stdout.write(`Firewell CCG: http://localhost:${port}\n`));
}

