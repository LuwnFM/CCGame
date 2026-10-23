import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { apply, initialGame, MAX_EFFECT_OPERATIONS, player, validateDeck, type Card, type Command, type Game, type Permanent } from '../src/core.ts';
import { testDeck, ARCHETYPES } from '../src/decks.ts';

const land: Card = { id: 'violet-land', name: 'Владение', kind: 'domain', produces: 'violet', basic: true };
const reward: Card[] = Array.from({ length: 5 }, (_, i) => ({ id: `reward-${i}`, name: `Награда ${i}`, kind: 'creature', aspects: ['violet'], attack: 4, health: 4 }));
const effect = { id: 'ritual-1', color: 'violet' as const, threshold: 3, rewardPool: reward as [Card, Card, Card, Card, Card], requiresSource: false, remainingStarts: 1 };
const victim = (id: number, onDeath?: Card['onDeath']): Permanent => ({ objectId: id, card: { id: `victim-${id}`, name: `Жертва ${id}`, kind: 'creature', aspects: ['violet'], attack: 1, health: 1, onDeath }, exhausted: false, damage: 0, shield: 1, interceptions: 0, enteredTurn: 0, sacrifice: true });
function step(g: Game, cmd: object, key: string): Game { return apply(g, { ...cmd, expectedRevision: g.revision, key } as Command); }
function ready(): Game {
  let g = step(initialGame(player([], [land]), player()), { type: 'startTurn', actor: 0 }, 'start');
  g.players[0].rituals.push(structuredClone(effect));
  g.players[0].main.push(victim(1, { kind: 'damageController', amount: 2 }), victim(2));
  g.players[0].auxiliary.push(victim(3));
  g = step(g, { type: 'endTurn', actor: 0 }, 'end0');
  return step(g, { type: 'endTurn', actor: 1 }, 'end1');
}

test('all six alpha decks are legal, with a playable violet Technique', () => {
  for (const archetype of ARCHETYPES) {
    const cards = testDeck(archetype.id);
    assert.equal(cards.length, 70);
    assert.deepEqual(validateDeck(cards), []);
    assert.equal(cards.filter(c => c.kind === 'domain').length, 26);
    assert.equal(cards.filter(c => c.kind === 'creature' && !c.guard && !c.flying && !c.firstStrike && !c.piercing && !c.lifesteal && !c.haste && !c.zeal && !c.extraAttacks && !c.stealth && !c.poisonHit && !c.shield && !c.sacrifice && !c.onDeath && !c.onEntry && !c.secondChance).length, archetype.id === 'red' ? 14 : archetype.id === 'neutral' ? 12 : 18);
    assert.equal(cards.filter(c => c.kind === 'legend').length, 2);
    assert.equal(cards.filter(c => c.kind === 'artifact' && c.unique).length, 1);
    assert.ok(cards.every(c => c.lore?.organization === archetype.organization));
    assert.ok(cards.every(c => c.lore?.summary && c.lore.summary.length > 15));
    const copies = new Map<string,number>();
    for (const card of cards) copies.set(card.id,(copies.get(card.id)??0)+1);
    assert.ok([...copies.values()].every(count => count <= 2), `${archetype.id}: starter contains three copies`);
  }
  assert.equal(testDeck('violet').filter(card => card.kind === 'technique' && card.ritual).length, 2);
  assert.ok(testDeck('violet').some(card => card.name === 'Колдрейк Шоу'));
  assert.ok(testDeck('violet').some(card => card.name === 'Драгнир и Иммельсторн'));
});
test('starter catalog covers the implemented card mechanics and two loyalty choices', () => {
  const decks=Object.fromEntries(ARCHETYPES.map(a=>[a.id,testDeck(a.id)]));
  const traits=['guard','flying','firstStrike','piercing','lifesteal','haste','stealth',
    'poisonHit','shield','sacrifice','extraAttacks','onDeath','onEntry','secondChance','ritual'] as const;
  for(const trait of traits)
    assert.ok(Object.values(decks).some(cards=>cards.some(card=>Boolean(card[trait]))),trait);
  for(const cards of Object.values(decks)){
    assert.ok(cards.some(card=>card.guard));
    for(const legend of cards.filter(card=>card.kind==='legend'))
      assert.deepEqual(legend.loyaltyAbilities?.map(choice=>Math.sign(choice.delta)),[1,-1]);
  }
  for(const kind of ['cleanse','silence','bind'])
    assert.ok(Object.values(decks).some(cards=>cards.some(card=>card.techniqueEffect?.kind===kind)),kind);
  assert.equal(testDeck('blue').filter(card=>card.name==='Небесный дуэлянт' && !card.flying && card.onEntry?.kind==='stunEnemy').length,2);
  assert.equal(testDeck('blue').filter(card=>card.name==='Палубный дуэлянт' && !card.flying && card.extraAttacks===1).length,2);
});
test('blue Ещё удар! (1) creature can attack twice in one turn',()=>{
  const card=testDeck('blue').find(card=>card.name==='Палубный дуэлянт')!;
  let g=step(initialGame(player(),player()),{type:'startTurn',actor:0},'blue-start');
  g.players[0].main.push({objectId:1,card,exhausted:false,damage:0,shield:0,enteredTurn:0,interceptions:0,attacksMade:0});
  for(let i=0;i<2;i++){
    g=step(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}},'blue-attack-'+i);
    g=step(g,{type:'intercept',actor:1,interceptorId:null},'blue-defend-'+i);
  }
  assert.equal(g.players[1].hp,32);
  assert.equal(g.players[0].main[0].exhausted,true);
  assert.throws(()=>step(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}},'blue-third'),/не готов/);
});
test('blue Flying attacker requires a Flying interceptor',()=>{
  const deck=testDeck('blue');
  const flyer=deck.find(card=>card.name==='Быстрый курьер')!;
  const guard=deck.find(card=>card.name==='Воздушный перехватчик')!;
  let g=step(initialGame(player(),player()),{type:'startTurn',actor:0},'fly-start');
  g.players[0].main.push({objectId:1,card:flyer,exhausted:false,damage:0,shield:0,enteredTurn:0,interceptions:0});
  g.players[1].main.push({objectId:2,card:{...guard,flying:false},exhausted:false,damage:0,shield:0,enteredTurn:0,interceptions:0});
  g=step(g,{type:'attack',actor:0,attackerId:1,target:{kind:'player'}},'fly-attack');
  assert.throws(()=>step(g,{type:'intercept',actor:1,interceptorId:2},'ground-block'),/Полёт/);
  g.players[1].main[0].card=guard;
  g=step(g,{type:'intercept',actor:1,interceptorId:2},'flying-block');
  assert.equal(g.players[1].hp,40);
  assert.equal(g.players[1].main[0].interceptions,1);
});
test('every starter Legend offers a gain and a paid choice, exclusive each turn',()=>{
  const fallen:Card={id:'fallen',name:'Павший страж',kind:'creature',attack:2,health:2};
  for(const archetype of ARCHETYPES)for(const legend of testDeck(archetype.id).filter(card=>card.kind==='legend')){
    const [small,strong]=legend.loyaltyAbilities!;
    assert.equal(small.delta,1,legend.name);
    assert.ok(strong.delta<=-2,legend.name);
    assert.ok((legend.loyalty??0)>=2,legend.name);
    assert.ok((small.kind==='summon' ? small.cards.length===1 : small.amount<=1) &&
      (strong.kind==='summon' ? strong.cards.length<=4 : strong.amount<=6),legend.name);
    for(const abilityIndex of [0,1]){
      let g=step(initialGame(player(),player()),{type:'startTurn',actor:0},legend.id+'-start-'+abilityIndex);
      g.players[0].hp=20;
      g.players[0].discard=[fallen];
      g.players[0].legends.push({objectId:1,card:legend,loyalty:legend.loyalty,
        exhausted:false,damage:0,shield:0,enteredTurn:g.turn,interceptions:0});
      g=step(g,{type:'activateLegend',actor:0,objectId:1,abilityIndex,discardIndex:0},legend.id+'-activate-'+abilityIndex);
      assert.equal(g.players[0].legends[0].loyalty,legend.loyalty!+legend.loyaltyAbilities![abilityIndex].delta,legend.name);
      assert.throws(()=>step(g,{type:'activateLegend',actor:0,objectId:1,abilityIndex:1-abilityIndex,discardIndex:0},legend.id+'-repeat-'+abilityIndex),/недоступна/);
    }
  }
});
test('First Strike prevents retaliation, and Poison pauses for Stasis then resumes', () => {
  let g = step(initialGame(player(),player()),{type:'startTurn',actor:0},'start');
  g.players[0].main.push({...victim(1),card:{...victim(1).card,attack:3,health:3,firstStrike:true},enteredTurn:0});
  g.players[1].main.push({...victim(2),card:{...victim(2).card,attack:5,health:2,poisonHit:{strength:2,ticks:2}},enteredTurn:0});
  g = step(g,{type:'attack',actor:0,attackerId:1,target:{kind:'creature',objectId:2}},'declare');
  g = step(g,{type:'intercept',actor:1,interceptorId:null},'answer');
  assert.equal(g.players[0].main[0].damage,0);
  assert.equal(g.players[1].main.length,0);
  const poisoned = {...victim(3),card:{...victim(3).card,health:3},shield:0,stasis:2,poison:{strength:1,ticks:2}};
  g.players[1].main.push(poisoned);
  g = step(g,{type:'endTurn',actor:0},'turn');
  assert.equal(g.players[1].main[0].damage,0);
  assert.equal(g.players[1].main[0].poison?.ticks,2);
  g = step(g,{type:'endTurn',actor:1},'stasis-1');
  g = step(g,{type:'endTurn',actor:0},'stasis-2');
  assert.equal(g.players[1].main[0].damage,0);
  assert.equal(g.players[1].main[0].poison?.ticks,2);
  g = step(g,{type:'endTurn',actor:1},'stasis-3');
  g = step(g,{type:'endTurn',actor:0},'stasis-4');
  assert.equal(g.players[1].main[0].damage,1);
  assert.equal(g.players[1].main[0].poison?.ticks,1);
});
test('ritual snapshots both zones, resolves a negative death effect before offering reward', () => {
  let g = ready();
  assert.equal(g.phase, 'ritual');
  assert.deepEqual(g.readyRituals?.[0].eligibleIds, [1, 2, 3]);
  assert.throws(() => step(g, { type: 'chooseRitual', actor: 0, effectId: effect.id, objectIds: [1, 1, 3] }, 'bad'), /разных/);
  const previous = g;
  g = step(g, { type: 'chooseRitual', actor: 0, effectId: effect.id, objectIds: [1, 2, 3] }, 'ritual');
  assert.equal(previous.players[0].hp, 40);
  assert.equal(g.players[0].hp, 38);
  assert.equal(g.players[0].main.length, 0);
  assert.equal(g.players[0].auxiliary.length, 0);
  assert.equal(g.players[0].discard.length, 3);
  assert.equal(g.phase, 'reward');
  assert.equal(g.pendingReward?.offeredIds.length, 3);
  g = step(g, { type: 'chooseReward', actor: 0, rewardId: g.pendingReward!.offeredIds[0] }, 'reward');
  assert.equal(g.players[0].main.length, 1);
  assert.equal(g.players[0].main[0].ritualReward, true);
  assert.equal(g.phase, 'main');
});
test('replacement dies with consequences; a filled all-Majestic field sends reroll to hand', () => {
  let g = ready();
  g = step(g, { type: 'chooseRitual', actor: 0, effectId: effect.id, objectIds: [1, 2, 3] }, 'r');
  for (let i = 0; i < 8; i++) g.players[0].main.push({ ...victim(20 + i), card: { ...victim(20 + i).card, majestic: i !== 0 }, sacrifice: false });
  const choice = g.pendingReward!.offeredIds[0];
  assert.throws(() => step(g, { type: 'chooseReward', actor: 0, rewardId: choice }, 'bad'), /заменяемое/);
  g.players[0].main[0].card.onDeath = { kind: 'damageController', amount: 3 };
  g = step(g, { type: 'chooseReward', actor: 0, rewardId: choice, replaceId: 20 }, 'replace');
  assert.equal(g.players[0].hp, 35);
  assert.equal(g.players[0].main.length, 8);
  assert.equal(g.players[0].erased.length, 0);
  const another = ready();
  let filled = step(another, { type: 'chooseRitual', actor: 0, effectId: effect.id, objectIds: [1, 2, 3] }, 'r');
  for (let i = 0; i < 8; i++) filled.players[0].main.push({ ...victim(40 + i), card: { ...victim(40 + i).card, majestic: true }, sacrifice: false });
  filled = step(filled, { type: 'chooseReward', actor: 0, rewardId: filled.pendingReward!.offeredIds[0] }, 'fallback');
  assert.equal(filled.players[0].hand.length, 2);
  assert.equal(filled.players[0].hand[1].ritualReward, true);
  assert.equal(filled.players[0].main.length, 8);
});
test('operation overflow pauses and rolls the entire lethal ritual back', () => {
  const g = ready();
  g.operationsUsed = MAX_EFFECT_OPERATIONS - 1;
  const paused = step(g, { type: 'chooseRitual', actor: 0, effectId: effect.id, objectIds: [1, 2, 3] }, 'overflow');
  assert.equal(paused.phase, 'paused');
  assert.equal(paused.winner, null);
  assert.equal(paused.players[0].main.length, 2);
  assert.equal(paused.players[0].auxiliary.length, 1);
  assert.equal(paused.players[0].hp, 40);
  assert.equal(paused.seed, g.seed);
  assert.equal(paused.pendingReward, undefined);
});
test('Legend enters its own zone, can activate immediately, and takes reduced damage after Shield', () => {
  const legend: Card = { id: 'l1', name: 'Легенда', kind: 'legend', unique: true, cost: { colored: {}, generic: 0 }, loyalty: 4,
    shield: 1, loyaltyAbility: { delta: 1, kind: 'healRuler', amount: 2 } };
  let g = step(initialGame(player([], [legend]), player()), { type: 'startTurn', actor: 0 }, 's');
  g.players[0].hp = 28;
  g = step(g, { type: 'playLegend', actor: 0, handIndex: 0 }, 'play');
  assert.equal(g.players[0].legends.length, 1);
  g = step(g, { type: 'activateLegend', actor: 0, objectId: 1 }, 'activate');
  assert.equal(g.players[0].hp, 30);
  assert.equal(g.players[0].legends[0].loyalty, 5);
  assert.throws(() => step(g, { type: 'activateLegend', actor: 0, objectId: 1 }, 'twice'), /недоступна/);
  g.players[1].main.push({ ...victim(2), card: { ...victim(2).card, attack: 6 }, enteredTurn: 0 });
  g = step(g, { type: 'endTurn', actor: 0 }, 'e0');
  g = step(g, { type: 'attack', actor: 1, attackerId: 2, target: { kind: 'legend', objectId: 1 } }, 'attack');
  g = step(g, { type: 'intercept', actor: 0, interceptorId: null }, 'skip');
  assert.equal(g.players[0].legends[0].loyalty, 3);
  assert.equal(g.players[0].legends[0].shield, 0);
});
test('unique auxiliary item boosts combat and can displace a token without death trigger', () => {
  const artifact: Card = { id: 'art', name: 'Знамя', kind: 'artifact', unique: true, cost: { colored: {}, generic: 0 }, auraAttack: 1 };
  let g = step(initialGame(player([], [artifact]), player()), { type: 'startTurn', actor: 0 }, 's');
  g.players[0].auxiliary.push({ ...victim(1, { kind: 'damageController', amount: 5 }), card: { ...victim(1).card, createdToken: true } });
  for (let i = 2; i <= 4; i++) g.players[0].auxiliary.push(victim(i));
  assert.throws(() => step(g, { type: 'playArtifact', actor: 0, handIndex: 0 }, 'blocked'), /Вытеснения/);
  g = step(g, { type: 'playArtifact', actor: 0, handIndex: 0, replaceId: 1 }, 'artifact');
  assert.equal(g.players[0].hp, 40);
  assert.equal(g.players[0].erased.length, 1);
  assert.equal(g.players[0].auxiliary.length, 4);
  g.players[0].main.push({ ...victim(5), card: { ...victim(5).card, attack: 2 }, enteredTurn: 0 });
  g = step(g, { type: 'attack', actor: 0, attackerId: 5, target: { kind: 'player' } }, 'a');
  g = step(g, { type: 'intercept', actor: 1, interceptorId: null }, 'i');
  assert.equal(g.players[1].hp, 37);
});
test('same-name Legends and unique items require an explicit survivor and discard without death',()=>{
  const legend:Card={id:'hero',name:'Герой',kind:'legend',unique:true,cost:{colored:{},generic:0},
    loyalty:3,loyaltyAbility:{delta:1,kind:'draw',amount:0}};
  const item:Card={id:'relic',name:'Реликвия',kind:'artifact',unique:true,cost:{colored:{},generic:0},auraAttack:1};
  let g=step(initialGame(player([], [legend,legend,item,item]),player()),{type:'startTurn',actor:0},'s');
  g=step(g,{type:'playLegend',actor:0,handIndex:0},'l0');
  assert.throws(()=>step(g,{type:'playLegend',actor:0,handIndex:0},'lbad'),/Выберите/);
  g=step(g,{type:'playLegend',actor:0,handIndex:0,keepExisting:true},'lkeep');
  assert.equal(g.players[0].legends.length,1);
  assert.equal(g.players[0].discard.length,1);
  g=step(g,{type:'playArtifact',actor:0,handIndex:0},'i0');
  assert.throws(()=>step(g,{type:'playArtifact',actor:0,handIndex:0},'ibad'),/Выберите/);
  const old=g.players[0].auxiliary[0].objectId;
  g=step(g,{type:'playArtifact',actor:0,handIndex:0,keepExisting:false},'ireplace');
  assert.equal(g.players[0].auxiliary.length,1);
  assert.notEqual(g.players[0].auxiliary[0].objectId,old);
  assert.equal(g.players[0].discard.length,2);
});


test('ritual reward token in hand uses auxiliary zone and legal displacement, never death', () => {
  const token: Card = { id: 'temporary-token', name: 'Награда-токен', kind: 'creature',
    aspects: ['violet'], attack: 2, health: 2, cost: { colored: {}, generic: 0 },
    ritualReward: true, createdToken: true };
  let g = step(initialGame(player([], [token]), player()), { type: 'startTurn', actor: 0 }, 'open-token');
  g.players[0].main = Array.from({length:8},(_,i)=>({...victim(100+i),sacrifice:false}));
  for (let i=0;i<4;i++) {
    const unit=victim(20+i, i===0 ? {kind:'damageController',amount:9}:undefined);
    unit.card.createdToken=true;
    g.players[0].auxiliary.push(unit);
  }
  assert.throws(() => step(g, {type:'playCreature',actor:0,handIndex:0},'no-slot'), /Вытеснения/);
  g=step(g,{type:'playCreature',actor:0,handIndex:0,replaceId:20},'create-token');
  assert.equal(g.players[0].main.length,8);
  assert.equal(g.players[0].auxiliary.length,4);
  assert.equal(g.players[0].auxiliary.some(unit=>unit.card.id===token.id),true);
  assert.equal(g.players[0].hp,40);
  assert.equal(g.players[0].erased.length,1);
  assert.equal(g.players[0].hand.length,0);
});

test('Stasis does not suppress Poison permanently after its own counter expires', () => {
  let g=step(initialGame(player(),player()),{type:'startTurn',actor:0},'start-s');
  const unit={...victim(9),card:{...victim(9).card,health:5},shield:0,stasis:1,
    poison:{strength:2,ticks:2}};
  g.players[1].main.push(unit);
  g=step(g,{type:'endTurn',actor:0},'a');
  assert.equal(g.players[1].main[0].damage,0);
  g=step(g,{type:'endTurn',actor:1},'b');
  g=step(g,{type:'endTurn',actor:0},'c');
  assert.equal(g.players[1].main[0].damage,2);
  assert.equal(g.players[1].main[0].poison?.ticks,1);
});

test('duplicate Unique ritual reward requires survivor choice, never fakes a death or reroll', () => {
  const initial=ready();
  const ritual=step(initial,{type:'chooseRitual',actor:0,effectId:effect.id,objectIds:[1,2,3]},'unique-ritual');
  const rewardId=ritual.pendingReward!.offeredIds[0];
  const target=ritual.pendingReward!.pool.find(card=>card.id===rewardId)!;
  target.unique=true;
  ritual.players[0].main.push({
    ...victim(100,{kind:'damageController',amount:9}),
    card:{...structuredClone(target),onDeath:{kind:'damageController',amount:9}},
    sacrifice:false,ritualReward:false
  });
  assert.throws(()=>step(ritual,{type:'chooseReward',actor:0,rewardId},'no-survivor'),/Уникальную/);
  const kept=step(ritual,{type:'chooseReward',actor:0,rewardId,keepExisting:true},'keep-old');
  assert.equal(kept.players[0].main.find(x=>x.card.id===rewardId)?.objectId,100);
  assert.equal(kept.players[0].erased.length,1);
  assert.equal(kept.players[0].hp,38);
  assert.equal(kept.phase,'main');
  const replaced=step(ritual,{type:'chooseReward',actor:0,rewardId,keepExisting:false},'use-new');
  assert.equal(replaced.players[0].main.filter(x=>x.card.id===rewardId).length,1);
  assert.notEqual(replaced.players[0].main.find(x=>x.card.id===rewardId)?.objectId,100);
  assert.equal(replaced.players[0].hp,38);
  assert.equal(replaced.players[0].discard.some(c=>c.id===rewardId),true);
  assert.equal(replaced.phase,'main');
});


test('Cera Van Troupe raises 2/2 auxiliary Sacrifice token and begins an eligible ritual immediately',()=>{
  const cera=testDeck('violet').find(c=>c.name==='Цера Ван Троуп')!;
  const ritual=testDeck('violet').find(c=>c.ritual)!.ritual!;
  let g=step(initialGame(player([], [cera]),player()),{type:'startTurn',actor:0},'cera-start');
  g.players[0].energy.violet=10;
  g=step(g,{type:'playLegend',actor:0,handIndex:0},'cera-enter');
  g.players[0].rituals.push({...ritual,id:'cera-active',requiresSource:false,remainingStarts:2});
  g.players[0].main.push(victim(101),victim(102));
  const before=g.players[0].legends[0].loyalty!;
  g=step(g,{type:'activateLegend',actor:0,objectId:1},'cera-raise');
  assert.equal(g.phase,'ritual');
  assert.equal(g.players[0].auxiliary.length,1);
  assert.equal(g.players[0].auxiliary[0].card.attack,2);
  assert.equal(g.players[0].auxiliary[0].card.health,2);
  assert.equal(g.players[0].auxiliary[0].card.createdToken,true);
  assert.equal(g.players[0].auxiliary[0].sacrifice,true);
  assert.equal(g.players[0].legends[0].loyalty,before-2);
  assert.equal(g.readyRituals?.length,1);
  assert.equal(g.readyRituals![0].eligibleIds.length,3);
  g.players[0].deck.push({id:'bonus-draw',name:'Добор Церы',kind:'domain',basic:true,produces:'violet'});
  g=step(g,{type:'chooseRitual',actor:0,effectId:'cera-active',objectIds:g.readyRituals![0].eligibleIds},'cera-ritual');
  assert.equal(g.phase,'reward');
  assert.ok(g.players[0].hand.some(x=>x.id==='bonus-draw'));
  assert.equal(g.pendingReward!.offeredIds.length,3);
  assert.equal(g.players[0].erased.filter(c=>c.id==='vt-cera-ritual-servant').length,1);
});
test('Coldrake Shaw returns a creature from discard to hand, never free-plays it',()=>{
  const lich=testDeck('violet').find(c=>c.name==='Колдрейк Шоу')!;
  let g=step(initialGame(player([], [lich]),player()),{type:'startTurn',actor:0},'lich-start');
  g.players[0].energy.violet=10;
  g=step(g,{type:'playLegend',actor:0,handIndex:0},'lich-enter');
  const creature={id:'lich-memory',name:'Реликтовое умертвие',kind:'creature',attack:1,health:2} as Card;
  g.players[0].discard.push(creature);
  assert.throws(()=>step(g,{type:'activateLegend',actor:0,objectId:1},'lich-bad'),/Выберите Существо/);
  g=step(g,{type:'activateLegend',actor:0,objectId:1,discardIndex:0},'lich-recur');
  assert.equal(g.players[0].hand.some(x=>x.id===creature.id),true);
  assert.equal(g.players[0].discard.length,0);
  assert.equal(g.players[0].main.length,0);
  assert.equal(g.players[0].legends[0].loyalty,2);
});


