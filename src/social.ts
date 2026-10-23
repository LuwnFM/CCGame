import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { RuleError, validateDeck, type Card } from './core.ts';
import { ARCHETYPES, testDeck, EXTRA_DOMAINS } from './decks.ts';

type AccountRow = { id: string; login: string; login_key: string; salt: string; password_hash: string; created_at: number; seen_at: number };
type DeckRow = { id: string; owner_id: string; name: string; cards: string; created_at: number };
export const catalog: Map<string, Card> = new Map([...ARCHETYPES.flatMap(a => testDeck(a.id)),...EXTRA_DOMAINS].map(c => [c.id, c]));
const loginPattern = /^[A-Za-z0-9_]{3,20}$/;
const reserved = new Set(['admin','administrator','moderator','system','support','сервер','админ','модератор']);
function loginKey(login: unknown): { login: string; key: string } {
  if (typeof login !== 'string') throw new RuleError('Логин должен быть строкой');
  const value = login.trim();
  if (!loginPattern.test(value) || [...value].length < 3 || [...value].length > 20)
    throw new RuleError('Логин: 3–20 латинских букв, цифр или символов _');
  const key = value.toLowerCase();
  if (reserved.has(key)) throw new RuleError('Этот логин зарезервирован');
  return { login: value, key };
}
function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 10 || value.length > 128 ||
      !/[A-Za-z]/.test(value) || !/[0-9]/.test(value) || /[\x00-\x1f\x7f]/.test(value))
    throw new RuleError('Пароль профиля: 10–128 символов, минимум одна латинская буква и цифра');
  return value;
}
function publicAccount(row: AccountRow) { return { id: row.id, login: row.login, createdAt: row.created_at }; }
export class Social {
  readonly db: DatabaseSync;
  private leaderboardCache: {expiresAt:number; updatedAt:number; entries: {id:string;login:string;wins:number}[]} | null = null;
  constructor(db: DatabaseSync) {
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, login TEXT NOT NULL, login_key TEXT NOT NULL UNIQUE, salt TEXT NOT NULL,
      password_hash TEXT NOT NULL, created_at INTEGER NOT NULL, seen_at INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS saved_decks (
      id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id), name TEXT NOT NULL,
      cards TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS matchmaking (
      account_id TEXT PRIMARY KEY, deck_json TEXT NOT NULL, queued_at INTEGER NOT NULL,
      matched_room TEXT);
      CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL, category TEXT NOT NULL,
      body TEXT NOT NULL, created_at INTEGER NOT NULL);`);
    // Backward-compatible migration: preserve all existing reports.
    const columns=new Set((db.prepare('PRAGMA table_info(feedback)').all() as {name:string}[]).map(x=>x.name));
    for(const [name,definition] of Object.entries({
      title:"TEXT NOT NULL DEFAULT 'Без названия'",room_code:'TEXT',status:"TEXT NOT NULL DEFAULT 'new'"
    }))if(!columns.has(name))db.exec(`ALTER TABLE feedback ADD COLUMN ${name} ${definition}`);
  }
  private row(id: string): AccountRow {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id=?').get(id) as AccountRow | undefined;
    if (!row) throw new RuleError('Профиль не найден');
    return row;
  }
  register(loginInput: unknown, passwordInput: unknown) {
    const { login, key } = loginKey(loginInput), secret = password(passwordInput);
    const id = randomUUID(), salt = randomBytes(16).toString('hex'), hash = scryptSync(secret, Buffer.from(salt,'hex'),64).toString('hex');
    try {
      this.db.prepare('INSERT INTO accounts (id,login,login_key,salt,password_hash,created_at,seen_at) VALUES (?,?,?,?,?,?,?)')
        .run(id,login,key,salt,hash,Date.now(),Date.now());
    } catch (error) {
      if (String(error).includes('UNIQUE constraint')) throw new RuleError('Логин уже занят');
      throw error;
    }
    return this.row(id);
  }
  authenticate(loginInput: unknown, passwordInput: unknown) {
    const { key } = loginKey(loginInput);
    const row = this.db.prepare('SELECT * FROM accounts WHERE login_key=?').get(key) as AccountRow | undefined;
    if (typeof passwordInput !== 'string' || passwordInput.length > 128 || !row) throw new RuleError('Неверный логин или пароль');
    const hash = scryptSync(passwordInput, Buffer.from(row.salt,'hex'),64);
    if (!timingSafeEqual(hash,Buffer.from(row.password_hash,'hex'))) throw new RuleError('Неверный логин или пароль');
    return row;
  }
  get(id: string) { return publicAccount(this.row(id)); }
  touch(id: string) { this.db.prepare('UPDATE accounts SET seen_at=? WHERE id=?').run(Date.now(),id); }
  rename(id: string, next: unknown) {
    const { login, key } = loginKey(next);
    try { this.db.prepare('UPDATE accounts SET login=?, login_key=? WHERE id=?').run(login,key,id); }
    catch (error) {
      if (String(error).includes('UNIQUE constraint')) throw new RuleError('Логин уже занят');
      throw error;
    }
    return this.get(id);
  }
  delete(id: string) {
    this.db.prepare('DELETE FROM matchmaking WHERE account_id=?').run(id);
    this.db.prepare('DELETE FROM saved_decks WHERE owner_id=?').run(id);
    this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
    // Chat/feedback retain the opaque historical ID, not a deleted login.
    this.db.prepare('DELETE FROM accounts WHERE id=?').run(id);
  }
  deckList(id: string) {
    const saved = this.db.prepare('SELECT id,name,cards FROM saved_decks WHERE owner_id=? ORDER BY created_at DESC').all(id) as DeckRow[];
    return saved.map(row => ({ id: row.id, name: row.name, count: JSON.parse(row.cards).length, cards: JSON.parse(row.cards) }));
  }
  resolveDeck(id: string, selection: unknown): Card[] {
    if (typeof selection !== 'string') throw new RuleError('Выберите колоду');
    const preset = ARCHETYPES.find(a => a.id === selection);
    if (preset) return testDeck(preset.id);
    const saved = this.db.prepare('SELECT * FROM saved_decks WHERE id=? AND owner_id=?').get(selection,id) as DeckRow | undefined;
    if (!saved) throw new RuleError('Колода не найдена');
    return this.mapDeck(JSON.parse(saved.cards));
  }
  private mapDeck(ids: unknown): Card[] {
    if (!Array.isArray(ids) || ids.length !== 70 || ids.some(v => typeof v !== 'string' || !catalog.has(v)))
      throw new RuleError('Колода должна состоять из 70 доступных карт');
    const deck = ids.map(v => catalog.get(v)!);
    const issues = validateDeck(deck);
    if (issues.length) throw new RuleError(issues.join('; '));
    return deck;
  }
  saveDeck(id: string, nameInput: unknown, ids: unknown, existingId?: unknown) {
    if (typeof nameInput !== 'string' || nameInput.trim().length < 2 || nameInput.trim().length > 40)
      throw new RuleError('Название колоды: 2–40 символов');
    this.mapDeck(ids);
    if (existingId !== undefined) {
      if (typeof existingId !== 'string' || !this.db.prepare('SELECT id FROM saved_decks WHERE id=? AND owner_id=?').get(existingId,id)) throw new RuleError('Колода не найдена');
      this.db.prepare('UPDATE saved_decks SET name=?,cards=? WHERE id=? AND owner_id=?').run(nameInput.trim(),JSON.stringify(ids),existingId,id);
      return {id:existingId,name:nameInput.trim()};
    }
    if (this.deckList(id).length >= 10) throw new RuleError('Не более 10 сохранённых колод');
    const entry = { id: randomUUID(), name: nameInput.trim() };
    this.db.prepare('INSERT INTO saved_decks (id,owner_id,name,cards,created_at) VALUES (?,?,?,?,?)')
      .run(entry.id,id,entry.name,JSON.stringify(ids),Date.now());
    return entry;
  }
  deleteDeck(id: string, deckId: string) {
    this.db.prepare('DELETE FROM saved_decks WHERE owner_id=? AND id=?').run(id,deckId);
  }
  leaderboard(now=Date.now()){
    if(this.leaderboardCache && now<this.leaderboardCache.expiresAt)
      return {updatedAt:this.leaderboardCache.updatedAt,expiresAt:this.leaderboardCache.expiresAt,entries:this.leaderboardCache.entries};
    // Count only completed, decisive matches. Current login is read from
    // accounts so changing one's username never discards accumulated wins.
    const entries=this.db.prepare(`SELECT a.id,a.login,COUNT(*) AS wins
      FROM match_history m JOIN accounts a ON a.id =
      CASE m.winner WHEN '0' THEN m.host ELSE m.guest END
      WHERE m.finished_at IS NOT NULL AND m.winner IN ('0','1')
      GROUP BY a.id ORDER BY wins DESC,a.login_key ASC,a.id ASC LIMIT 10`).all() as {id:string;login:string;wins:number}[];
    const result={updatedAt:now,expiresAt:now+600_000,entries};
    this.leaderboardCache=result;
    return result;
  }
  lobby(id: string) {
    const cutoff = Date.now()-60_000;
    this.db.prepare('DELETE FROM matchmaking WHERE matched_room IS NULL AND account_id IN (SELECT id FROM accounts WHERE seen_at<?)').run(cutoff);
    const queue = this.db.prepare('SELECT matched_room FROM matchmaking WHERE account_id=?').get(id) as { matched_room: string | null } | undefined;
    const online = this.db.prepare('SELECT COUNT(*) AS n FROM accounts WHERE seen_at>=?').get(cutoff) as { n:number };
    const searching = this.db.prepare('SELECT COUNT(*) AS n FROM matchmaking WHERE matched_room IS NULL').get() as { n:number };
    const chat = this.db.prepare(`SELECT m.id,m.account_id AS accountId,COALESCE(a.login,'Удалённый игрок') AS login,m.body,m.created_at AS createdAt
      FROM chat_messages m LEFT JOIN accounts a ON a.id=m.account_id ORDER BY m.id DESC LIMIT 50`).all().reverse();
    return { online:online.n, searching:searching.n, searchingSelf:!!queue&&!queue.matched_room,
      room:queue?.matched_room ?? null, chat, leaderboard:this.leaderboard() };
  }
  queueRow(id: string) {
    return this.db.prepare('SELECT * FROM matchmaking WHERE account_id=?').get(id) as
      { account_id:string; deck_json:string; queued_at:number; matched_room:string|null } | undefined;
  }
  enqueue(id: string, deck: Card[]) {
    const old = this.queueRow(id);
    if (old?.matched_room) return old.matched_room;
    if (!old) this.db.prepare('INSERT INTO matchmaking (account_id,deck_json,queued_at,matched_room) VALUES (?,?,?,NULL)')
      .run(id,JSON.stringify(deck),Date.now());
    return null;
  }
  opponent(id: string) {
    const cutoff = Date.now()-60_000;
    return this.db.prepare(`SELECT q.* FROM matchmaking q JOIN accounts a ON a.id=q.account_id
      WHERE q.account_id<>? AND q.matched_room IS NULL AND a.seen_at>=? ORDER BY q.queued_at LIMIT 1`)
      .get(id,cutoff) as ReturnType<Social['queueRow']>;
  }
  matched(first: string, second: string, room: string) {
    this.db.prepare('UPDATE matchmaking SET matched_room=? WHERE account_id IN (?,?)').run(room,first,second);
  }
  cancel(id: string) { this.db.prepare('DELETE FROM matchmaking WHERE account_id=? AND matched_room IS NULL').run(id); }
  leaveRoom(id: string) { this.db.prepare('DELETE FROM matchmaking WHERE account_id=? AND matched_room IS NOT NULL').run(id); }
  postChat(id: string, text: unknown) {
    if (typeof text !== 'string' || !text.trim() || text.trim().length > 500) throw new RuleError('Сообщение: 1–500 символов');
    const latest = this.db.prepare('SELECT created_at FROM chat_messages WHERE account_id=? ORDER BY id DESC LIMIT 1').get(id) as {created_at:number}|undefined;
    const now=Date.now();
    if (latest && now-latest.created_at<5000)
      throw new RuleError('Подождите '+Math.ceil((5000-(now-latest.created_at))/1000)+' сек. перед следующим сообщением');
    this.db.prepare('INSERT INTO chat_messages (account_id,body,created_at) VALUES (?,?,?)').run(id,text.trim(),now);
    return {nextAllowedAt:now+5000};
  }
  chatHistory(before:unknown, count:unknown=50){
    const id=before===undefined?Number.MAX_SAFE_INTEGER:Number(before);
    const limit=Number(count);
    if(!Number.isSafeInteger(id)||id<1||!Number.isSafeInteger(limit)||limit<1||limit>100)
      throw new RuleError('Неверный запрос истории чата');
    const entries=this.db.prepare(`SELECT m.id,m.account_id AS accountId,
      COALESCE(a.login,'Удалённый игрок') AS login,m.body,m.created_at AS createdAt
      FROM chat_messages m LEFT JOIN accounts a ON a.id=m.account_id
      WHERE m.id<? ORDER BY m.id DESC LIMIT ?`).all(id,limit+1) as {id:number}[];
    const hasMore=entries.length>limit;
    const messages=entries.slice(0,limit).reverse();
    return {messages,hasMore,nextBefore:hasMore?messages[0].id:null};
  }
  sendFeedback(id:string,category:unknown,text:unknown,titleInput?:unknown,roomInput?:unknown){
    if(!['bug','idea','problem'].includes(String(category)) || typeof text!=='string'||text.trim().length<10||text.trim().length>2000)
      throw new RuleError('Выберите категорию и напишите 10–2000 символов');
    const title=typeof titleInput==='string'&&titleInput.trim()?titleInput.trim():'Без названия';
    if(title.length<3||title.length>100)throw new RuleError('Заголовок обращения: 3–100 символов');
    const room=roomInput===undefined||roomInput===''?null:roomInput;
    if(room!==null&&(typeof room!=='string'||!/^[A-F0-9]{8}$/.test(room)))
      throw new RuleError('Неверный код комнаты');
    const result=this.db.prepare('INSERT INTO feedback (account_id,category,title,room_code,body,created_at,status) VALUES (?,?,?,?,?,?,?)')
      .run(id,category,title,room,text.trim(),Date.now(),'new');
    return {id:Number(result.lastInsertRowid),status:'new'};
  }
  myFeedback(id:string){
    return this.db.prepare(`SELECT id,category,title,room_code AS roomCode,body,created_at AS createdAt,status
      FROM feedback WHERE account_id=? ORDER BY id DESC LIMIT 100`).all(id);
  }
}
