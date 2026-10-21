/** Firewell CCG rules. No client or network state is trusted. */
import { mulligan } from './setup.ts';
import { eligibleVictims, nextRandom, planRitual, type RitualEffect } from './ritual.ts';
import { ability } from './mechanics/abilities.ts';
import { damage, resolveCombat } from './mechanics/combat.ts';
export const RULES_VERSION = '0.9.14-alpha';
export type PlayerId = 0 | 1;
export type Aspect = 'red' | 'blue' | 'green' | 'gold' | 'violet';
export type Energy = Aspect | 'neutral';
export type Cost = { colored: Partial<Record<Aspect, number>>; generic: number };
export type RitualSpec = { color: Aspect | 'neutral'; threshold: number; duration: number; rewardPool: [Card, Card, Card, Card, Card] };
export type DeathEffect = { kind: 'damageController' | 'damageOpponent' | 'damageAllCreatures'; amount: number };
export type EntryEffect = { kind: 'summonSkeleton' | 'healRuler' | 'draw'; amount: number };
export type TechniqueEffect = { kind: 'reanimate' | 'damageOpponent' | 'healRuler' | 'draw' | 'cleanse' | 'ward' | 'silence' | 'bind'; amount: number };
export type Card = {
  id: string;
  name: string;
  nameEn?: string;
  kind: 'domain' | 'creature' | 'technique' | 'legend' | 'artifact';
  aspects?: readonly Aspect[];
  basic?: boolean;
  unique?: boolean;
  produces?: Energy;
  cost?: Cost;
  attack?: number;
  health?: number;
  guard?: boolean;
  flying?: boolean;
  firstStrike?: boolean;
  piercing?: boolean;
  lifesteal?: boolean;
  haste?: boolean;
  zeal?: boolean;
  extraAttacks?: number;
  stealth?: boolean;
  poisonHit?: { strength: number; ticks: number };
  shield?: number;
  majestic?: boolean;
  ritualReward?: boolean;
  createdToken?: boolean;
  sacrifice?: boolean;
  ritual?: RitualSpec;
  onDeath?: DeathEffect;
  onEntry?: EntryEffect;
  secondChance?: EntryEffect;
  techniqueEffect?: TechniqueEffect;
  loyalty?: number;
  loyaltyAbility?: { delta: number; kind: 'healRuler' | 'damageOpponent' | 'draw' | 'recoverCreature' | 'raiseSacrifice'; amount: number };
  loyaltyAbilities?: readonly { delta: number; kind: 'healRuler' | 'damageOpponent' | 'draw' | 'recoverCreature' | 'raiseSacrifice'; amount: number }[];
  auraAttack?: number;
  lore?: { state: string; organization: string; note?: string };
  // Abilities need a separately specified resolver, never arbitrary card scripts.
  abilities?: readonly string[];
};
export type Permanent = { objectId: number; card: Card; exhausted: boolean; damage: number; shield: number; enteredTurn: number; interceptions: number;
  sacrifice?: boolean; stunned?: boolean; stasis?: number; ritualReward?: boolean; loyalty?: number; lastActivatedTurn?: number;
  attacksMade?: number; silenced?: boolean; poison?: { strength: number; ticks: number } };
export type Player = {
  hp: number; deck: Card[]; hand: Card[]; discard: Card[]; erased: Card[];
  domains: Permanent[]; main: Permanent[]; auxiliary: Permanent[]; legends: Permanent[];
  energy: Record<Energy, number>; domainsPlayed: number;
  rituals: (RitualEffect & { remainingStarts: number })[];
  lastRulerDrawTurn?: number;
};
export type ReadyRitual = { effect: RitualEffect; eligibleIds: number[] };
export type PendingReward = { owner: PlayerId; offeredIds: string[]; pool: [Card, Card, Card, Card, Card] };
export type Game = {
  schemaVersion: 1; rulesVersion: typeof RULES_VERSION; revision: number;
  nextObjectId: number; turn: number; active: PlayerId;
  phase: 'mulligan' | 'main' | 'intercept' | 'discard' | 'ritual' | 'reward' | 'paused' | 'finished'; winner: PlayerId | 'draw' | null;
  mulliganReady?: [boolean, boolean]; mulliganSeeds?: [number, number]; seed?: number;
  readyRituals?: ReadyRitual[]; pendingReward?: PendingReward | null; pauseReason?: string;
  operationsUsed?: number;
  timeoutStreak?: [number, number];
  pendingAttack: null | { attackerId: number; target: { kind: 'player' } | { kind: 'creature' | 'legend'; objectId: number }; defender: PlayerId };
  players: [Player, Player]; processed: Record<string, { revision: number; command: string }>;
};
export type Command =
  | { type: 'mulligan'; actor: PlayerId; expectedRevision: number; key: string; indices: number[] }
  | { type: 'startTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'playDomain'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number }
  | { type: 'tapDomain'; actor: PlayerId; expectedRevision: number; key: string; objectId: number }
  | { type: 'playCreature'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number; replaceId?: number; keepExisting?: boolean }
  | { type: 'playTechnique'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number; targetId?: number; discardIndex?: number }
  | { type: 'rulerDraw'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'playLegend'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number; keepExisting?: boolean }
  | { type: 'activateLegend'; actor: PlayerId; expectedRevision: number; key: string; objectId: number; discardIndex?: number; abilityIndex?: number }
  | { type: 'playArtifact'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number; replaceId?: number; keepExisting?: boolean }
  | { type: 'chooseRitual'; actor: PlayerId; expectedRevision: number; key: string; effectId: string; objectIds: number[] }
  | { type: 'chooseReward'; actor: PlayerId; expectedRevision: number; key: string; rewardId: string; replaceId?: number; keepExisting?: boolean }
  | { type: 'attack'; actor: PlayerId; expectedRevision: number; key: string; attackerId: number; target: { kind: 'player' } | { kind: 'creature' | 'legend'; objectId: number } }
  | { type: 'intercept'; actor: PlayerId; expectedRevision: number; key: string; interceptorId: number | null }
  | { type: 'endTurn'; actor: PlayerId; expectedRevision: number; key: string }
  | { type: 'discard'; actor: PlayerId; expectedRevision: number; key: string; handIndex: number };

export class RuleError extends Error {}
const energies: readonly Energy[] = ['red', 'blue', 'green', 'gold', 'violet', 'neutral'];
const emptyEnergy = (): Record<Energy, number> => ({ red: 0, blue: 0, green: 0, gold: 0, violet: 0, neutral: 0 });
export function player(deck: Card[] = [], hand: Card[] = []): Player {
  return { hp: 30, deck: [...deck], hand: [...hand], discard: [], erased: [], domains: [], main: [], auxiliary: [], legends: [], energy: emptyEnergy(), domainsPlayed: 0, rituals: [] };
}
/** A ritual reward or created token can never enter the discard zone. */
export function sendToDiscard(owner: Player, card: Card, ritualReward = false): void {
  if (ritualReward || card.ritualReward || card.createdToken) owner.erased.push(card);
  else owner.discard.push(card);
}
/** Fixtures must state their initial hand/deck explicitly until mulligan is formalized. */
export function initialGame(first: Player, second: Player): Game {
  return { schemaVersion: 1, rulesVersion: RULES_VERSION, revision: 0, nextObjectId: 1,
    turn: 0, active: 0, phase: 'main', winner: null, pendingAttack: null, players: [structuredClone(first), structuredClone(second)], processed: {}, timeoutStreak: [0, 0] };
}
/** Each seat sees only its own seven cards until both have answered. */
export function openingGame(first: { hand: Card[]; deck: Card[]; seedAfter: number }, second: { hand: Card[]; deck: Card[]; seedAfter: number }): Game {
  const game = initialGame(player(first.deck, first.hand), player(second.deck, second.hand));
  game.phase = 'mulligan';
  game.mulliganReady = [false, false];
  game.mulliganSeeds = [first.seedAfter, second.seedAfter];
  game.seed = second.seedAfter;
  return game;
}
export function validateDeck(deck: readonly Card[]): string[] {
  const issues: string[] = [];
  if (deck.length !== 70) issues.push('Колода должна содержать ровно 70 карт');
  if (deck.filter(c => c.kind === 'domain').length < 26) issues.push('Нужно не менее 26 Владений');
  if (!deck.some(c => c.kind === 'domain' && c.basic && c.produces !== 'neutral')) issues.push('Нужно базовое цветное Владение');
  if (new Set(deck.filter(c => c.kind === 'legend').map(c => c.name)).size > 3) issues.push('Не более трёх разных Легенд');
  const counts = new Map<string, number>();
  for (const c of deck) counts.set(c.name, (counts.get(c.name) ?? 0) + 1);
  for (const c of deck) if (!(c.kind === 'domain' && c.basic) && (counts.get(c.name) ?? 0) > (c.unique || c.kind === 'legend' ? 1 : 3)) {
    issues.push(`Превышен лимит копий: ${c.name}`); counts.delete(c.name);
  }
  return issues;
}
function requireRule(ok: unknown, message: string): asserts ok {
  if (!ok) throw new RuleError(message);
}
/** Automatically exhaust the minimum necessary ready Domains when the energy pool is short.
 * Colored requirements are reserved first; generic energy prefers neutral, then other colors.
 * Changes occur only on apply()'s cloned game, so invalid actions never exhaust Domains.
 */
/** Deterministic created tokens always occupy auxiliary slots; never overflow. */
function spawnSkeleton(game: Game, actor: PlayerId, count: number, source: Card): void {
  requireRule(Number.isSafeInteger(count) && count >= 0 && count <= 4, 'Неверное число призываемых');
  const owner=game.players[actor];
  for(let i=0;i<count && owner.auxiliary.length<4;i++){
    const card:Card={id:'violet-skeleton-token',name:'Призванный скелет',kind:'creature',
      aspects:['violet'],attack:1,health:1,createdToken:true,sacrifice:true,
      lore:{state:'Искажение',organization:'Некроманты',note:'Токен 1/1; исчезает вместо попадания в Сброс.'}};
    owner.auxiliary.push({objectId:game.nextObjectId++,card,damage:0,shield:0,exhausted:true,
      interceptions:0,enteredTurn:game.turn,sacrifice:true,attacksMade:0});
  }
}
/** Only entered-from-hand and revived-from-discard cards receive the corresponding trigger. */
function enterTrigger(game:Game,actor:PlayerId,card:Card,origin:'hand'|'discard'):void{
  const effect=origin==='hand'?card.onEntry:card.secondChance;
  if(!effect)return;
  if((game.operationsUsed=(game.operationsUsed??0)+1)>MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет Вступления/Второго шанса');
  requireRule(Number.isSafeInteger(effect.amount) && effect.amount>=0&&effect.amount<=4,'Неверное Вступление');
  if(effect.kind==='summonSkeleton')spawnSkeleton(game,actor,effect.amount,card);
  else if(effect.kind==='healRuler')game.players[actor].hp=Math.min(30,game.players[actor].hp+effect.amount);
  else if(effect.kind==='draw')for(let i=0;i<effect.amount&&game.players[actor].deck.length;i++)
      game.players[actor].hand.push(game.players[actor].deck.shift()!);
  else throw new RuleError('Неизвестный эффект при входе');
}
function getCreature(player:Player,id:number|undefined):Permanent|undefined{
 return [...player.main,...player.auxiliary].find(unit=>unit.objectId===id&&unit.card.kind==='creature');
}
function resolveTechnique(game:Game,actor:PlayerId,card:Card,command:{targetId?:number;discardIndex?:number}):void{
  const effect=card.techniqueEffect!;
  const owner=game.players[actor];
  const enemy=game.players[(1-actor) as PlayerId];
  requireRule(Number.isSafeInteger(effect.amount)&&effect.amount>=0&&effect.amount<=8,'Неверная Техника');
  if(effect.kind==='damageOpponent')enemy.hp-=effect.amount;
  else if(effect.kind==='healRuler')owner.hp=Math.min(30,owner.hp+effect.amount);
  else if(effect.kind==='draw')for(let i=0;i<effect.amount&&owner.deck.length;i++)owner.hand.push(owner.deck.shift()!);
  else if(effect.kind==='reanimate'){
    requireRule(Number.isSafeInteger(command.discardIndex) && !!owner.discard[command.discardIndex!] &&
      owner.discard[command.discardIndex!].kind==='creature','Выберите Существо из сброса');
    requireRule(owner.main.length<8,'Нет места для воскрешённого Существа');
    const revived=owner.discard[command.discardIndex!]!;
    owner.discard.splice(command.discardIndex!,1);
    owner.main.push({objectId:game.nextObjectId++,card:revived,damage:0,shield:revived.shield??0,
      exhausted:true,interceptions:0,enteredTurn:game.turn,sacrifice:revived.sacrifice,attacksMade:0});
    enterTrigger(game,actor,revived,'discard');
  }else {
    const side=effect.kind==='silence'||effect.kind==='bind'?enemy:owner;
    const target=effect.kind==='bind'?getCreature(side,command.targetId):[...side.main,...side.auxiliary,...side.legends].find(p=>p.objectId===command.targetId);
    requireRule(target,'Выберите допустимое Существо');
    if(effect.kind==='cleanse'){target.poison=undefined;target.stunned=false;target.stasis=undefined;target.silenced=false}
    else if(effect.kind==='ward')throw new RuleError('Оберег ещё не реализован; это не Щит');
    else if(effect.kind==='silence')target.silenced=true;
    else if(effect.kind==='bind'){
      if(target.stunned||target.stasis){target.stunned=false;target.stasis=effect.amount}
      else target.stunned=true;
    }else throw new RuleError('Неизвестный эффект Техники');
  }
}
function payForCard(owner: Player, cost: Cost): Record<Energy, number> {
  const available = { ...owner.energy };
  const ready = owner.domains.filter(d => !d.exhausted && d.card.produces);
  const tap = (energy: Energy) => {
    const domain = ready.find(d => d.card.produces === energy && !d.exhausted);
    if (!domain) return false;
    domain.exhausted = true;
    available[energy]++;
    return true;
  };
  for (const color of energies.slice(0, 5) as Aspect[]) {
    const required = cost.colored[color] ?? 0;
    while (available[color] < required && tap(color)) {}
    requireRule(available[color] >= required, 'Не хватает цветной Энергии');
    available[color] -= required;
  }
  let total = energies.reduce((n,color)=>n+available[color],0);
  for (const color of ['neutral', 'red', 'blue', 'green', 'gold', 'violet'] as Energy[]) {
    while (total < cost.generic && tap(color)) total++;
  }
  requireRule(total >= cost.generic, 'Не хватает Энергии');
  return pay(available, { colored: {}, generic: cost.generic });
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
  requireRule(game.phase !== 'finished' && game.phase !== 'paused' && command.actor === (command.type === 'mulligan' ? command.actor : command.type === 'intercept' ? game.pendingAttack?.defender : game.active), 'Не ваш ход');
  const next = structuredClone(game);
  const p = next.players[command.actor];
  try {
  if ((next.operationsUsed = (next.operationsUsed ?? 0) + 1) > MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет операций за ход; матч приостановлен');
  switch (command.type) {
    case 'mulligan': {
      requireRule(next.phase === 'mulligan' && next.mulliganReady && !next.mulliganReady[command.actor], 'Муллиган недоступен');
      // Validation and the replacement happen on a private copy of the game.
      requireRule(Array.isArray(command.indices), 'Неверный выбор муллигана');
      const changed = mulligan({ hand: p.hand, deck: p.deck, seedAfter: next.mulliganSeeds![command.actor] }, command.indices);
      p.hand = changed.hand; p.deck = changed.deck; next.mulliganSeeds![command.actor] = changed.seedAfter;
      next.mulliganReady[command.actor] = true;
      if (next.mulliganReady.every(Boolean)) { next.phase = 'main'; next.turn = 1; }
      break;
    }
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
      requireRule(Number.isSafeInteger(card.attack) && card.attack! >= 0 && Number.isSafeInteger(card.health) && card.health! > 0, 'Неверные характеристики');
      const duplicate = card.unique ? [...p.main,...p.auxiliary].find(u=>u.card.name===card.name) : undefined;
      if(duplicate){
        requireRule(typeof command.keepExisting==='boolean','Выберите, какую Уникальную оставить');
        if(command.keepExisting){p.energy=payForCard(p,card.cost);p.hand.splice(command.handIndex,1);sendToDiscard(p,card,!!card.ritualReward);break}
        const removed=removePermanents(p,[duplicate.objectId]);
        for(const unit of removed)sendToDiscard(p,unit.card,unit.ritualReward);
      }
      const zone = card.createdToken ? p.auxiliary : p.main;
      const limit = card.createdToken ? 4 : 8;
      if (zone.length >= limit) {
        if (!card.createdToken) throw new RuleError('Основная зона заполнена');
        const replaced = zone.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        requireRule(replaced, 'Выберите допустимый объект для Вытеснения токеном');
        // Displacement is a departure, not a death. Never trigger onDeath.
        zone.splice(zone.indexOf(replaced), 1);
        sendToDiscard(p, replaced.card, replaced.ritualReward);
      }
      const energy = payForCard(p, card.cost);
      p.energy = energy; p.hand.splice(command.handIndex, 1);
      zone.push({ objectId: next.nextObjectId++, card, exhausted: !card.haste && !card.zeal, damage: 0, shield: card.shield ?? 0,
        interceptions: 0, enteredTurn: next.turn, sacrifice: card.sacrifice, ritualReward: !!card.ritualReward, attacksMade: 0 });
      enterTrigger(next,command.actor,card,'hand');
      break;
    }
    case 'playTechnique': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'technique' && card.cost && (card.ritual||card.techniqueEffect), 'Неверная Техника');
      // Validate targets before committing costs; apply() works on a transactionally cloned game.
      if(card.ritual)requireRule(Number.isSafeInteger(card.ritual.duration) && card.ritual.duration > 0, 'Неверный срок Ритуала');
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if(card.ritual)p.rituals.push({ id: `ritual-${next.nextObjectId++}`, color: card.ritual.color, threshold: card.ritual.threshold,
        rewardPool: card.ritual.rewardPool, requiresSource: false, remainingStarts: card.ritual.duration });
      else resolveTechnique(next,command.actor,card,command);
      sendToDiscard(p, card);
      resolveDeaths(next,collectLethal(next));
      finishIfLethal(next);
      break;
    }
    case 'rulerDraw': {
      requireRule(next.turn>0 && next.phase==='main','Недоступная фаза');
      requireRule(p.lastRulerDrawTurn!==next.turn,'Способность Владетеля уже применена');
      requireRule(p.hp>2,'Недостаточно здоровья Владетеля');
      requireRule(p.hand.length<=3,'Для добора должно быть не больше 3 карт в руке');
      requireRule(p.deck.length>=2,'В колоде должно быть не менее двух карт');
      p.hp-=2;p.lastRulerDrawTurn=next.turn;
      p.hand.push(p.deck.shift()!,p.deck.shift()!);
      break;
    }
    case 'playLegend': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'legend' && card.cost && Number.isSafeInteger(card.loyalty) && card.loyalty! > 0, 'Неверная Легенда');
      const sameLegend = p.legends.find(legend => legend.card.name === card.name);
      requireRule(!sameLegend || typeof command.keepExisting === 'boolean', 'Выберите, какую одноимённую Легенду оставить');
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if (sameLegend) {
        if (command.keepExisting) { sendToDiscard(p, card); break; }
        p.legends.splice(p.legends.indexOf(sameLegend), 1);
        sendToDiscard(p, sameLegend.card, sameLegend.ritualReward);
      }
      p.legends.push({ objectId: next.nextObjectId++, card, loyalty: card.loyalty,
        exhausted: false, damage: 0, shield: card.shield ?? 0, interceptions: 0, enteredTurn: next.turn });
      break;
    }
    case 'activateLegend': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const legend = p.legends.find(unit => unit.objectId === command.objectId);
      const choices = legend?.card.loyaltyAbilities?.length ? legend.card.loyaltyAbilities : legend?.card.loyaltyAbility ? [legend.card.loyaltyAbility] : [];
      const chosen = command.abilityIndex ?? (legend?.card.loyaltyAbilities?.length ? 1 : 0);
      const ability = Number.isSafeInteger(chosen) && chosen >= 0 ? choices[chosen] : undefined;
      requireRule(legend && ability && legend.lastActivatedTurn !== next.turn && !legend.stunned && !legend.stasis && !legend.silenced, 'Способность Легенды недоступна');
      requireRule(Number.isSafeInteger(ability.delta) && Number.isSafeInteger(ability.amount) && ability.amount >= 0, 'Неверная способность');
      requireRule(legend.loyalty! + ability.delta >= 0, 'Не хватает Лояльности');
      if (ability.kind === 'recoverCreature')
        requireRule(Number.isSafeInteger(command.discardIndex) && p.discard[command.discardIndex!]?.kind === 'creature',
          'Выберите Существо из сброса для возвращения в руку');
      if (ability.kind === 'raiseSacrifice')
        requireRule(p.auxiliary.length < 4, 'Нет свободного места для умертвия Жертвы');
      legend.loyalty! += ability.delta;
      legend.lastActivatedTurn = next.turn;
      if (ability.kind === 'healRuler') p.hp = Math.min(30, p.hp + ability.amount);
      else if (ability.kind === 'damageOpponent') next.players[(1 - command.actor) as PlayerId].hp -= ability.amount;
      else if (ability.kind === 'draw') for (let i = 0; i < ability.amount && p.deck.length; i++) p.hand.push(p.deck.shift()!);
      else if (ability.kind === 'recoverCreature') p.hand.push(p.discard.splice(command.discardIndex!, 1)[0]);
      else if (ability.kind === 'raiseSacrifice') {
        const token: Card = { id: 'vt-cera-ritual-servant', name: 'Умертвие свиты Церы',
          nameEn: 'Cera’s Undead Retainer', kind: 'creature', aspects: ['violet'],
          attack: 2, health: 2, createdToken: true, sacrifice: true,
          lore: {state:'Искажение',organization:'Дом Ван Троуп',
            note:'Игровой ритуальный слуга из некромантской свиты Церы Ван Троуп.'} };
        p.auxiliary.push({objectId:next.nextObjectId++, card:token, exhausted:true,
          damage:0, shield:0, interceptions:0, enteredTurn:next.turn, sacrifice:true, attacksMade:0});
        // Cera may complete ONE existing ritual immediately. The 3-of-5 reward
        // selection, sacrifices and death triggers remain entirely unchanged.
        const ready = p.rituals.find(effect => eligibleVictims(p,effect.color).length >= effect.threshold);
        if (ready) {
          next.readyRituals=[{effect:structuredClone(ready),
            eligibleIds:eligibleVictims(p,ready.color).map(unit=>unit.objectId)}];
          next.phase='ritual';
        }
      } else throw new RuleError('Неизвестная способность Легенды');
      if (legend.loyalty === 0) { p.legends.splice(p.legends.indexOf(legend), 1); sendToDiscard(p, legend.card); }
      finishIfLethal(next);
      break;
    }
    case 'playArtifact': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'artifact' && card.cost, 'Неверный предмет');
      const sameItem = p.auxiliary.find(unit => unit.card.name === card.name);
      requireRule(!sameItem || typeof command.keepExisting === 'boolean', 'Выберите, какой одноимённый предмет оставить');
      if (!sameItem && p.auxiliary.length >= 4) {
        const replaced = p.auxiliary.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        requireRule(replaced, 'Выберите допустимый предмет или токен для Вытеснения');
        p.auxiliary.splice(p.auxiliary.indexOf(replaced), 1);
        sendToDiscard(p, replaced.card, replaced.ritualReward);
      }
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if (sameItem) {
        if (command.keepExisting) { sendToDiscard(p, card); break; }
        p.auxiliary.splice(p.auxiliary.indexOf(sameItem), 1);
        sendToDiscard(p, sameItem.card, sameItem.ritualReward);
      }
      p.auxiliary.push({ objectId: next.nextObjectId++, card, exhausted: false, damage: 0,
        shield: 0, interceptions: 0, enteredTurn: next.turn });
      break;
    }
    case 'chooseRitual': {
      requireRule(next.phase === 'ritual' && next.readyRituals, 'Сейчас нет выбора Ритуала');
      const ready = next.readyRituals.find(r => r.effect.id === command.effectId);
      requireRule(ready, 'Ритуал не готов');
      requireRule(Array.isArray(command.objectIds) && command.objectIds.every(id => ready.eligibleIds.includes(id)), 'Недопустимые Жертвы');
      const plan = planRitual(p, ready.effect, command.objectIds, next.seed ?? 1);
      next.seed = plan.seedAfter;
      const dead = removePermanents(p, plan.chosenObjectIds);
      resolveDeaths(next, dead.map(unit => ({ unit, owner: command.actor })));
      // Cera's one-card bonus is outside and AFTER the sacrifice death sequence.
      // It does not change the five possible reward cards or three offers.
      if (p.legends.some(unit => unit.card.id === 'violet-цера-ван-троуп' && !unit.stasis && !unit.stunned && !unit.silenced) && p.deck.length)
        p.hand.push(p.deck.shift()!);
      next.readyRituals = [];
      if (finishIfLethal(next)) break;
      next.pendingReward = { owner: command.actor, offeredIds: plan.offeredRewardIds, pool: [...ready.effect.rewardPool] as PendingReward['pool'] };
      next.phase = 'reward';
      break;
    }
    case 'chooseReward': {
      requireRule(next.phase === 'reward' && next.pendingReward?.owner === command.actor, 'Сейчас нет выбора награды');
      const pending = next.pendingReward;
      requireRule(pending.offeredIds.includes(command.rewardId), 'Награда не предложена');
      let reward = structuredClone(pending.pool.find(card => card.id === command.rewardId)!);
      requireRule(reward.kind === 'creature', 'Наградой должно быть Существо');
      reward.ritualReward = true;
      const zone = reward.createdToken ? p.auxiliary : p.main;
      const limit = reward.createdToken ? 4 : 8;
      // Unique-name collisions follow the ordinary explicit-survivor rule.
      // This is not a failed placement and must not cause a five-card reroll.
      const sameUnique = reward.unique ? [...p.main, ...p.auxiliary].find(unit => unit.card.name === reward.name) : undefined;
      if (sameUnique) {
        requireRule(typeof command.keepExisting === 'boolean', 'Выберите, какую Уникальную оставить');
        if (command.keepExisting) {
          sendToDiscard(p, reward, true);
          next.pendingReward = null; next.phase = 'main';
          break;
        }
        const removed = removePermanents(p, [sameUnique.objectId]);
        for (const unit of removed) sendToDiscard(p, unit.card, unit.ritualReward);
      }
      if (zone.length >= limit) {
        const replacement = zone.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        if (replacement) {
          const removed = removePermanents(p, [replacement.objectId]);
          if (reward.createdToken) {
            // Ordinary auxiliary displacement is departure, not death.
            for (const unit of removed) sendToDiscard(p, unit.card, unit.ritualReward);
          } else resolveDeaths(next, removed.map(unit => ({ unit, owner: command.actor })));
        } else if (zone.some(unit => !unit.card.majestic)) throw new RuleError('Выберите заменяемое Существо');
      }
      if (finishIfLethal(next)) { next.pendingReward = null; break; }
      if (zone.length >= limit) {
        const roll = nextRandom(next.seed ?? 1, pending.pool.length); next.seed = roll.seed;
        reward = { ...structuredClone(pending.pool[roll.value]), ritualReward: true };
        // An unplaceable reward goes to hand as a playable card, including temporary token cards.
        // Use printed cost where present; otherwise give generated rewards a zero-cost fallback.
        reward.cost ??= { colored: {}, generic: 0 };
        p.hand.push(reward);
      } else {
        zone.push({ objectId: next.nextObjectId++, card: reward, exhausted: true, damage: 0,
          shield: reward.shield ?? 0, interceptions: 0, enteredTurn: next.turn, ritualReward: true,
          sacrifice: reward.sacrifice });
      }
      next.pendingReward = null; next.phase = 'main';
      break;
    }
    case 'attack': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const attacker = [...p.main, ...p.auxiliary].find(c => c.objectId === command.attackerId && c.card.kind === 'creature');
      requireRule(attacker && !attacker.exhausted && !attacker.stunned && !attacker.stasis &&
        (attacker.enteredTurn < next.turn || ability(attacker,'haste') || ability(attacker,'zeal') && command.target?.kind === 'creature'), 'Атакующий не готов');
      const defender = (1 - command.actor) as PlayerId;
      requireRule(command.target?.kind === 'player' || command.target?.kind === 'creature' || command.target?.kind === 'legend', 'Неверная цель');
      if (command.target.kind === 'creature') {
        requireRule([...next.players[defender].main, ...next.players[defender].auxiliary].some(c => c.objectId === command.target.objectId && c.card.kind === 'creature' && !ability(c,'stealth')), 'Цель недоступна');
      } else if (command.target.kind === 'legend') {
        requireRule(next.players[defender].legends.some(c => c.objectId === command.target.objectId), 'Легенда недоступна');
      }
      attacker.exhausted = true; attacker.attacksMade = (attacker.attacksMade ?? 0) + 1;
      next.pendingAttack = { attackerId: attacker.objectId, target: command.target, defender };
      next.phase = 'intercept';
      break;
    }
    case 'intercept': {
      requireRule(next.phase === 'intercept' && next.pendingAttack, 'Нет атаки');
      const pending = next.pendingAttack;
      let target = pending.target.kind === 'creature' ? [...p.main, ...p.auxiliary].find(c => c.objectId === pending.target.objectId) : null;
      const attacker = [...next.players[next.active].main, ...next.players[next.active].auxiliary].find(c => c.objectId === pending.attackerId);
      const interceptor = command.interceptorId === null ? null : [...p.main, ...p.auxiliary].find(c => c.objectId === command.interceptorId && c.card.kind === 'creature');
      if (command.interceptorId !== null) {
        requireRule(interceptor && !interceptor.exhausted && !interceptor.stasis && interceptor.interceptions === 0, 'Перехватчик недоступен');
        requireRule(pending.target.kind !== 'creature' || ability(interceptor,'guard'), 'Только Страж перехватывает атаку по Существу');
        requireRule(!attacker || !ability(attacker,'flying') || ability(interceptor,'flying'), 'Наземное Существо не перехватывает Полёт');
        interceptor.interceptions++;
      }
      const legendTarget = pending.target.kind === 'legend' ? p.legends.find(c => c.objectId === pending.target.objectId) : null;
      const combatTarget = interceptor ?? target;
      if (attacker && (combatTarget || pending.target.kind === 'player' || legendTarget)) {
        resolveCombat(next, attacker, combatTarget ?? null, legendTarget ?? null, p, pending.target, !!interceptor);
        resolveDeaths(next, collectLethal(next));
        for (const owner of next.players) for (let i = owner.legends.length - 1; i >= 0; i--)
          if (owner.legends[i].loyalty! <= 0) sendToDiscard(owner, owner.legends.splice(i, 1)[0].card);
      }
      if (!finishIfLethal(next)) next.phase = 'main';
      if (attacker && [...next.players[next.active].main, ...next.players[next.active].auxiliary].includes(attacker) &&
          (attacker.attacksMade ?? 0) <= (ability(attacker,'extraAttacks') ?? 0)) attacker.exhausted = false;
      next.pendingAttack = null;
      break;
    }
    case 'endTurn': {
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      p.energy = emptyEnergy();
      for (const unit of [...p.main, ...p.auxiliary,...p.legends]) {
        unit.stunned = false;
        unit.silenced = false;
        if (unit.stasis) unit.stasis--;
      }
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
    default: throw new RuleError('Неизвестная команда');
  }
  } catch (error) {
    if (!(error instanceof EffectLimitError)) throw error;
    const paused = structuredClone(game);
    paused.phase = 'paused'; paused.pauseReason = error.message;
    paused.revision++;
    paused.processed[command.key] = { revision: paused.revision, command: fingerprint };
    return paused;
  }
  next.revision++;
  next.processed[command.key] = { revision: next.revision, command: fingerprint };
  return next;
}
function advance(game: Game): void {
  game.active = (1 - game.active) as PlayerId;
  game.turn++;
  game.operationsUsed = 0;
  game.phase = 'main';
  const p = game.players[game.active];
  p.domainsPlayed = 0;
  for (const domain of p.domains) domain.exhausted = false;
  for (const creature of p.main) creature.exhausted = false;
  for (const creature of p.auxiliary) creature.exhausted = false;
  for (const creature of [...p.main, ...p.auxiliary]) creature.attacksMade = 0;
  // A defender's per-opponent-turn intercept limit resets when that opponent starts.
  for (const creature of game.players[1 - game.active].main) creature.interceptions = 0;
  for (const creature of game.players[1 - game.active].auxiliary) creature.interceptions = 0;
  if (p.deck.length) p.hand.push(p.deck.shift()!);
  for (const unit of [...p.main, ...p.auxiliary]) {
    // v0.9.13: Stasis pauses Poison; its duration still advances at turn end.
    // The Poison tick resumes at the next own turn start after Stasis expires.
    if (unit.poison && !unit.stasis) {
      damage(unit, unit.poison.strength);
      if (--unit.poison.ticks <= 0) unit.poison = undefined;
    }
  }
  resolveDeaths(game, collectLethal(game));
  if (finishIfLethal(game)) return;
  const ready: ReadyRitual[] = [];
  for (const effect of p.rituals) {
    const victims = eligibleVictims(p, effect.color).map(unit => unit.objectId);
    if (victims.length >= effect.threshold) ready.push({ effect: structuredClone(effect), eligibleIds: victims });
    effect.remainingStarts--;
  }
  p.rituals = p.rituals.filter(effect => effect.remainingStarts > 0);
  game.readyRituals = ready;
  if (ready.length) game.phase = 'ritual';
}
class EffectLimitError extends Error {}
export const MAX_EFFECT_OPERATIONS = 128;
type Death = { unit: Permanent; owner: PlayerId };
function removePermanents(owner: Player, ids: readonly number[]): Permanent[] {
  const removed: Permanent[] = [];
  for (const id of ids) {
    const zone = [owner.main, owner.auxiliary].find(group => group.some(unit => unit.objectId === id));
    if (!zone) throw new RuleError('Существо уже покинуло поле');
    removed.push(zone.splice(zone.findIndex(unit => unit.objectId === id), 1)[0]);
  }
  return removed;
}
function collectLethal(game: Game): Death[] {
  const dead: Death[] = [];
  for (const owner of [0, 1] as const) {
    const player = game.players[owner];
    for (const zone of [player.main, player.auxiliary]) {
      for (let i = zone.length - 1; i >= 0; i--) {
        const unit = zone[i];
        if (unit.card.health !== undefined && unit.damage >= unit.card.health)
          dead.push({ unit: zone.splice(i, 1)[0], owner });
      }
    }
  }
  // Active player resolves their simultaneous deaths first; stable ordering by object id.
  return dead.sort((a, b) => (a.owner === game.active ? 0 : 1) - (b.owner === game.active ? 0 : 1) || a.unit.objectId - b.unit.objectId);
}
function resolveDeaths(game: Game, initial: Death[]): void {
  const queue = [...initial];
  while (queue.length) {
    if ((game.operationsUsed = (game.operationsUsed ?? 0) + 1) > MAX_EFFECT_OPERATIONS)
      throw new EffectLimitError('Превышен бюджет обязательных эффектов; матч приостановлен');
    const { unit, owner } = queue.shift()!;
    const effect = unit.stasis || unit.silenced ? undefined : unit.card.onDeath;
    if (effect) {
      if (!Number.isSafeInteger(effect.amount) || effect.amount < 0) throw new RuleError('Неверный эффект гибели');
      if (effect.kind === 'damageController') game.players[owner].hp -= effect.amount;
      else if (effect.kind === 'damageOpponent') game.players[(1 - owner) as PlayerId].hp -= effect.amount;
      else if (effect.kind === 'damageAllCreatures') {
        for (const side of game.players) for (const creature of [...side.main, ...side.auxiliary]) damage(creature, effect.amount);
        queue.push(...collectLethal(game));
      } else throw new RuleError('Неизвестный обязательный эффект гибели');
    }
    sendToDiscard(game.players[owner], unit.card, unit.ritualReward);
  }
}
function finishIfLethal(game: Game): boolean {
  const [a, b] = game.players;
  if (a.hp > 0 && b.hp > 0) return false;
  game.winner = a.hp <= 0 && b.hp <= 0 ? 'draw' : a.hp <= 0 ? 1 : 0;
  game.phase = 'finished';
  return true;
}

