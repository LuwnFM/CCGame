import { RuleError, type Card, type Game, type Player, type Permanent, type PlayerId } from '../core.ts';
import { EffectLimitError, MAX_EFFECT_OPERATIONS } from './death-queue.ts';

function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new RuleError(message); }
/** Deterministic created tokens always occupy auxiliary slots; never overflow. */
function spawnSkeleton(game: Game, actor: PlayerId, count: number, source: Card): void {
  requireRule(Number.isSafeInteger(count) && count >= 0 && count <= 4, 'Неверное число призываемых');
  const owner=game.players[actor];
  for(let i=0;i<count && owner.auxiliary.length<4;i++){
    const card:Card={id:'violet-skeleton-token',name:'Призванный скелет',kind:'creature',
      aspects:['violet'],attack:1,health:1,createdToken:true,sacrifice:true,
      lore:{state:'Искажение',organization:'Некроманты',summary:'Поднятый скелет служит временной Жертвой ритуала.',note:'Токен 1/1; исчезает вместо попадания в Сброс.'}};
    owner.auxiliary.push({objectId:game.nextObjectId++,card,damage:0,shield:0,exhausted:true,
      interceptions:0,enteredTurn:game.turn,sacrifice:true,attacksMade:0});
  }
}
/** Only entered-from-hand and revived-from-discard cards receive the corresponding trigger. */
export function enterTrigger(game:Game,actor:PlayerId,card:Card,origin:'hand'|'discard',targetId?:number):void{
  const effect=origin==='hand'?card.onEntry:card.secondChance;
  if(!effect)return;
  if((game.operationsUsed=(game.operationsUsed??0)+1)>MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет Вступления/Второго шанса');
  requireRule(Number.isSafeInteger(effect.amount) && effect.amount>=0&&effect.amount<=4,'Неверное Вступление');
  if(effect.kind==='summonSkeleton')spawnSkeleton(game,actor,effect.amount,card);
  else if(effect.kind==='stunEnemy') {
    // A blue entry stuns one chosen enemy Creature; a clear board does not prevent entry.
    const enemy=game.players[(1-actor) as PlayerId];
    const candidates=[...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature'&&!u.stunned&&!u.stasis);
    if(candidates.length){
      requireRule(Number.isSafeInteger(targetId),'Выберите цель для Ошеломления');
      const target=candidates.find(u=>u.objectId===targetId);
      requireRule(target,'Недоступная цель Ошеломления');
      target.stunned=true;
    }else requireRule(targetId===undefined,'Некого ошеломить');
  }
  else if(effect.kind==='healRuler')game.players[actor].hp=Math.min(30,game.players[actor].hp+effect.amount);
  else if(effect.kind==='draw')for(let i=0;i<effect.amount&&game.players[actor].deck.length;i++)
      game.players[actor].hand.push(game.players[actor].deck.shift()!);
  else throw new RuleError('Неизвестный эффект при входе');
}
function getCreature(player:Player,id:number|undefined):Permanent|undefined{
 return [...player.main,...player.auxiliary].find(unit=>unit.objectId===id&&unit.card.kind==='creature');
}
export function resolveTechnique(game:Game,actor:PlayerId,card:Card,command:{targetId?:number;discardIndex?:number}):void{
  const effect=card.techniqueEffect!;
  const owner=game.players[actor];
  const enemy=game.players[(1-actor) as PlayerId];
  requireRule(Number.isSafeInteger(effect.amount)&&effect.amount>=0&&effect.amount<=8,'Неверная Техника');
  if(effect.kind==='damageOpponent')enemy.hp-=effect.amount;
  else if(effect.kind==='healRuler')owner.hp=Math.min(30,owner.hp+effect.amount);
  else if(effect.kind==='draw')for(let i=0;i<effect.amount&&owner.deck.length;i++)owner.hand.push(owner.deck.shift()!);
  else if(effect.kind==='reanimate'){
    requireRule(Number.isSafeInteger(command.discardIndex) && !!owner.discard[command.discardIndex!] &&
      owner.discard[command.discardIndex!].kind==='creature','Выберите Существо из сброса');
    requireRule(owner.main.length<8,'Нет места для воскрешённого Существа');
    const revived=owner.discard[command.discardIndex!]!;
    owner.discard.splice(command.discardIndex!,1);
    owner.main.push({objectId:game.nextObjectId++,card:revived,damage:0,shield:revived.shield??0,
      exhausted:true,interceptions:0,enteredTurn:game.turn,sacrifice:revived.sacrifice,attacksMade:0});
    enterTrigger(game,actor,revived,'discard');
  }else {
    const side=effect.kind==='silence'||effect.kind==='bind'?enemy:owner;
    const target=effect.kind==='bind'?getCreature(side,command.targetId):[...side.main,...side.auxiliary,...side.legends].find(p=>p.objectId===command.targetId);
    requireRule(target,'Выберите допустимое Существо');
    if(effect.kind==='cleanse'){target.poison=undefined;target.stunned=false;target.stasis=undefined;target.silenced=false}
    else if(effect.kind==='ward')throw new RuleError('Оберег ещё не реализован; это не Щит');
    else if(effect.kind==='silence')target.silenced=true;
    else if(effect.kind==='bind'){
      if(target.stunned||target.stasis){target.stunned=false;target.stasis=effect.amount}
      else target.stunned=true;
    }else throw new RuleError('Неизвестный эффект Техники');
  }
}
