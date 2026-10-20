/** Firewell CCG rules v0.9.12. No client or network state is trusted. */
export const RULES_VERSION = '0.9.12';
export type PlayerId = 0 | 1;
export type Aspect = 'red' | 'blue' | 'green' | 'gold' | 'violet';
export type Energy = Aspect | 'neutral';
export type Cost = { colored: Partial<Record<Aspect, number>>; generic: number };
export type Card = {
  id: string;
  name: string;
  kind: 'domain' | 'creature';
  aspects?: readonly Aspect[];
  basic?: boolean;
  unique?: boolean;
  produces?: Energy;
  cost?: Cost;
  attack?: number;
  health?: number;
  guard?: boolean;
  flying?: boolean;
  shield?: number;
  majestic?: boolean;
  ritualReward?: boolean;
  createdToken?: boolean;
  // Abilities need a separately specified resolver, never arbitrary card scripts.
  abilities?: readonly string[];
};
export type Permanent = { objectId: number; card: Card; exhausted: boolean; damage: number; shield: number; enteredTurn: number; interceptions: number;
  sacrifice?: boolean; stunned?: boolean; stasis?: number; ritualReward?: boolean };
export type Player = {
  hp: number; deck: Card[]; hand: Card[]; discard: Card[]; erased: Card[];
  domains: Permanent[]; main: Permanent[]; auxiliary: Permanent[];
  energy: Record<Energy, number>; domainsPlayed: number;
};
export type Game = {
  schemaVersion: 1; rulesVersion: typeof RULES_VERSION; revision: number;
  nextObjectId: number; turn: number; active: PlayerId;
  phase: 'main' | 'intercept' | 'discard' | 'finished'; winner: PlayerId | 'draw' | null;
  pendingAttack: null | { attackerId: number; target: { kind: 'player' } | { kind: 'creature'; objectId: number }; defender: PlayerId };
  players: [Player, Player]; processed: Record<string, { revision: number; command: string }>;
};
export type Command =
  | { type: 'startTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'playDomain'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number }
  | { type: 'tapDomain'; actor: PlayerId; expectedRevision: number; key: string; objectId: number }
  | { type: 'playCreature'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number }
  | { type: 'attack'; actor: PlayerId; expectedRevision: number; key: string; attackerId: number; target: { kind: 'player' } | { kind: 'creature'; objectId: number } }
  | { type: 'intercept'; actor: PlayerId; expectedRevision: number; key: string; interceptorId: number | null }
  | { type: 'endTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'discard'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number };

export class RuleError extends Error {}
const energies: readonly Energy[] = ['red', 'blue', 'green', 'gold', 'violet', 'neutral'];
const emptyEnergy = (): Record<Energy, number> => ({ red: 0, blue: 0, green: 0, gold: 0, violet: 0, neutral: 0 });
export function player(deck: Card[] = [], hand: Card[] = []): Player {
  return { hp: 30, deck: [...deck], hand: [...hand], discard: [], erased: [], domains: [], main: [], auxiliary: [], energy: emptyEnergy(), domainsPlayed: 0 };
}
/** A ritual reward or created token can never enter the discard zone. */
export function sendToDiscard(owner: Player, card: Card, ritualReward = false): void {
  if (ritualReward || card.ritualReward || card.createdToken) owner.erased.push(card);
  else owner.discard.push(card);
}
/** Fixtures must state their initial hand/deck explicitly until mulligan is formalized. */
export function initialGame(first: Player, second: Player): Game {
  return { schemaVersion: 1, rulesVersion: RULES_VERSION, revision: 0, nextObjectId: 1,
    turn: 0, active: 0, phase: 'main', winner: null, pendingAttack: null, players: [structuredClone(first), structuredClone(second)], processed: {} };
}
export function validateDeck(deck: readonly Card[]): string[] {
  const issues: string[] = [];
  if (deck.length !== 70) issues.push('Колода должна содержать ровно 70 карт');
  if (deck.filter(c => c.kind === 'domain').length < 26) issues.push('Нужно не менее 26 Владений');
  if (!deck.some(c => c.kind === 'domain' && c.basic && c.produces !== 'neutral')) issues.push('Нужно базовое цветное Владение');
  const counts = new Map<string, number>();
  for (const c of deck) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  for (const c of deck) if (!(c.kind === 'domain' && c.basic) && (counts.get(c.name) ?? 0) > (c.unique ? 1 : 3)) {
    issues.push(`Превышен лимит копий: ${c.name}`); counts.delete(c.name);
  }
  return issues;
}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
function pay(pool: Record<Energy, number>, cost: Cost): Record<Energy, number> {
  const result = { ...pool };
  for (const color of energies.slice(0, 5) as Aspect[]) {
    const amount = cost.colored[color] ?? 0;
    requireRule(Number.isSafeInteger(amount) && amount >= 0, 'Неверная стоимость');
    requireRule(result[color] >= amount, 'Не хватает цветной Энергии');
    result[color] -= amount;
  }
  requireRule(Number.isSafeInteger(cost.generic) && cost.generic >= 0, 'Неверная стоимость');
  requireRule(energies.reduce((sum, color) => sum + result[color], 0) >= cost.generic, 'Не хватает Энергии');
  // Spend neutral first, then fixed colors. UI may later submit an explicit payment plan.
  let remaining = cost.generic;
  for (const color of [...energies].reverse()) {
    const taken = Math.min(result[color], remaining);
    result[color] -= taken; remaining -= taken;
  }
  return result;
}
export function apply(game: Game, command: Command): Game {
  requireRule(typeof command.key === 'string' && command.key.length > 0, 'Нужен ключ идемпотентности');
  const fingerprint = JSON.stringify(command, (key, value) => key === 'expectedRevision' ? undefined : value);
  if (Object.hasOwn(game.processed, command.key)) {
    requireRule(game.processed[command.key].command === fingerprint, 'Ключ команды уже использован для другого действия');
    return game;
  }
  requireRule(game.revision === command.expectedRevision, 'Устаревшая ревизия');
  requireRule(game.phase !== 'finished' && command.actor === (command.type === 'intercept' ? game.pendingAttack?.defender : game.active), 'Не ваш ход');
  const next = structuredClone(game);
  const p = next.players[command.actor];
  switch (command.type) {
    case 'startTurn': {
      requireRule(next.turn === 0, 'Ход уже начат');
      next.turn = 1;
      // The first player does not draw on their first turn.
      break;
    }
    case 'playDomain': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      requireRule(p.domainsPlayed < 1, 'Владение уже разыграно');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'domain' && !!card.produces, 'Неверное Владение');
      p.hand.splice(command.handIndex, 1);
      p.domains.push({ objectId: next.nextObjectId++, card, exhausted: false, damage: 0, shield: 0, interceptions: 0, enteredTurn: next.turn });
      p.domainsPlayed++;
      break;
    }
    case 'tapDomain': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const domain = p.domains.find(d => d.objectId === command.objectId);
      requireRule(domain && !domain.exhausted && domain.card.produces, 'Владение недоступно');
      domain.exhausted = true;
      p.energy[domain.card.produces]++;
      break;
    }
    case 'playCreature': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'creature' && card.cost, 'Неверное Существо');
      // Unknown abilities are displayed as inactive in the UI; they never run silently.
      requireRule(p.main.length < 8, 'Основная зона заполнена');
      requireRule(Number.isSafeInteger(card.attack) && card.attack! >= 0 && Number.isSafeInteger(card.health) && card.health! > 0, 'Неверные характеристики');
      const energy = pay(p.energy, card.cost);
      p.energy = energy; p.hand.splice(command.handIndex, 1);
      p.main.push({ objectId: next.nextObjectId++, card, exhausted: true, damage: 0, shield: card.shield ?? 0, interceptions: 0, enteredTurn: next.turn });
      break;
    }
    case 'attack': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const attacker = p.main.find(c => c.objectId === command.attackerId);
      requireRule(attacker && !attacker.exhausted && attacker.enteredTurn < next.turn, 'Атакующий не готов');
      const defender = (1 - command.actor) as PlayerId;
      requireRule(command.target?.kind === 'player' || command.target?.kind === 'creature', 'Неверная цель');
      if (command.target.kind === 'creature') {
        requireRule(next.players[defender].main.some(c => c.objectId === command.target.objectId), 'Цель недоступна');
      }
      attacker.exhausted = true; // Declaring costs the attack even if target later vanishes.
      next.pendingAttack = { attackerId: attacker.objectId, target: command.target, defender };
      next.phase = 'intercept';
      break;
    }
    case 'intercept': {
      requireRule(next.phase === 'intercept' && next.pendingAttack, 'Нет атаки');
      const pending = next.pendingAttack;
      let target = pending.target.kind === 'creature' ? p.main.find(c => c.objectId === pending.target.objectId) : null;
      const attacker = next.players[next.active].main.find(c => c.objectId === pending.attackerId);
      const interceptor = command.interceptorId === null ? null : p.main.find(c => c.objectId === command.interceptorId);
      if (command.interceptorId !== null) {
        requireRule(interceptor && !interceptor.exhausted && interceptor.interceptions === 0, 'Перехватчик недоступен');
        requireRule(pending.target.kind === 'player' || interceptor.card.guard, 'Только Страж перехватывает атаку по Существу');
        requireRule(!attacker?.card.flying || interceptor.card.flying, 'Наземное Существо не перехватывает Полёт');
        interceptor.interceptions++;
      }
      const combatTarget = interceptor ?? target;
      if (attacker && (combatTarget || pending.target.kind === 'player')) {
        const attack = Math.max(0, attacker.card.attack ?? 0);
        const response = combatTarget ? Math.max(0, combatTarget.card.attack ?? 0) : 0;
        if (combatTarget) damage(combatTarget, attack);
        else p.hp -= attack;
        if (combatTarget) damage(attacker, response);
        for (const side of next.players) {
          for (const zone of [side.main, side.auxiliary]) {
            for (let i = zone.length - 1; i >= 0; i--) {
              const unit = zone[i];
              if (unit.card.health !== undefined && unit.damage >= unit.card.health) {
                zone.splice(i, 1);
                // Death events and card abilities are not implemented in this narrow combat slice.
                sendToDiscard(side, unit.card, unit.ritualReward);
              }
            }
          }
        }
      }
      if (next.players[0].hp <= 0 || next.players[1].hp <= 0) {
        next.winner = next.players[0].hp <= 0 && next.players[1].hp <= 0 ? 'draw' : next.players[0].hp <= 0 ? 1 : 0;
        next.phase = 'finished';
      } else next.phase = 'main';
      next.pendingAttack = null;
      break;
    }
    case 'endTurn': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      p.energy = emptyEnergy();
      if (p.hand.length > 8) { next.phase = 'discard'; break; }
      advance(next);
      break;
    }
    case 'discard': {
      requireRule(next.phase === 'discard', 'Сейчас нет сброса');
      requireRule(Number.isInteger(command.handIndex) && command.handIndex >= 0 && command.handIndex < p.hand.length, 'Неверная карта');
      sendToDiscard(p, p.hand.splice(command.handIndex, 1)[0]);
      if (p.hand.length <= 8) advance(next);
      break;
    }
  }
  next.revision++;
  next.processed[command.key] = { revision: next.revision, command: fingerprint };
  return next;
}
function advance(game: Game): void {
  game.active = (1 - game.active) as PlayerId;
  game.turn++;
  game.phase = 'main';
  const p = game.players[game.active];
  p.domainsPlayed = 0;
  for (const domain of p.domains) domain.exhausted = false;
  for (const creature of p.main) creature.exhausted = false;
  // A defender's per-opponent-turn intercept limit resets when that opponent starts.
  for (const creature of game.players[1 - game.active].main) creature.interceptions = 0;
  if (p.deck.length) p.hand.push(p.deck.shift()!);
}
function damage(target: Permanent, amount: number): void {
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  target.damage += amount - absorbed;
}
