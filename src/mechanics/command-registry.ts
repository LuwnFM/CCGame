import {RuleError,sendToDiscard,type Game,type Command,type PendingReward,type ReadyRitual,type PlayerId} from '../core.ts';
import {mulligan} from '../setup.ts';
import {eligibleVictims,nextRandom,planRitual} from '../ritual.ts';
import {ability} from './abilities.ts';
import {resolveCombat} from './combat.ts';
import {emptyEnergy,payForCard} from './energy.ts';
import {activateLegend} from './legends.ts';
import {enterTrigger,resolveTechnique} from './techniques.ts';
import {removePermanents,collectLethal,resolveDeaths,finishIfLethal} from './death-queue.ts';
import {drawCards,leaveCard,moveCard,takeCard,placePermanent} from './zones.ts';
import {emitGameEvent} from './events.ts';
import {advance} from './turns.ts';
type Handler<T extends Command['type']>=(game:Game,command:Extract<Command,{type:T}>)=>void;
const commands=new Map<Command['type'],(game:Game,command:Command)=>void>();
export function registerCommand<T extends Command['type']>(type:T,handler:Handler<T>):void{
 if(commands.has(type))throw new RuleError('Команда зарегистрирована повторно: '+type);
 commands.set(type,handler as (game:Game,command:Command)=>void);
}
export function registeredCommands():string[]{return [...commands.keys()].sort();}
export function executeCommand(game:Game,command:Command):void{
 const handler=commands.get(command.type);
 if(!handler)throw new RuleError('Неизвестная команда');
 handler(game,command);
}
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new RuleError(message)}
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
registerCommand('playDomain',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      requireRule(p.domainsPlayed < 1, 'Владение уже разыграно');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'domain' && !!card.produces, 'Неверное Владение');
      takeCard(p,'hand',command.handIndex);
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
        if(command.keepExisting){p.energy=payForCard(p,card.cost);p.hand.splice(command.handIndex,1);sendToDiscard(p,card,!!card.ritualReward);break}
        const removed=removePermanents(p,[duplicate.objectId]);
        for(const unit of removed)sendToDiscard(p,unit.card,unit.ritualReward);
      }
      const zone = card.createdToken ? p.auxiliary : p.main;
      const limit = card.createdToken ? 4 : 8;
      if (zone.length >= limit) {
        if (!card.createdToken) throw new RuleError('Основная зона заполнена');
        const replaced = zone.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        requireRule(replaced, 'Выберите допустимый объект для Вытеснения токеном');
        // Displacement is a departure, not a death. Never trigger onDeath.
        zone.splice(zone.indexOf(replaced), 1);
        sendToDiscard(p, replaced.card, replaced.ritualReward);
      }
      const energy = payForCard(p, card.cost);
      p.energy = energy; takeCard(p,'hand',command.handIndex);
      placePermanent(next,command.actor,card.createdToken?'auxiliary':'main',card,
        {exhausted:!card.haste&&!card.zeal,ritualReward:!!card.ritualReward});
      enterTrigger(next,command.actor,card,'hand',command.targetId);
      return;
});
registerCommand('playTechnique',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'technique' && card.cost && (card.ritual||card.techniqueEffect), 'Неверная Техника');
      // Validate targets before committing costs; apply() works on a transactionally cloned game.
      if(card.ritual)requireRule(Number.isSafeInteger(card.ritual.duration) && card.ritual.duration > 0, 'Неверный срок Ритуала');
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if(card.ritual)p.rituals.push({ id: `ritual-${next.nextObjectId++}`, color: card.ritual.color, threshold: card.ritual.threshold,
        rewardPool: card.ritual.rewardPool, requiresSource: false, remainingStarts: card.ritual.duration });
      else resolveTechnique(next,command.actor,card,command);
      sendToDiscard(p, card);
      resolveDeaths(next,collectLethal(next));
      finishIfLethal(next);
      return;
});
registerCommand('rulerDraw',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn>0 && next.phase==='main','Недоступная фаза');
      requireRule(p.lastRulerDrawTurn!==next.turn,'Способность Владетеля уже применена');
      requireRule(p.hp>2,'Недостаточно здоровья Владетеля');
      requireRule(p.hand.length<=3,'Для добора должно быть не больше 3 карт в руке');
      requireRule(p.deck.length>=2,'В колоде должно быть не менее двух карт');
      p.hp-=2;p.lastRulerDrawTurn=next.turn;
      drawCards(p,2);
      return;
});
registerCommand('playLegend',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'legend' && card.cost && Number.isSafeInteger(card.loyalty) && card.loyalty! > 0, 'Неверная Легенда');
      const sameLegend = p.legends.find(legend => legend.card.name === card.name);
      requireRule(!sameLegend || typeof command.keepExisting === 'boolean', 'Выберите, какую одноимённую Легенду оставить');
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if (sameLegend) {
        if (command.keepExisting) { sendToDiscard(p, card); return; }
        p.legends.splice(p.legends.indexOf(sameLegend), 1);
        sendToDiscard(p, sameLegend.card, sameLegend.ritualReward);
      }
      placePermanent(next,command.actor,'legends',card,{loyalty:card.loyalty,exhausted:false});
      return;
});
registerCommand('activateLegend',(next,command)=>{const p=next.players[command.actor];
      activateLegend(next, command);
      return;
});
registerCommand('playArtifact',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.turn > 0 && next.phase === 'main', 'Недоступная фаза');
      const card = p.hand[command.handIndex];
      requireRule(card?.kind === 'artifact' && card.cost, 'Неверный предмет');
      const sameItem = p.auxiliary.find(unit => unit.card.name === card.name);
      requireRule(!sameItem || typeof command.keepExisting === 'boolean', 'Выберите, какой одноимённый предмет оставить');
      if (!sameItem && p.auxiliary.length >= 4) {
        const replaced = p.auxiliary.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        requireRule(replaced, 'Выберите допустимый предмет или токен для Вытеснения');
        p.auxiliary.splice(p.auxiliary.indexOf(replaced), 1);
        sendToDiscard(p, replaced.card, replaced.ritualReward);
      }
      p.energy = payForCard(p, card.cost);
      p.hand.splice(command.handIndex, 1);
      if (sameItem) {
        if (command.keepExisting) { sendToDiscard(p, card); return; }
        p.auxiliary.splice(p.auxiliary.indexOf(sameItem), 1);
        sendToDiscard(p, sameItem.card, sameItem.ritualReward);
      }
      placePermanent(next,command.actor,'auxiliary',card,{exhausted:false,shield:0});
      return;
});
registerCommand('chooseRitual',(next,command)=>{const p=next.players[command.actor];
      requireRule(next.phase === 'ritual' && next.readyRituals, 'Сейчас нет выбора Ритуала');
      const ready = next.readyRituals.find(r => r.effect.id === command.effectId);
      requireRule(ready, 'Ритуал не готов');
      requireRule(Array.isArray(command.objectIds) && command.objectIds.every(id => ready.eligibleIds.includes(id)), 'Недопустимые Жертвы');
      const plan = planRitual(p, ready.effect, command.objectIds, next.seed ?? 1);
      next.seed = plan.seedAfter;
      const dead = removePermanents(p, plan.chosenObjectIds);
      resolveDeaths(next, dead.map(unit => ({ unit, owner: command.actor })));
      // Cera's one-card bonus is outside and AFTER the sacrifice death sequence.
      // It does not change the five possible reward cards or three offers.
      if (p.legends.some(unit => unit.card.id === 'violet-цера-ван-троуп' && !unit.stasis && !unit.stunned && !unit.silenced) && p.deck.length)
        drawCards(p,1);
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
      const sameUnique = reward.unique ? [...p.main, ...p.auxiliary].find(unit => unit.card.name === reward.name) : undefined;
      if (sameUnique) {
        requireRule(typeof command.keepExisting === 'boolean', 'Выберите, какую Уникальную оставить');
        if (command.keepExisting) {
          sendToDiscard(p, reward, true);
          next.pendingReward = null; next.phase = 'main';
          return;
        }
        const removed = removePermanents(p, [sameUnique.objectId]);
        for (const unit of removed) sendToDiscard(p, unit.card, unit.ritualReward);
      }
      if (zone.length >= limit) {
        const replacement = zone.find(unit => unit.objectId === command.replaceId && !unit.card.majestic);
        if (replacement) {
          const removed = removePermanents(p, [replacement.objectId]);
          if (reward.createdToken) {
            // Ordinary auxiliary displacement is departure, not death.
            for (const unit of removed) sendToDiscard(p, unit.card, unit.ritualReward);
          } else resolveDeaths(next, removed.map(unit => ({ unit, owner: command.actor })));
        } else if (zone.some(unit => !unit.card.majestic)) throw new RuleError('Выберите заменяемое Существо');
      }
      if (finishIfLethal(next)) { next.pendingReward = null; return; }
      if (zone.length >= limit) {
        const roll = nextRandom(next.seed ?? 1, pending.pool.length); next.seed = roll.seed;
        reward = { ...structuredClone(pending.pool[roll.value]), ritualReward: true };
        // An unplaceable reward goes to hand as a playable card, including temporary token cards.
        // Use printed cost where present; otherwise give generated rewards a zero-cost fallback.
        reward.cost ??= { colored: {}, generic: 0 };
        p.hand.push(reward);
      } else {
        placePermanent(next,command.actor,reward.createdToken?'auxiliary':'main',reward,{ritualReward:true});
      }
      next.pendingReward = null; next.phase = 'main';
      return;
});
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
          if (owner.legends[i].loyalty! <= 0) sendToDiscard(owner, owner.legends.splice(i, 1)[0].card);
      }
      if (!finishIfLethal(next)) next.phase = 'main';
      if (attacker && [...next.players[next.active].main, ...next.players[next.active].auxiliary].includes(attacker) &&
          (attacker.attacksMade ?? 0) <= (ability(attacker,'extraAttacks') ?? 0)) attacker.exhausted = false;
      next.pendingAttack = null;
      emitGameEvent(next,{type:'combatResolved',owner:next.active,objectId:pending.attackerId});
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
      sendToDiscard(p, takeCard(p,'hand',command.handIndex));
      if (p.hand.length <= 8) advance(next);
      return;
});
