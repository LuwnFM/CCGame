import { RuleError, sendToDiscard, type Card, type Command, type Game, type PlayerId } from '../core.ts';
import { eligibleVictims } from '../ritual.ts';
import { finishIfLethal } from './death-queue.ts';
import { summon } from './zones.ts';
import { SIGNATURE_TOKENS, CERA_SERVANT } from '../cards/tokens.ts';

function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new RuleError(message); }

export function activateLegend(next: Game, command: Extract<Command,{type:'activateLegend'}>): void {
  const p = next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const legend = p.legends.find(unit => unit.objectId === command.objectId);
      const choices = legend?.card.loyaltyAbilities?.length ? legend.card.loyaltyAbilities : legend?.card.loyaltyAbility ? [legend.card.loyaltyAbility] : [];
      const chosen = command.abilityIndex ?? (legend?.card.loyaltyAbilities?.length ? 1 : 0);
      const ability = Number.isSafeInteger(chosen) && chosen >= 0 ? choices[chosen] : undefined;
      requireRule(legend && ability && legend.lastActivatedTurn !== next.turn && !legend.stunned && !legend.stasis && !legend.silenced, 'Способность Легенды недоступна');
      requireRule(Number.isSafeInteger(ability.delta) && (ability.kind==='summon' ? Array.isArray(ability.cards) : Number.isSafeInteger(ability.amount) && ability.amount >= 0), 'Неверная способность');
      requireRule(legend.loyalty! + ability.delta >= 0, 'Не хватает Лояльности');
      if (ability.kind === 'recoverCreature')
        requireRule(Number.isSafeInteger(command.discardIndex) && p.discard[command.discardIndex!]?.kind === 'creature',
          'Выберите Существо из сброса для возвращения в руку');
      if (ability.kind === 'raiseSacrifice'||ability.kind === 'summonSignature'||ability.kind === 'summon')
        requireRule(p.auxiliary.length < 4, 'Нет свободного места для призыва');
      legend.loyalty! += ability.delta;
      legend.lastActivatedTurn = next.turn;
      if (ability.kind === 'healRuler') p.hp = Math.min(30, p.hp + ability.amount);
      else if (ability.kind === 'damageOpponent') next.players[(1 - command.actor) as PlayerId].hp -= ability.amount;
      else if (ability.kind === 'draw') for (let i = 0; i < ability.amount && p.deck.length; i++) p.hand.push(p.deck.shift()!);
      else if (ability.kind === 'recoverCreature') p.hand.push(p.discard.splice(command.discardIndex!, 1)[0]);
      else if (ability.kind === 'summon'||ability.kind === 'summonSignature'||ability.kind === 'raiseSacrifice'){
        if(ability.kind==='summon')summon(next,command.actor,ability.cards);
        else if(ability.kind==='summonSignature'){
          requireRule(ability.amount===1,'Неверное число сигнатурных токенов');
          const aspect=legend.card.aspects?.[0]??'neutral';
          const template=SIGNATURE_TOKENS[aspect as keyof typeof SIGNATURE_TOKENS];
          requireRule(template,'Неизвестный аспект токена');
          summon(next,command.actor,[template]);
        }else summon(next,command.actor,[CERA_SERVANT]);
        // Cera's historical ritual-completion side effect remains available for existing matches.
        if(ability.kind==='raiseSacrifice'||ability.kind==='summon'&&ability.completeRitual){
          const ready=p.rituals.find(effect=>eligibleVictims(p,effect.color).length>=effect.threshold);
          if(ready){
            next.readyRituals=[{effect:structuredClone(ready),
              eligibleIds:eligibleVictims(p,ready.color).map(unit=>unit.objectId)}];
            next.phase='ritual';
          }
        }
      } else throw new RuleError('Неизвестная способность Легенды');
      if (legend.loyalty === 0) { p.legends.splice(p.legends.indexOf(legend), 1); sendToDiscard(p, legend.card); }
      finishIfLethal(next);

}
