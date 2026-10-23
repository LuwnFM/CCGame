import {canBeDisplaced} from '../traits/majestic.ts';
import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import {RuleError} from '../../errors.ts';
import {payForCard} from '../energy.ts';
import {enterTrigger} from '../techniques.ts';
import {takeCard,placePermanent,departPermanent,discardDetached} from '../zones.ts';

registerCommand('playDomain',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      requireRule(p.domainsPlayed < 1, 'Владение уже разыграно');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'domain' && !!card.produces, 'Неверное Владение');
      takeCard(p,'hand',command.handIndex,next,command.actor);
      placePermanent(next,command.actor,'domains',card,{exhausted:false,shield:0});
      p.domainsPlayed++;
      return;
});

registerCommand('tapDomain',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const domain = p.domains.find(d => d.objectId === command.objectId);
      requireRule(domain && !domain.exhausted && domain.card.produces, 'Владение недоступно');
      domain.exhausted = true;
      p.energy[domain.card.produces]++;
      return;
});

registerCommand('playCreature',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'creature' && card.cost, 'Неверное Существо');
      // Unknown abilities are displayed as inactive in the UI; they never run silently.
      requireRule(Number.isSafeInteger(card.attack) && card.attack! >= 0 && Number.isSafeInteger(card.health) && card.health! > 0, 'Неверные характеристики');
      const duplicate = card.unique ? [...p.main,...p.auxiliary].find(u=>u.card.name===card.name) : undefined;
      if(duplicate){
        requireRule(typeof command.keepExisting==='boolean','Выберите, какую Уникальную оставить');
        if(command.keepExisting){p.energy=payForCard(p,card.cost,command.domainIds);takeCard(p,'hand',command.handIndex,next,command.actor);discardDetached(next,command.actor,card,!!card.ritualReward);return;}
        requireRule(canBeDisplaced(duplicate),'Величественного нельзя вытеснить');
        departPermanent(next,command.actor,duplicate.objectId);
      }
      const zone = card.createdToken ? p.auxiliary : p.main;
      const limit = card.createdToken ? 4 : 8;
      if (zone.length >= limit) {
        if (!card.createdToken) throw new RuleError('Основная зона заполнена');
        const replaced = zone.find(unit => unit.objectId === command.replaceId && canBeDisplaced(unit));
        requireRule(replaced, 'Выберите допустимый объект для Вытеснения токеном');
        // Displacement is a departure, not a death. Never trigger onDeath.
        departPermanent(next,command.actor,replaced.objectId);
      }
      const energy = payForCard(p, card.cost,command.domainIds);
      p.energy = energy; takeCard(p,'hand',command.handIndex,next,command.actor);
      placePermanent(next,command.actor,card.createdToken?'auxiliary':'main',card,
        {exhausted:!card.haste&&!card.zeal,ritualReward:!!card.ritualReward});
      enterTrigger(next,command.actor,card,'hand',command.targetId);
      return;
});

registerCommand('playArtifact',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'artifact' && card.cost, 'Неверный предмет');
      const sameItem = p.auxiliary.find(unit => unit.card.name === card.name);
      requireRule(!sameItem || typeof command.keepExisting === 'boolean', 'Выберите, какой одноимённый предмет оставить');
      if (!sameItem && p.auxiliary.length >= 4) {
        const replaced = p.auxiliary.find(unit => unit.objectId === command.replaceId && canBeDisplaced(unit));
        requireRule(replaced, 'Выберите допустимый предмет или токен для Вытеснения');
        departPermanent(next,command.actor,replaced.objectId,['auxiliary']);
      }
      p.energy = payForCard(p, card.cost,command.domainIds);
      takeCard(p,'hand',command.handIndex,next,command.actor);
      if (sameItem) {
        if (command.keepExisting) { discardDetached(next,command.actor,card); return; }
        requireRule(canBeDisplaced(sameItem),'Величественного нельзя вытеснить');
        departPermanent(next,command.actor,sameItem.objectId,['auxiliary']);
      }
      placePermanent(next,command.actor,'auxiliary',card,{exhausted:false,shield:0});
      return;
});

