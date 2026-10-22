import {RuleError} from '../errors.ts';
import type {Aspect,Cost,Energy,Player} from '../model/index.ts';

const energies: readonly Energy[] = ['red', 'blue', 'green', 'gold', 'violet', 'neutral'];
export const emptyEnergy = (): Record<Energy, number> => ({ red: 0, blue: 0, green: 0, gold: 0, violet: 0, neutral: 0 });
function requireEnergy(ok: unknown, message: string): asserts ok { if (!ok) throw new RuleError(message); }

/** Reserve colored costs, then spend neutral before colored energy on generic costs. */
export function payForCard(owner: Player, cost: Cost, domainIds?: number[]): Record<Energy, number> {
  const available = { ...owner.energy };
  let ready = owner.domains.filter(d => !d.exhausted && d.card.produces);
  if (domainIds !== undefined) {
    requireEnergy(Array.isArray(domainIds) && new Set(domainIds).size === domainIds.length, 'Неверный выбор Владений');
    requireEnergy(domainIds.every(id => ready.some(d => d.objectId === id)), 'Выбранное Владение недоступно');
    ready = domainIds.map(id => ready.find(d => d.objectId === id)!);
  } else {
    ready = [...ready].sort((a,b) => Number(!!b.card.basic)-Number(!!a.card.basic));
  }
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
    requireEnergy(available[color] >= required, 'Не хватает цветной Энергии');
    available[color] -= required;
  }
  let total = energies.reduce((n,color)=>n+available[color],0);
  for (const color of ['neutral', 'red', 'blue', 'green', 'gold', 'violet'] as Energy[]) {
    while (total < cost.generic && tap(color)) total++;
  }
  requireEnergy(total >= cost.generic, 'Не хватает Энергии');
  return pay(available, { colored: {}, generic: cost.generic });
}
export function pay(pool: Record<Energy, number>, cost: Cost): Record<Energy, number> {
  const result = { ...pool };
  for (const color of energies.slice(0, 5) as Aspect[]) {
    const amount = cost.colored[color] ?? 0;
    requireEnergy(Number.isSafeInteger(amount) && amount >= 0, 'Неверная стоимость');
    requireEnergy(result[color] >= amount, 'Не хватает цветной Энергии');
    result[color] -= amount;
  }
  requireEnergy(Number.isSafeInteger(cost.generic) && cost.generic >= 0, 'Неверная стоимость');
  requireEnergy(energies.reduce((sum, color) => sum + result[color], 0) >= cost.generic, 'Не хватает Энергии');
  let remaining = cost.generic;
  for (const color of [...energies].reverse()) {
    const taken = Math.min(result[color], remaining);
    result[color] -= taken; remaining -= taken;
  }
  return result;
}
