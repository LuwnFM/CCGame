import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import {RuleError,sendToDiscard,type Game,type Command,type PendingReward,type ReadyRitual,type PlayerId} from '../../core.ts';
import {mulligan} from '../../setup.ts';
import {eligibleVictims,nextRandom,planRitual} from '../../ritual.ts';
import {ability} from '../abilities.ts';
import {resolveCombat} from '../combat.ts';
import {emptyEnergy,payForCard} from '../energy.ts';
import {activateLegend} from '../legends.ts';
import {enterTrigger,resolveTechnique} from '../techniques.ts';
import {removePermanents,collectLethal,resolveDeaths,finishIfLethal} from '../death-queue.ts';
import {drawCards,leaveCard,moveCard,takeCard,placePermanent,departPermanent,addCard} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {advance} from '../turns.ts';
registerCommand('playLegend',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'legend' && card.cost && Number.isSafeInteger(card.loyalty) && card.loyalty! > 0, 'Неверная Легенда');
      const sameLegend = p.legends.find(legend => legend.card.name === card.name);
      requireRule(!sameLegend || typeof command.keepExisting === 'boolean', 'Выберите, какую одноимённую Легенду оставить');
      p.energy = payForCard(p, card.cost);
      takeCard(p,'hand',command.handIndex);
      if (sameLegend) {
        if (command.keepExisting) { sendToDiscard(p, card); return; }
        departPermanent(next,command.actor,sameLegend.objectId,['legends']);
      }
      placePermanent(next,command.actor,'legends',card,{loyalty:card.loyalty,exhausted:false});
      return;
});

registerCommand('activateLegend',(next,command)=>{const p=next.players[command.actor];
      activateLegend(next, command);
      return;
});
