import type { Card } from '../model/index.ts';

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
