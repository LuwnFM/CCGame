import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import {payForCard} from '../energy.ts';
import {activateLegend} from '../legends.ts';
import {takeCard,placePermanent,departPermanent,discardDetached} from '../zones.ts';

registerCommand('playLegend',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'legend' && card.cost && Number.isSafeInteger(card.loyalty) && card.loyalty! > 0, 'Неверная Легенда');
      const sameLegend = p.legends.find(legend => legend.card.name === card.name);
      requireRule(!sameLegend || typeof command.keepExisting === 'boolean', 'Выберите, какую одноимённую Легенду оставить');
      p.energy = payForCard(p, card.cost);
      takeCard(p,'hand',command.handIndex,next,command.actor);
      if (sameLegend) {
        if (command.keepExisting) { discardDetached(next,command.actor,card); return; }
        departPermanent(next,command.actor,sameLegend.objectId,['legends']);
      }
      placePermanent(next,command.actor,'legends',card,{loyalty:card.loyalty,exhausted:false});
      return;
});

registerCommand('activateLegend',(next,command)=>{const p=next.players[command.actor];
      activateLegend(next, command);
      return;
});

