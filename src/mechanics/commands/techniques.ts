import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import {payForCard} from '../energy.ts';
import {resolveTechnique} from '../techniques.ts';
import {collectLethal,resolveDeaths,finishIfLethal} from '../death-queue.ts';
import {takeCard,discardDetached} from '../zones.ts';

registerCommand('playTechnique',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'technique' && card.cost && (card.ritual||card.techniqueEffect), 'Неверная Техника');
      // Validate targets before committing costs; apply() works on a transactionally cloned game.
      if(card.ritual)requireRule(Number.isSafeInteger(card.ritual.duration) && card.ritual.duration > 0, 'Неверный срок Ритуала');
      p.energy = payForCard(p, card.cost);
      takeCard(p,'hand',command.handIndex,next,command.actor);
      if(card.ritual)p.rituals.push({ id: `ritual-${next.nextObjectId++}`, color: card.ritual.color, threshold: card.ritual.threshold,
        rewardPool: card.ritual.rewardPool, requiresSource: false, remainingStarts: card.ritual.duration });
      else resolveTechnique(next,command.actor,card,command);
      discardDetached(next,command.actor,card);
      resolveDeaths(next,collectLethal(next));
      finishIfLethal(next);
      return;
});

