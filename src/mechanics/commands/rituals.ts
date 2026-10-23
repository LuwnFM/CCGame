import {isDisplaceable,findDisplaceable,findNamedConflict} from '../rules/placement.ts';
import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import {RuleError} from '../../errors.ts';
import type {PendingReward} from '../../model/index.ts';
import {nextRandom,planRitual} from '../../ritual.ts';
import {removePermanents,resolveDeaths,finishIfLethal} from '../death-queue.ts';
import {drawCards,leaveCard,placePermanent,departPermanent,addCard,discardDetached} from '../zones.ts';
import {emitGameEvent} from '../events.ts';

// A card can opt into a generic ritual-completion bonus without an ID-specific branch.
registerCommand('chooseRitual',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.phase === 'ritual' && next.readyRituals, 'Сейчас нет выбора Ритуала');
      const ready = next.readyRituals.find(r => r.effect.id === command.effectId);
      requireRule(ready, 'Ритуал не готов');
      requireRule(Array.isArray(command.objectIds) && command.objectIds.every(id => ready.eligibleIds.includes(id)), 'Недопустимые Жертвы');
      const plan = planRitual(p, ready.effect, command.objectIds, next.seed ?? 1);
      next.seed = plan.seedAfter;
      const dead = removePermanents(p, plan.chosenObjectIds);
      resolveDeaths(next, dead.map(unit => ({ unit, owner: command.actor })));
      // Ritual bonuses resolve after sacrificial deaths, before presenting rewards.
      // Preserve the existing once-per-ritual behavior, even with multiple bonus Legends.
      const bonus = p.legends.find(unit =>
        !unit.stasis && !unit.stunned && !unit.silenced && (unit.card.ritualDrawBonus ?? 0) > 0
      )?.card.ritualDrawBonus ?? 0;
      requireRule(Number.isSafeInteger(bonus) && bonus >= 0 && bonus <= 8, 'Недопустимый бонус Ритуала');
      if (bonus && p.deck.length) drawCards(p,Math.min(bonus,p.deck.length),next,command.actor);
      next.readyRituals = [];
      if (finishIfLethal(next)) return;
      next.pendingReward = { owner: command.actor, offeredIds: plan.offeredRewardIds, pool: [...ready.effect.rewardPool] as PendingReward['pool'] };
      next.phase = 'reward';
      return;
});

registerCommand('chooseReward',(next,command)=>{const p=next.players[command.actor];
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
      const sameUnique = reward.unique ? findNamedConflict([...p.main,...p.auxiliary],reward) : undefined;
      if (sameUnique) {
        requireRule(typeof command.keepExisting === 'boolean', 'Выберите, какую Уникальную оставить');
        if (command.keepExisting) {
          discardDetached(next,command.actor,reward,true);
          next.pendingReward = null; next.phase = 'main';
          return;
        }
        requireRule(isDisplaceable(sameUnique),'Величественного нельзя вытеснить');
        departPermanent(next,command.actor,sameUnique.objectId);
      }
      if (zone.length >= limit) {
        const replacement = findDisplaceable(zone,command.replaceId);
        if (replacement) {
          const removed = removePermanents(p, [replacement.objectId]);
          if (reward.createdToken) {
            // Ordinary auxiliary displacement is departure, not death.
            for(const unit of removed){
              const target=leaveCard(p,unit.card,!!unit.ritualReward);
              emitGameEvent(next,{type:'zoneMoved',owner:command.actor,cardId:unit.card.id,objectId:unit.objectId,from:'detached',to:target});
            }
          } else resolveDeaths(next, removed.map(unit => ({ unit, owner: command.actor })));
        } else if (zone.some(unit => isDisplaceable(unit))) throw new RuleError('Выберите заменяемое Существо');
      }
      if (finishIfLethal(next)) { next.pendingReward = null; return; }
      if (zone.length >= limit) {
        const roll = nextRandom(next.seed ?? 1, pending.pool.length); next.seed = roll.seed;
        reward = { ...structuredClone(pending.pool[roll.value]), ritualReward: true };
        // An unplaceable reward goes to hand as a playable card, including temporary token cards.
        // Use printed cost where present; otherwise give generated rewards a zero-cost fallback.
        reward.cost ??= { colored: {}, generic: 0 };
        addCard(next,command.actor,'hand',reward,'ritual');
      } else {
        placePermanent(next,command.actor,reward.createdToken?'auxiliary':'main',reward,{ritualReward:true});
      }
      next.pendingReward = null; next.phase = 'main';
      return;
});

