import { RuleError, type Card, type Game, type PlayerId } from '../core.ts';

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
