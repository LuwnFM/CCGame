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
import {drawCards,leaveCard,moveCard,takeCard,placePermanent,departPermanent,addCard,discardDetached} from '../zones.ts';
import {emitGameEvent} from '../events.ts';
import {advance} from '../turns.ts';
registerCommand('mulligan',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.phase === 'mulligan' && next.mulliganReady && !next.mulliganReady[command.actor], 'Муллиган недоступен');
      // Validation and the replacement happen on a private copy of the game.
      requireRule(Array.isArray(command.indices), 'Неверный выбор муллигана');
      const changed = mulligan({ hand: p.hand, deck: p.deck, seedAfter: next.mulliganSeeds![command.actor] }, command.indices);
      p.hand = changed.hand; p.deck = changed.deck; next.mulliganSeeds![command.actor] = changed.seedAfter;
      next.mulliganReady[command.actor] = true;
      if (next.mulliganReady.every(Boolean)) { next.phase = 'main'; next.turn = 1; }
      return;
});

registerCommand('startTurn',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn === 0, 'Ход уже начат');
      next.turn = 1;
      // The first player does not draw on their first turn.
      return;
});

registerCommand('rulerDraw',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn>0 && next.phase==='main','Недоступная фаза');
      requireRule(p.lastRulerDrawTurn!==next.turn,'Способность Владетеля уже применена');
      requireRule(p.hp>2,'Недостаточно здоровья Владетеля');
      requireRule(p.hand.length<=3,'Для добора должно быть не больше 3 карт в руке');
      requireRule(p.deck.length>=2,'В колоде должно быть не менее двух карт');
      p.hp-=2;p.lastRulerDrawTurn=next.turn;
      drawCards(p,2,next,command.actor);
      return;
});

registerCommand('endTurn',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      p.energy = emptyEnergy();
      emitGameEvent(next,{type:'turnEnd',owner:command.actor});
      for (const unit of [...p.main, ...p.auxiliary,...p.legends]) {
        unit.stunned = false;
        unit.silenced = false;
        if (unit.stasis) unit.stasis--;
      }
      if (p.hand.length > 8) { next.phase = 'discard'; return; }
      advance(next);
      return;
});

registerCommand('discard',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.phase === 'discard', 'Сейчас нет сброса');
      requireRule(Number.isInteger(command.handIndex) && command.handIndex >= 0 && command.handIndex < p.hand.length, 'Неверная карта');
      discardDetached(next,command.actor,takeCard(p,'hand',command.handIndex,next,command.actor));
      if (p.hand.length <= 8) advance(next);
      return;
});
