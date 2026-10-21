import type { Game, Permanent, Player, PlayerId } from './core-v0.9.13.ts';

export function damage(target: Permanent, amount: number): number {
  const absorbed = Math.min(target.shield, amount);
  target.shield -= absorbed;
  const dealt = Math.max(0, amount - absorbed);
  target.damage += dealt;
  return dealt;
}
export function totalAttack(owner: Player, creature: Permanent): number {
  const aura = owner.auxiliary.filter(item => item.card.kind === 'artifact' && !item.stasis)
    .reduce((sum, item) => sum + (item.card.auraAttack ?? 0), 0);
  return Math.max(0, (creature.card.attack ?? 0) + aura);
}
function woundLegend(target: Permanent, raw: number): number {
  if (raw <= 0) return 0;
  const reduced = Math.max(1, Math.floor(raw / 2));
  const absorbed = Math.min(target.shield, reduced);
  target.shield -= absorbed;
  const actual = Math.min(Math.max(0, target.loyalty ?? 0), reduced - absorbed);
  target.loyalty! -= reduced - absorbed;
  return actual;
}
function applyPoison(target: Permanent, source: Permanent): void {
  const incoming = source.card.poisonHit;
  if (!incoming) return;
  const old = target.poison;
  if (!old || incoming.strength > old.strength || incoming.strength === old.strength && incoming.ticks > old.ticks)
    target.poison = { ...incoming };
}

/** One combat packet. First Strike has an early packet; ordinary simultaneous hits still trade. */
export function resolveCombat(game: Game, attacker: Permanent, defender: Permanent | null, legend: Permanent | null,
  defendingPlayer: Player, declared: { kind: 'player' } | { kind: 'creature' | 'legend'; objectId: number }, intercepted: boolean): void {
  const attackingPlayer = game.players[game.active];
  const attack = totalAttack(attackingPlayer, attacker);
  const response = defender ? totalAttack(defendingPlayer, defender) : 0;
  const heal = (owner: Player, source: Permanent, dealt: number) => { if (source.card.lifesteal) owner.hp = Math.min(30, owner.hp + dealt); };
  const original = () => declared.kind === 'creature' ? [...defendingPlayer.main, ...defendingPlayer.auxiliary].find(x => x.objectId === declared.objectId)
    : declared.kind === 'legend' ? defendingPlayer.legends.find(x => x.objectId === declared.objectId) : null;
  const spill = (amount: number) => {
    if (amount <= 0) return;
    const target = original();
    let dealt = 0;
    if (declared.kind === 'player') { dealt = Math.min(Math.max(0, defendingPlayer.hp), amount); defendingPlayer.hp -= amount; }
    else if (target && declared.kind === 'legend') dealt = woundLegend(target, amount);
    else if (target) dealt = Math.min(Math.max(0, target.card.health! - target.damage), damage(target, amount));
    heal(attackingPlayer, attacker, dealt);
  };
  const hit = () => {
    if (defender) {
      const remaining = Math.max(0, (defender.card.health ?? 0) - defender.damage);
      const shieldBefore = defender.shield;
      const dealt = damage(defender, attack);
      heal(attackingPlayer, attacker, Math.min(remaining, dealt));
      applyPoison(defender, attacker);
      if (intercepted && attacker.card.piercing) spill(Math.max(0, attack - shieldBefore - remaining));
    } else if (legend) heal(attackingPlayer, attacker, woundLegend(legend, attack));
    else { const dealt = Math.min(Math.max(0, defendingPlayer.hp), attack); defendingPlayer.hp -= attack; heal(attackingPlayer, attacker, dealt); }
  };
  const reply = () => {
    if (!defender) return;
    const remaining = Math.max(0, (attacker.card.health ?? 0) - attacker.damage);
    const dealt = damage(attacker, response);
    heal(defendingPlayer, defender, Math.min(remaining, dealt));
    applyPoison(attacker, defender);
  };
  if (!defender) { hit(); return; }
  if (attacker.card.firstStrike && !defender.card.firstStrike) {
    hit(); if (defender.damage < defender.card.health!) reply();
  } else if (defender.card.firstStrike && !attacker.card.firstStrike) {
    reply(); if (attacker.damage < attacker.card.health!) hit();
  } else { hit(); reply(); }
}
