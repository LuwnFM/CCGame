import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { apply, openingGame, RuleError, type Command, type Game, type PlayerId } from '../src/core.ts';
import { ARCHETYPES, testDeck } from '../src/decks.ts';
import { totalAttack } from '../src/mechanics/combat.ts';
import { openingHand } from '../src/setup.ts';

function step(g: Game, action: object, n: number): Game {
  return apply(g, {...action,expectedRevision:g.revision,key:`sim-${n}`} as Command);
}
function check(g: Game) {
  for (const p of g.players) {
    assert.ok(p.main.length<=8 && p.auxiliary.length<=4);
    assert.ok(p.legends.every(l=>l.card.kind==='legend' && l.loyalty!>0));
    assert.ok(p.auxiliary.every(c=>c.card.kind==='creature'||c.card.kind==='artifact'));
    const all=[...p.main,...p.auxiliary,...p.legends,...p.domains].map(c=>c.objectId);
    assert.equal(new Set(all).size,all.length);
    for (const v of Object.values(p.energy)) assert.ok(Number.isInteger(v)&&v>=0);
  }
  assert.equal(g.players.length,2);
}
// Use the same legal conditions as src/core.ts (no extra HP >8 bot-only rule).
function canBotUseRulerDraw(g:Game,actor:PlayerId):boolean {
  const p=g.players[actor];
  return g.phase==='main' && g.turn>0 && g.active===actor &&
    p.hp>2 && p.hand.length<=3 && p.deck.length>=2 &&
    p.lastRulerDrawTurn!==g.turn;
}
test('balance bot respects all Ruler-draw restrictions and can draw at 3 HP',()=>{
  const red=testDeck(ARCHETYPES[0].id);
  let g=openingGame(openingHand(red,1123),openingHand(red,1124));
  g=step(g,{type:'mulligan',actor:0,indices:[]},0);
  g=step(g,{type:'mulligan',actor:1,indices:[]},1);
  g.turn=1;g.active=0;g.phase='main';
  const p=g.players[0];p.hp=3;p.hand=red.slice(0,3);p.deck=red.slice(0,4);
  assert.equal(canBotUseRulerDraw(g,0),true);
  assert.equal(canBotUseRulerDraw(g,1),false,'inactive player cannot draw');
  const beforeRevision=g.revision;
  const drawn=step(g,{type:'rulerDraw',actor:0},2);
  assert.equal(drawn.revision,beforeRevision+1);
  assert.equal(drawn.players[0].hp,1);
  assert.equal(drawn.players[0].hand.length,5);
  assert.equal(drawn.players[0].deck.length,2);
  assert.equal(drawn.players[0].lastRulerDrawTurn,1);
  assert.equal(canBotUseRulerDraw(drawn,0),false,'one draw per own turn');
  assert.throws(()=>step(drawn,{type:'rulerDraw',actor:0},3),RuleError);
  for(const [label,mutate] of [
    ['HP=2',(game:Game)=>{game.players[0].hp=2}],
    ['hand=4',(game:Game)=>{game.players[0].hand=red.slice(0,4)}],
    ['deck=1',(game:Game)=>{game.players[0].deck=red.slice(0,1)}],
    ['already used',(game:Game)=>{game.players[0].lastRulerDrawTurn=game.turn}],
    ['intercept phase',(game:Game)=>{game.phase='intercept'}],
    ['not active',(game:Game)=>{game.active=1}],
    ['before first turn',(game:Game)=>{game.turn=0}],
  ] as const){
    const bad=structuredClone(g);mutate(bad);
    assert.equal(canBotUseRulerDraw(bad,0),false,label);
  }
});
function defend(g:Game,n:number):Game {
 const p=g.players[g.pendingAttack!.defender],a=[...g.players[g.active].main,...g.players[g.active].auxiliary].find(x=>x.objectId===g.pendingAttack!.attackerId)!;
 const candidates=[...p.main,...p.auxiliary].filter(x=>x.card.kind==='creature'&&!x.exhausted&&!x.stasis&&x.interceptions===0&&(!a.card.flying||x.card.flying)&&(g.pendingAttack!.target.kind!=='creature'||x.card.guard));
 candidates.sort((x,y)=>(x.card.attack!+x.card.health!)-(y.card.attack!+y.card.health!));
 const chosen=candidates.find(x=>x.card.health!-x.damage+x.shield>totalAttack(g.players[g.active],a)||totalAttack(p,x)>=a.card.health!-a.damage+a.shield||p.hp<=totalAttack(g.players[g.active],a));
 return step(g,{type:'intercept',actor:g.pendingAttack!.defender,interceptorId:chosen?.objectId??null},n);
}

/** Controlled A/B: keep the exact same decks, seeds and legal bot policy. */
function deckFor(id:Parameters<typeof testDeck>[0],scenario:'before'|'after'){
 const cards=structuredClone(testDeck(id));
 if(scenario==='before')for(const card of cards){
   if(!card.ritual?.rewardPool)continue;
   const old:Record<string,[number,number]>={
     'vt-echo':[4,4],'vt-mechanism':[5,3],'vt-guardian':[3,6],
     'vt-specter':[4,4],'vt-spark':[3,3]
   };
   for(const reward of card.ritual.rewardPool){
     const stats=old[reward.id];if(stats){reward.attack=stats[0];reward.health=stats[1]}
   }
 }
 return cards;
}

test('controlled before/after reward balance simulation at 40 HP (1728 seeded matches)',()=>{
 for(const scenario of ['before','after'] as const){
  let finished=0,cutoff=0,draws=0;const wins:Record<string,number>={},pairings:Record<string,{first:number;second:number;cutoff:number}>={};
  let count=0,rituals=0,rewards=0,ritualWins=0,ritualLosses=0,ritualDraws=0,postRitualTurns=0,legends=0,artifacts=0,combat=0, actions=0;
  const rulerDraws:Record<string,{first:number;second:number}> = Object.fromEntries(ARCHETYPES.map(a=>[a.id,{first:0,second:0}]));
  for (let i=0;i<ARCHETYPES.length;i++) for (let j=0;j<ARCHETYPES.length;j++) for (let repeat=0;repeat<24;repeat++) {
    let g=openingGame(openingHand(deckFor(ARCHETYPES[i].id,scenario),1001+i*29+j*11+repeat),
      openingHand(deckFor(ARCHETYPES[j].id,scenario),4001+j*37+i*13+repeat));
    // Experimental balance-only rule: both rulers start at 40 HP (production remains 30).
    g.players[0].hp=40;g.players[1].hp=40;
    let serial=0;const ritualOwners=new Map<PlayerId,number>();
    g=step(g,{type:'mulligan',actor:0,indices:[]},serial++);
    g=step(g,{type:'mulligan',actor:1,indices:[]},serial++);
    for(let round=0;round<160 && g.phase!=='finished' && g.phase!=='paused';round++) {
      const actor=g.active,p=g.players[actor],enemy=(1-actor) as PlayerId;
      if (g.phase==='ritual') {
        rituals++;
        const choice=g.readyRituals![0];
        g=step(g,{type:'chooseRitual',actor,effectId:choice.effect.id,objectIds:choice.eligibleIds.slice(0,choice.effect.threshold)},serial++);
      } else if (g.phase==='reward') {
        const offers=g.pendingReward!.pool.filter(c=>g.pendingReward!.offeredIds.includes(c.id));
        const reward=offers.sort((a,b)=>((b.attack??0)*1.3+(b.health??0)+Number(!!b.firstStrike)*3+Number(!!b.lifesteal)*3+Number(!!b.guard)*2)-((a.attack??0)*1.3+(a.health??0)+Number(!!a.firstStrike)*3+Number(!!a.lifesteal)*3+Number(!!a.guard)*2))[0];
        const zone=reward.createdToken?p.auxiliary:p.main;
        const replace=zone.length>=(reward.createdToken?4:8)?zone.find(c=>!c.card.majestic)?.objectId:undefined;
        g=step(g,{type:'chooseReward',actor,rewardId:reward.id,replaceId:replace},serial++);
        rewards++;ritualOwners.set(actor,g.turn);
      } else if (g.phase==='discard') {
        g=step(g,{type:'discard',actor,handIndex:0},serial++);
      } else if (g.phase==='intercept') {
        g=defend(g,serial++);
      } else {
        const land=p.domainsPlayed<1?p.hand.findIndex(c=>c.kind==='domain'):-1;
        if(land>=0)g=step(g,{type:'playDomain',actor,handIndex:land},serial++);
        for(const d of [...g.players[actor].domains]) if(!d.exhausted)g=step(g,{type:'tapDomain',actor,objectId:d.objectId},serial++);
        for(let attempt=0;attempt<8;attempt++) {
          if(g.phase!=='main')break;
          // Each archetype uses the Ruler ability when legally available.
          // Drawing before the next play lets the bot spend the fresh cards now,
          // rather than drawing just before ending its turn.
          if(canBotUseRulerDraw(g,actor)){
            const before=g.players[actor];
            const next=step(g,{type:'rulerDraw',actor},serial++);
            const after=next.players[actor];
            assert.equal(after.hp,before.hp-2);
            assert.equal(after.hand.length,before.hand.length+2);
            assert.equal(after.deck.length,before.deck.length-2);
            assert.equal(after.lastRulerDrawTurn,next.turn);
            assert.equal(canBotUseRulerDraw(next,actor),false);
            const archetype=ARCHETYPES[actor===0?i:j].id;
            rulerDraws[archetype][actor===0?'first':'second']++;
            g=next;
          }
          const hand=g.players[actor].hand;
          let played=false;
          // Purple actively pursues rituals and deploys Sacrifice creators before expendable bodies.
          const ordered=hand.map((card,index)=>({card,index})).sort((a,b)=>{
            const score=(card:typeof a.card)=>card.ritual?100:card.kind==='creature'&&card.sacrifice?80:card.kind==='creature'&&card.onEntry?.kind==='summon'?70:card.kind==='legend'?60:card.kind==='creature'?40:card.kind==='artifact'?30:card.kind==='technique'?20:0;
            return (actor===0?i:j)===4?score(b.card)-score(a.card):0;
          });
          for(const {index} of ordered) {
            const kind=hand[index].kind;
            const type=kind==='creature'?'playCreature':kind==='technique'?'playTechnique':kind==='legend'?'playLegend':kind==='artifact'?'playArtifact':null;
            if(!type)continue;
            try {
              const discardIndex=g.players[actor].discard.findIndex(c=>c.kind==='creature');
              const effect=hand[index].techniqueEffect?.kind;
              const entry=hand[index].onEntry?.kind;
              const targetedEntry=entry==='stunEnemy'||entry==='stasisEnemy';
              const targetSide=effect==='cleanse'?g.players[actor]:g.players[enemy];
              const target=effect==='cleanse'
                ? [...targetSide.main,...targetSide.auxiliary].find(x=>x.poison||x.stasis||x.stunned||x.silenced)
                : ['silence','bind'].includes(effect||'')
                  ? [...targetSide.main,...targetSide.auxiliary].find(x=>x.card.kind==='creature'&&!x.stasis&&!x.silenced)
                  : undefined;
              const entryTarget=targetedEntry?[...g.players[enemy].main,...g.players[enemy].auxiliary].find(x=>x.card.kind==='creature'&&!x.stasis&&(entry==='stasisEnemy'||!x.stunned)):undefined;
              if(['cleanse','silence','bind'].includes(effect||'')&&!target)continue;
              const next=step(g,{type,actor,handIndex:index,
                ...(effect==='reanimate'?{discardIndex}: {}),...(target||entryTarget?{targetId:(target||entryTarget)!.objectId}:{})},serial++);
              g=next;played=true;
              if(kind==='legend')legends++;if(kind==='artifact')artifacts++;
              break;
            } catch(error) { if(!(error instanceof RuleError))throw error; }
          }
          if(!played)break;
        }
        for(const l of [...g.players[actor].legends]) if(l.lastActivatedTurn!==g.turn) {
          try{const strong=l.card.loyaltyAbilities?.[1];const discardIndex=g.players[actor].discard.findIndex(c=>c.kind==='creature');const abilityIndex=l.loyalty!>=2&&strong&&(strong.kind!=='healRuler'||g.players[actor].hp<27)&&(strong.kind!=='recoverCreature'||discardIndex>=0)?1:0;g=step(g,{type:'activateLegend',actor,objectId:l.objectId,abilityIndex,discardIndex},serial++)}catch(error){if(!(error instanceof RuleError))throw error}
        }
        for(const creature of [...g.players[actor].main]) if(!creature.exhausted) {
          try {
            g=step(g,{type:'attack',actor,attackerId:creature.objectId,target:{kind:'player'}},serial++);
            g=defend(g,serial++);
            combat++;
            if(g.phase==='finished')break;
          } catch(error) {if(!(error instanceof RuleError))throw error}
        }
        if(g.phase==='main')g=step(g,{type:'endTurn',actor},serial++);
      }
      check(g);actions++;
    }
    assert.notEqual(g.phase,'paused');
    const pairing=ARCHETYPES[i].id+' vs '+ARCHETYPES[j].id;pairings[pairing]??={first:0,second:0,cutoff:0};
    if(g.phase==='finished'){finished++;for(const [owner,turn] of ritualOwners){if(g.winner==='draw')ritualDraws++;else if(g.winner===owner){ritualWins++;postRitualTurns+=g.turn-turn}else ritualLosses++}if(g.winner==='draw')draws++;else{const winner=ARCHETYPES[g.winner===0?i:j].id;wins[winner]=(wins[winner]||0)+1;pairings[pairing][g.winner===0?'first':'second']++}}else{cutoff++;pairings[pairing].cutoff++}
    count++;
  }
  console.log('SIMULATION_40HP_AB_REPORT '+JSON.stringify({scenario,matches:count,finished,cutoff,draws,rituals,rewards,ritualWins,ritualLosses,ritualDraws,meanTurnsToWinAfterReward:ritualWins?postRitualTurns/ritualWins:null,wins,pairings,rulerDraws}));
  for(const archetype of ARCHETYPES){
    const bySeat=rulerDraws[archetype.id];
    assert.ok(bySeat.first>0 && bySeat.second>0,
      `Ruler draw missing for ${archetype.id}: first=${bySeat.first}, second=${bySeat.second}`);
  }
  assert.equal(count,864);
  assert.ok(finished>0);
  assert.ok(combat>10 && legends>0 && artifacts>0 && actions>700,
    `coverage: combats=${combat} legends=${legends} artifacts=${artifacts} actions=${actions}`);
  console.log(`864 ${scenario} simulated matches: ${actions} operations, ${combat} combats, ${legends} legends, ${artifacts} artifacts, ${rituals} rituals; Ruler draws ${Object.values(rulerDraws).reduce((n,p)=>n+p.first+p.second,0)}`);
 }
});


