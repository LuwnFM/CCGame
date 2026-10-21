import { RuleError, type Card, type Game, type Permanent, type PlayerId } from '../core.ts';

/** Shared core zone operation. Card effects supply data, never executable card-specific functions.
 * Every produced token receives a fresh objectId; partial creation stops at the 8+4 limit.
 * Existing created tokens are erased, not discarded, by sendToDiscard().
 */
export function summon(game:Game,actor:PlayerId,cards:readonly Card[]):number {
  if(!Array.isArray(cards)||cards.length>4)throw new RuleError('Неверный пакет призыва');
  const owner=game.players[actor];
  for(const original of cards){
    if(!original||original.kind!=='creature'||!original.createdToken||
      !Number.isSafeInteger(original.attack)||original.attack!<0||
      !Number.isSafeInteger(original.health)||original.health!<=0||
      !original.id||!original.name)throw new RuleError('Недопустимое Существо для призыва');
  }
  let produced=0;
  for(const original of cards){
    if(owner.auxiliary.length>=4)break;
    const card=structuredClone(original);
    owner.auxiliary.push({objectId:game.nextObjectId++,card,damage:0,
      shield:card.shield??0,exhausted:true,interceptions:0,enteredTurn:game.turn,
      sacrifice:card.sacrifice,attacksMade:0});
    produced++;
  }
  return produced;
}

/** Every ordinary card transfer between serialized zones passes through this function.
 * A card has no objectId while outside the board. Token / Ritual reward departures erase.
 * Callers control whether a transfer is caused by death or is a non-death departure.
 */
export type CardZone='deck'|'hand'|'discard'|'erased';
export type BoardZone='domains'|'main'|'auxiliary'|'legends';
export function cardZone(owner:Game['players'][number],zone:CardZone):Card[]{return owner[zone];}
export function moveCard(owner:Game['players'][number],from:CardZone,to:CardZone,index:number):Card {
  const source=cardZone(owner,from);
  if(!Number.isSafeInteger(index)||index<0||index>=source.length)throw new RuleError('Карта недоступна для перемещения');
  const card=source[index];
  if(from==='erased')throw new RuleError('Стертые карты нельзя возвращать в игру');
  if(to==='discard'&&(card.createdToken||card.ritualReward))to='erased';
  source.splice(index,1);
  cardZone(owner,to).push(card);
  return card;
}
/** A detached played card is returned to its appropriate zone, with no death trigger. */
export function leaveCard(owner:Game['players'][number],card:Card,ritualReward=false):CardZone{
  const destination=ritualReward||card.ritualReward||card.createdToken?'erased':'discard';
  cardZone(owner,destination).push(card);
  return destination;
}
export function movePermanent(game:Game,actor:PlayerId,from:BoardZone,to:BoardZone,id:number):void{
  const owner=game.players[actor],source=owner[from],destination=owner[to];
  const index=source.findIndex(unit=>unit.objectId===id);
  if(index<0)throw new RuleError('Объект покинул исходную зону');
  const limit=to==='auxiliary'?4:to==='main'?8:to==='legends'?2:Infinity;
  if(destination.length>=limit)throw new RuleError('Нет места в целевой зоне');
  destination.push(source.splice(index,1)[0]);
}
/** Remove from a battlefield zone, either as death (caller queues Last Word) or departure. */
export function takePermanent(game:Game,actor:PlayerId,id:number,zones:readonly BoardZone[]=['main','auxiliary']):Permanent{
  const owner=game.players[actor];
  for(const z of zones){
    const index=owner[z].findIndex(unit=>unit.objectId===id);
    if(index>=0)return owner[z].splice(index,1)[0];
  }
  throw new RuleError('Объект покинул поле');
}
/** Shared placement for any physical card, independent of how it entered the board. */
export function placePermanent(game:Game,actor:PlayerId,zone:BoardZone,card:Card,extra:Partial<Permanent>={}):Permanent{
  const owner=game.players[actor];
  const limit=zone==='auxiliary'?4:zone==='main'?8:zone==='legends'?2:Infinity;
  if(owner[zone].length>=limit)throw new RuleError('Нет места для размещения');
  const permanent:Permanent={objectId:game.nextObjectId++,card,exhausted:true,damage:0,shield:card.shield??0,
    enteredTurn:game.turn,interceptions:0,attacksMade:0,sacrifice:card.sacrifice,...extra};
  owner[zone].push(permanent);
  return permanent;
}
/** Draw uses the same queue transfer as other movements. */
export function drawCards(owner:Game['players'][number],count:number):number{
  if(!Number.isSafeInteger(count)||count<0||count>100)throw new RuleError('Неверное количество добора');
  let drawn=0;
  while(drawn<count&&owner.deck.length){moveCard(owner,'deck','hand',0);drawn++;}
  return drawn;
}
