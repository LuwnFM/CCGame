import { RuleError, sendToDiscard, type Card, type Command, type Game, type PlayerId } from '../core.ts';
import { eligibleVictims } from '../ritual.ts';
import { finishIfLethal } from './death-queue.ts';

function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new RuleError(message); }

export function activateLegend(next: Game, command: Extract<Command,{type:'activateLegend'}>): void {
  const p = next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const legend = p.legends.find(unit => unit.objectId === command.objectId);
      const choices = legend?.card.loyaltyAbilities?.length ? legend.card.loyaltyAbilities : legend?.card.loyaltyAbility ? [legend.card.loyaltyAbility] : [];
      const chosen = command.abilityIndex ?? (legend?.card.loyaltyAbilities?.length ? 1 : 0);
      const ability = Number.isSafeInteger(chosen) && chosen >= 0 ? choices[chosen] : undefined;
      requireRule(legend && ability && legend.lastActivatedTurn !== next.turn && !legend.stunned && !legend.stasis && !legend.silenced, 'Способность Легенды недоступна');
      requireRule(Number.isSafeInteger(ability.delta) && Number.isSafeInteger(ability.amount) && ability.amount >= 0, 'Неверная способность');
      requireRule(legend.loyalty! + ability.delta >= 0, 'Не хватает Лояльности');
      if (ability.kind === 'recoverCreature')
        requireRule(Number.isSafeInteger(command.discardIndex) && p.discard[command.discardIndex!]?.kind === 'creature',
          'Выберите Существо из сброса для возвращения в руку');
      if (ability.kind === 'raiseSacrifice')
        requireRule(p.auxiliary.length < 4, 'Нет свободного места для умертвия Жертвы');
      legend.loyalty! += ability.delta;
      legend.lastActivatedTurn = next.turn;
      if (ability.kind === 'healRuler') p.hp = Math.min(30, p.hp + ability.amount);
      else if (ability.kind === 'damageOpponent') next.players[(1 - command.actor) as PlayerId].hp -= ability.amount;
      else if (ability.kind === 'draw') for (let i = 0; i < ability.amount && p.deck.length; i++) p.hand.push(p.deck.shift()!);
      else if (ability.kind === 'recoverCreature') p.hand.push(p.discard.splice(command.discardIndex!, 1)[0]);
      else if (ability.kind === 'raiseSacrifice') {
        const token: Card = { id: 'vt-cera-ritual-servant', name: 'Умертвие свиты Церы',
          nameEn: 'Cera’s Undead Retainer', kind: 'creature', aspects: ['violet'],
          attack: 2, health: 2, createdToken: true, sacrifice: true,
          lore: {state:'Искажение',organization:'Дом Ван Троуп',summary:'Цера поднимает умертвие для ритуального круга.',
            note:'Игровой ритуальный слуга из некромантской свиты Церы Ван Троуп.'} };
        p.auxiliary.push({objectId:next.nextObjectId++, card:token, exhausted:true,
          damage:0, shield:0, interceptions:0, enteredTurn:next.turn, sacrifice:true, attacksMade:0});
        // Cera may complete ONE existing ritual immediately. The 3-of-5 reward
        // selection, sacrifices and death triggers remain entirely unchanged.
        const ready = p.rituals.find(effect => eligibleVictims(p,effect.color).length >= effect.threshold);
        if (ready) {
          next.readyRituals=[{effect:structuredClone(ready),
            eligibleIds:eligibleVictims(p,ready.color).map(unit=>unit.objectId)}];
          next.phase='ritual';
        }
      } else throw new RuleError('Неизвестная способность Легенды');
      if (legend.loyalty === 0) { p.legends.splice(p.legends.indexOf(legend), 1); sendToDiscard(p, legend.card); }
      finishIfLethal(next);

}
