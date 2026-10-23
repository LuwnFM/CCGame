/** Paired seeds / both seats, production bot, full creatures+tokens+Legend targeting. */
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {writeFileSync} from 'node:fs';
const root=resolve(process.argv[2]||'.'),repeats=Number(process.env.BALANCE_REPEATS||2);
const load=p=>import(pathToFileURL(resolve(root,p)).href);
const {apply,openingGame}=await load('src/core.ts');
const {testDeck,ARCHETYPES}=await load('src/decks.ts');
const {openingHand}=await load('src/setup.ts');
const {chooseBotCommand}=await load('src/bots/opponent.ts');
function botView(g,actor){if(actor===1)return g;const v=structuredClone(g);v.players.reverse();v.active=1-g.active;if(v.mulliganReady)v.mulliganReady.reverse();if(v.mulliganSeeds)v.mulliganSeeds.reverse();if(v.timeoutStreak)v.timeoutStreak.reverse();if(v.pendingAttack)v.pendingAttack.defender=1-v.pendingAttack.defender;if(v.pendingReward)v.pendingReward.owner=1-v.pendingReward.owner;if(typeof v.winner==='number')v.winner=1-v.winner;return v;}
const report={root,repeats,policy:'production bot in both seats; paired seeds; 180-turn / 3000-command cutoff',matches:[],summary:{}};
for(let i=0;i<6;i++)for(let j=i+1;j<6;j++)for(let seed=0;seed<repeats;seed++)for(const reverse of [false,true]){
 const names=reverse?[ARCHETYPES[j].id,ARCHETYPES[i].id]:[ARCHETYPES[i].id,ARCHETYPES[j].id];
 const seeds=reverse?[5100+j*37+seed,2100+i*37+seed]:[2100+i*37+seed,5100+j*37+seed];
 let g=openingGame(openingHand(testDeck(names[0]),seeds[0]),openingHand(testDeck(names[1]),seeds[1]));
 let n=0;const plays={},actions={};
 while(g.phase!=='finished'&&g.phase!=='paused'&&g.turn<180&&n<3000){
  const actor=g.phase==='mulligan'?g.mulliganReady[0]?1:0:g.phase==='intercept'?g.pendingAttack.defender:g.active;
  const cmd=chooseBotCommand(botView(g,actor),names[actor]);if(!cmd)throw Error('No bot move '+g.phase);
  const card=cmd.handIndex!==undefined?g.players[actor].hand[cmd.handIndex]:undefined;
  if(cmd.type.startsWith('play')&&card)plays[card.id]=(plays[card.id]||0)+1;
  actions[cmd.type]=(actions[cmd.type]||0)+1;
  g=apply(g,{...cmd,actor,key:'paired-'+n,expectedRevision:g.revision});n++;
 }
 const result={names,seeds,phase:g.phase,winner:typeof g.winner==='number'?names[g.winner]:g.winner,seat:g.winner,turns:g.turn,commands:n,plays,actions};report.matches.push(result);
 process.stdout.write(JSON.stringify({match:report.matches.length,names,winner:result.winner,turns:g.turn,phase:g.phase})+'\n');
}
for(const {id} of ARCHETYPES){const games=report.matches.filter(m=>m.names.includes(id));const wins=games.filter(m=>m.winner===id).length;report.summary[id]={games:games.length,wins,losses:games.filter(m=>m.winner&&m.winner!==id&&m.winner!=='draw').length,draws:games.filter(m=>m.winner==='draw').length,cutoffs:games.filter(m=>m.phase!=='finished').length,winFraction:wins/games.length};}
writeFileSync(process.argv[3]||'balance-results.json',JSON.stringify(report,null,2)+'\n');
