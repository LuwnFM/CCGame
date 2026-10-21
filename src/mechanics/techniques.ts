import { RuleError, type Card, type Game, type Player, type Permanent, type PlayerId } from '../core.ts';
import { EffectLimitError, MAX_EFFECT_OPERATIONS } from './death-queue.ts';
import { summon } from './zones.ts';
import {SKELETON,BONE_BLADE,BONE_GUARD} from '../cards/tokens.ts';

function requireRule(ok: unknown, message: string): asserts ok { if (!ok) throw new RuleError(message); }
/** Only entered-from-hand and revived-from-discard cards receive the corresponding trigger. */
export function enterTrigger(game:Game,actor:PlayerId,card:Card,origin:'hand'|'discard',targetId?:number):void{
  const effect=origin==='hand'?card.onEntry:card.secondChance;
  if(!effect)return;
  if((game.operationsUsed=(game.operationsUsed??0)+1)>MAX_EFFECT_OPERATIONS)
    throw new EffectLimitError('Превышен бюджет Вступления/Второго шанса');
  if(effect.kind==='summon')summon(game,actor,effect.cards);
  else {
    requireRule(Number.isSafeInteger(effect.amount) && effect.amount>=0 && effect.amount<=4,'Неверное Вступление');
    // Legacy saved-match adapters: map old effect names to the same generic operation.
    if(effect.kind==='summonSkeleton')summon(game,actor,Array.from({length:effect.amount},()=>SKELETON));
    else if(effect.kind==='summonBonePair'){
      requireRule(effect.amount===2,'Костяная пара призывает двух скелетов');
      summon(game,actor,[BONE_BLADE,BONE_GUARD]);
    }
  else if(effect.kind==='stunEnemy'||effect.kind==='stasisEnemy') {
    // Targeted blue Entry only affects enemy creatures; an empty enemy field is legal.
    // Stun prevents attacks during the next controller turn; Stasis also suspends abilities.
    const enemy=game.players[(1-actor) as PlayerId];
    const candidates=[...enemy.main,...enemy.auxiliary].filter(u=>u.card.kind==='creature'&&!u.stasis &&
      (effect.kind==='stasisEnemy'||!u.stunned));
    if(candidates.length){
      requireRule(Number.isSafeInteger(targetId),'Выберите цель для синего контроля');
      const target=candidates.find(u=>u.objectId===targetId);
      requireRule(target,'Недоступная цель синего контроля');
      if(effect.kind==='stunEnemy')target.stunned=true;
      else target.stasis=effect.amount;
    }else requireRule(targetId===undefined,'Нет допустимой цели контроля');
  }
  else if(effect.kind==='healRuler')game.players[actor].hp=Math.min(30,game.players[actor].hp+effect.amount);
  else if(effect.kind==='draw')for(let i=0;i<effect.amount&&game.players[actor].deck.length;i++)
      game.players[actor].hand.push(game.players[actor].deck.shift()!);
  else throw new RuleError('Неизвестный эффект при входе');
  }
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
