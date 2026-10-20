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
  basic?: boolean;
  unique?: boolean;
  produces?: Energy;
  cost?: Cost;
  attack?: number;
  health?: number;
  // Abilities need a separately specified resolver, never arbitrary card scripts.
  abilities?: readonly string[];
};
export type Permanent = { objectId: number; card: Card; exhausted: boolean; damage: number; enteredTurn: number };
export type Player = {
  hp: number; deck: Card[]; hand: Card[]; discard: Card[];
  domains: Permanent[]; main: Permanent[]; auxiliary: Permanent[];
  energy: Record<Energy, number>; domainsPlayed: number;
};
export type Game = {
  schemaVersion: 1; rulesVersion: typeof RULES_VERSION; revision: number;
  nextObjectId: number; turn: number; active: PlayerId;
  phase: 'main' | 'discard' | 'finished'; winner: PlayerId | 'draw' | null;
  players: [Player, Player]; processed: Record<string, { revision: number; command: string }>;
};
export type Command =
  | { type: 'startTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'playDomain'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number }
  | { type: 'tapDomain'; actor: PlayerId; expectedRevision: number; key: string; objectId: number }
  | { type: 'playCreature'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number }
  | { type: 'endTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'discard'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number };

export class RuleError extends Error {}
const energies: readonly Energy[] = ['red', 'blue', 'green', 'gold', 'violet', 'neutral'];
const emptyEnergy = (): Record<Energy, number> => ({ red: 0, blue: 0, green: 0, gold: 0, violet: 0, neutral: 0 });
export function player(deck: Card[] = [], hand: Card[] = []): Player {
  return { hp: 30, deck: [...deck], hand: [...hand], discard: [], domains: [], main: [], auxiliary: [], energy: emptyEnergy(), domainsPlayed: 0 };
}
/** Fixtures must state their initial hand/deck explicitly until mulligan is formalized. */
export function initialGame(first: Player, second: Player): Game {
  return { schemaVersion: 1, rulesVersion: RULES_VERSION, revision: 0, nextObjectId: 1,
    turn: 0, active: 0, phase: 'main', winner: null, players: [structuredClone(first), structuredClone(second)], processed: {} };
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
  requireRule(game.phase !== 'finished' && command.actor === game.active, 'Не ваш ход');
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
      p.domains.push({ objectId: next.nextObjectId++, card, exhausted: false, damage: 0, enteredTurn: next.turn });
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
      requireRule(!card.abilities?.length, 'Способности этой карты ещё не реализованы');
      requireRule(p.main.length < 8, 'Основная зона заполнена');
      requireRule(Number.isSafeInteger(card.attack) && card.attack! >= 0 && Number.isSafeInteger(card.health) && card.health! > 0, 'Неверные характеристики');
      const energy = pay(p.energy, card.cost);
      p.energy = energy; p.hand.splice(command.handIndex, 1);
      p.main.push({ objectId: next.nextObjectId++, card, exhausted: true, damage: 0, enteredTurn: next.turn });
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
      p.discard.push(...p.hand.splice(command.handIndex, 1));
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
  if (p.deck.length) p.hand.push(p.deck.shift()!);
}
