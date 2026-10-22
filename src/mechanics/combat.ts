import { ability } from './abilities.ts';
import {runCombatHooks,type CombatStage} from './combat-hooks.ts';
import {healFromLifesteal} from './traits/lifesteal.ts';
import {applyPoisonFromHit} from './traits/poisonHit.ts';
import {interceptedOverflow} from './traits/piercing.ts';
import {strikeOrder} from './traits/firstStrike.ts';
import {alliedAuraBonus} from './traits/auraAttack.ts';
import {absorbShield} from './traits/shield.ts';
import type { Game, Permanent, Player, PlayerId } from '../model/index.ts';

export function damage(target: Permanent, amount: number): number {
  const dealt = absorbShield(target,amount);
  target.damage += dealt;
  return dealt;
}
export function totalAttack(owner: Player, creature: Permanent): number {
  const aura = alliedAuraBonus(owner);
  return Math.max(0, (creature.card.attack ?? 0) + aura);
}
function woundLegend(target: Permanent, raw: number): number {
  if (raw <= 0) return 0;
  const reduced = Math.max(1, Math.floor(raw / 2));
  const actualDamage=absorbShield(target,reduced);
  const actual = Math.min(Math.max(0, target.loyalty ?? 0), actualDamage);
  target.loyalty! -= actualDamage;
  return actual;
}

/** One combat packet. First Strike has an early packet; ordinary simultaneous hits still trade. */
export function resolveCombat(game: Game, attacker: Permanent, defender: Permanent | null, legend: Permanent | null,
  defendingPlayer: Player, declared: { kind: 'player' } | { kind: 'creature' | 'legend'; objectId: number }, intercepted: boolean): void {
  const attackingPlayer = game.players[game.active];
  const notify=(stage:CombatStage,source:Permanent,target:Permanent|null,amount:number,dealt:number)=>
    runCombatHooks(stage,{game,attacker,defender,legend,attackerOwner:attackingPlayer,
      defenderOwner:defendingPlayer,intercepted,source,target,amount,dealt});
  notify('beforeCombat',attacker,defender??legend,0,0);
  const attack = totalAttack(attackingPlayer, attacker);
  const response = defender ? totalAttack(defendingPlayer, defender) : 0;
  const heal = healFromLifesteal;
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
      applyPoisonFromHit(defender, attacker);
      spill(interceptedOverflow(attacker,intercepted,attack,shieldBefore,remaining));
      notify('afterAttackerHit',attacker,defender,attack,Math.min(remaining,dealt));
    } else if (legend) {
      const dealt=woundLegend(legend,attack);heal(attackingPlayer,attacker,dealt);
      notify('afterAttackerHit',attacker,legend,attack,dealt);
    }
    else { const dealt = Math.min(Math.max(0, defendingPlayer.hp), attack); defendingPlayer.hp -= attack; heal(attackingPlayer, attacker, dealt);
      notify('afterAttackerHit',attacker,null,attack,dealt); }
  };
  const reply = () => {
    if (!defender) return;
    const remaining = Math.max(0, (attacker.card.health ?? 0) - attacker.damage);
    const dealt = damage(attacker, response);
    heal(defendingPlayer, defender, Math.min(remaining, dealt));
    applyPoisonFromHit(attacker, defender);
    notify('afterDefenderHit',defender,attacker,response,Math.min(remaining,dealt));
  };
  if (!defender) { hit(); notify('afterCombat',attacker,legend,attack,0); return; }
  const order=strikeOrder(attacker,defender);
  if (order==='attacker') {
    hit(); if (defender.damage < defender.card.health!) reply();
  } else if (order==='defender') {
    reply(); if (attacker.damage < attacker.card.health!) hit();
  } else { hit(); reply(); }
  notify('afterCombat',attacker,defender,attack,0);
}

