import {registerCommand} from '../command-router.ts';
import {requireRule} from './shared.ts';
import type {PlayerId} from '../../model/index.ts';
import {ability} from '../abilities.ts';
import {canGuardIntercept} from '../traits/guard.ts';
import {canInterceptFlyingAttack} from '../traits/flying.ts';
import {canSelectAsAttackTarget} from '../traits/stealth.ts';
import {hasImmediateAttack} from '../traits/haste.ts';
import {hasCreatureOnlyImmediateAttack} from '../traits/zeal.ts';
import {canAttackAgain} from '../traits/extraAttacks.ts';
import {isAttackProhibited} from '../traits/cannotAttack.ts';
import {resolveCombat} from '../combat.ts';
import {collectLethal,resolveDeaths,finishIfLethal} from '../death-queue.ts';
import {departPermanent} from '../zones.ts';
import {emitGameEvent} from '../events.ts';

registerCommand('attack',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const attacker = [...p.main, ...p.auxiliary].find(c => c.objectId === command.attackerId && c.card.kind === 'creature');
      requireRule(attacker && !isAttackProhibited(attacker) && !attacker.exhausted && !attacker.stunned && !attacker.stasis &&
        (attacker.attacksMade??0)<1+(ability(attacker,'extraAttacks')??0) &&
        (attacker.enteredTurn < next.turn || hasImmediateAttack(attacker) || hasCreatureOnlyImmediateAttack(attacker,command.target?.kind)), 'Атакующий не готов');
      const defender = (1 - command.actor) as PlayerId;
      requireRule(command.target?.kind === 'player' || command.target?.kind === 'creature' || command.target?.kind === 'legend', 'Неверная цель');
      if (command.target.kind === 'creature') {
        requireRule([...next.players[defender].main, ...next.players[defender].auxiliary].some(c => c.objectId === command.target.objectId && c.card.kind === 'creature' && canSelectAsAttackTarget(c)), 'Цель недоступна');
      } else if (command.target.kind === 'legend') {
        requireRule(next.players[defender].legends.some(c => c.objectId === command.target.objectId), 'Легенда недоступна');
      }
      attacker.exhausted = !ability(attacker,'untiring'); attacker.attacksMade = (attacker.attacksMade ?? 0) + 1;
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
        requireRule(pending.target.kind !== 'creature' || canGuardIntercept(interceptor), 'Только Страж перехватывает атаку по Существу');
        requireRule(canInterceptFlyingAttack(attacker??null,interceptor), 'Наземное Существо не перехватывает Полёт');
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
          canAttackAgain(attacker)) attacker.exhausted = false;
      next.pendingAttack = null;
      emitGameEvent(next,{type:'combatResolved',owner:next.active,objectId:pending.attackerId});
      return;
});

