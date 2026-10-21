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
registerCommand('attack',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const attacker = [...p.main, ...p.auxiliary].find(c => c.objectId === command.attackerId && c.card.kind === 'creature');
      requireRule(attacker && !attacker.card.cannotAttack && !attacker.exhausted && !attacker.stunned && !attacker.stasis &&
        (attacker.enteredTurn < next.turn || ability(attacker,'haste') || ability(attacker,'zeal') && command.target?.kind === 'creature'), 'Атакующий не готов');
      const defender = (1 - command.actor) as PlayerId;
      requireRule(command.target?.kind === 'player' || command.target?.kind === 'creature' || command.target?.kind === 'legend', 'Неверная цель');
      if (command.target.kind === 'creature') {
        requireRule([...next.players[defender].main, ...next.players[defender].auxiliary].some(c => c.objectId === command.target.objectId && c.card.kind === 'creature' && !ability(c,'stealth')), 'Цель недоступна');
      } else if (command.target.kind === 'legend') {
        requireRule(next.players[defender].legends.some(c => c.objectId === command.target.objectId), 'Легенда недоступна');
      }
      attacker.exhausted = true; attacker.attacksMade = (attacker.attacksMade ?? 0) + 1;
      next.pendingAttack = { attackerId: attacker.objectId, target: command.target, defender };
      next.phase = 'intercept';
      return;
});

registerCommand('intercept',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.phase === 'intercept' && next.pendingAttack, 'Нет атаки');
      const pending = next.pendingAttack;
      let target = pending.target.kind === 'creature' ? [...p.main, ...p.auxiliary].find(c => c.objectId === pending.target.objectId) : null;
      const attacker = [...next.players[next.active].main, ...next.players[next.active].auxiliary].find(c => c.objectId === pending.attackerId);
      const interceptor = command.interceptorId === null ? null : [...p.main, ...p.auxiliary].find(c => c.objectId === command.interceptorId && c.card.kind === 'creature');
      if (command.interceptorId !== null) {
        requireRule(interceptor && !interceptor.exhausted && !interceptor.stasis && interceptor.interceptions === 0, 'Перехватчик недоступен');
        requireRule(pending.target.kind !== 'creature' || ability(interceptor,'guard'), 'Только Страж перехватывает атаку по Существу');
        requireRule(!attacker || !ability(attacker,'flying') || ability(interceptor,'flying'), 'Наземное Существо не перехватывает Полёт');
        interceptor.interceptions++;
      }
      const legendTarget = pending.target.kind === 'legend' ? p.legends.find(c => c.objectId === pending.target.objectId) : null;
      const combatTarget = interceptor ?? target;
      if (attacker && (combatTarget || pending.target.kind === 'player' || legendTarget)) {
        resolveCombat(next, attacker, combatTarget ?? null, legendTarget ?? null, p, pending.target, !!interceptor);
        resolveDeaths(next, collectLethal(next));
        for (const owner of next.players) for (let i = owner.legends.length - 1; i >= 0; i--)
          if(owner.legends[i].loyalty!<=0)departPermanent(next,next.players.indexOf(owner) as PlayerId,owner.legends[i].objectId,['legends']);
      }
      if (!finishIfLethal(next)) next.phase = 'main';
      if (attacker && [...next.players[next.active].main, ...next.players[next.active].auxiliary].includes(attacker) &&
          (attacker.attacksMade ?? 0) <= (ability(attacker,'extraAttacks') ?? 0)) attacker.exhausted = false;
      next.pendingAttack = null;
      emitGameEvent(next,{type:'combatResolved',owner:next.active,objectId:pending.attackerId});
      return;
});
