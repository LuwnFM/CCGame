import type { Player } from '../core.ts';
import { damage } from './combat.ts';

/** v0.9.13: Stasis pauses Poison; Poison resumes at the next owner turn. */
export function tickStatusesAtTurnStart(owner: Player): void {
  for (const unit of [...owner.main, ...owner.auxiliary]) {
    if (unit.poison && !unit.stasis) {
      damage(unit, unit.poison.strength);
      if (--unit.poison.ticks <= 0) unit.poison = undefined;
    }
  }
}
