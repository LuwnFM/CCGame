import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { apply, openingGame, type Command, type Game, type PlayerId } from '../src/core.ts';
import { ARCHETYPES, testDeck } from '../src/decks.ts';
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
test('72 seeded matches exercise every ordered starter pairing and preserve field invariants',()=>{
  let count=0,rituals=0,legends=0,artifacts=0,combat=0, actions=0;
  for (let i=0;i<ARCHETYPES.length;i++) for (let j=0;j<ARCHETYPES.length;j++) for (let repeat=0;repeat<2;repeat++) {
    let g=openingGame(openingHand(testDeck(ARCHETYPES[i].id),1001+i*29+j*11+repeat),
      openingHand(testDeck(ARCHETYPES[j].id),4001+j*37+i*13+repeat));
    let serial=0;
    g=step(g,{type:'mulligan',actor:0,indices:[]},serial++);
    g=step(g,{type:'mulligan',actor:1,indices:[]},serial++);
    for(let round=0;round<38 && g.phase!=='finished' && g.phase!=='paused';round++) {
      const actor=g.active,p=g.players[actor],enemy=(1-actor) as PlayerId;
      if (g.phase==='ritual') {
        rituals++;
        const choice=g.readyRituals![0];
        g=step(g,{type:'chooseRitual',actor,effectId:choice.effect.id,objectIds:choice.eligibleIds.slice(0,choice.effect.threshold)},serial++);
      } else if (g.phase==='reward') {
        const reward=g.pendingReward!.pool.find(c=>c.id===g.pendingReward!.offeredIds[0])!;
        const zone=reward.createdToken?p.auxiliary:p.main;
        const replace=zone.length>=(reward.createdToken?4:8)?zone.find(c=>!c.card.majestic)?.objectId:undefined;
        g=step(g,{type:'chooseReward',actor,rewardId:reward.id,replaceId:replace},serial++);
      } else if (g.phase==='discard') {
        g=step(g,{type:'discard',actor,handIndex:0},serial++);
      } else if (g.phase==='intercept') {
        g=step(g,{type:'intercept',actor:g.pendingAttack!.defender,interceptorId:null},serial++);
      } else {
        const land=p.domainsPlayed<1?p.hand.findIndex(c=>c.kind==='domain'):-1;
        if(land>=0)g=step(g,{type:'playDomain',actor,handIndex:land},serial++);
        for(const d of [...g.players[actor].domains]) if(!d.exhausted)g=step(g,{type:'tapDomain',actor,objectId:d.objectId},serial++);
        for(let attempt=0;attempt<3;attempt++) {
          const hand=g.players[actor].hand;
          let played=false;
          for(let index=0;index<hand.length;index++) {
            const kind=hand[index].kind;
            const type=kind==='creature'?'playCreature':kind==='technique'?'playTechnique':kind==='legend'?'playLegend':kind==='artifact'?'playArtifact':null;
            if(!type)continue;
            try {
              const next=step(g,{type,actor,handIndex:index},serial++);
              g=next;played=true;
              if(kind==='legend')legends++;if(kind==='artifact')artifacts++;
              break;
            } catch { /* Try another card; failed command left g unchanged. */ }
          }
          if(!played)break;
        }
        for(const l of [...g.players[actor].legends]) if(l.lastActivatedTurn!==g.turn) {
          try{g=step(g,{type:'activateLegend',actor,objectId:l.objectId},serial++)}catch{}
        }
        for(const creature of [...g.players[actor].main]) if(!creature.exhausted) {
          try {
            g=step(g,{type:'attack',actor,attackerId:creature.objectId,target:{kind:'player'}},serial++);
            g=step(g,{type:'intercept',actor:enemy,interceptorId:null},serial++);
            combat++;
            if(g.phase==='finished')break;
          } catch {}
        }
        if(g.phase==='main')g=step(g,{type:'endTurn',actor},serial++);
      }
      check(g);actions++;
    }
    count++;
  }
  assert.equal(count,72);
  assert.ok(combat>10 && legends>0 && artifacts>0 && actions>700,
    `coverage: combats=${combat} legends=${legends} artifacts=${artifacts} actions=${actions}`);
  assert.ok(rituals>=0);
});
