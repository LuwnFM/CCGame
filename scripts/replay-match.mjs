/** Read-only audit. Never writes to a server or player database. */
import {readFileSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {applyForMatch, timeoutCommand} from '../src/server.ts';
export function replayArchive(file) {
 const bytes=readFileSync(file), log=JSON.parse(gunzipSync(bytes));
 if(log.format!=='firewell-match-v1'||!Array.isArray(log.events))throw Error('Unsupported archive');
 const commands=new Map(Object.entries(log.finalState.processed).map(([key,value])=>[value.revision,{...JSON.parse(value.command),key}]));
 let game=structuredClone(log.startingState);const mismatches=[];const actions={};let timeouts=0;
 for(const event of log.events){
  if(game.revision!==event.revisionBefore)throw Error('Missing revision at event '+event.seq);
  const recorded=commands.get(event.revisionAfter);if(!recorded)throw Error('Missing command at event '+event.seq);
  const command={...recorded,expectedRevision:game.revision};const before=game;
  const input=structuredClone(game);
  if(event.source==='timeout'){input.seed=timeoutCommand(game).seed;timeouts++}
  game=applyForMatch(input,command);
  if(before.phase==='main'&&event.source==='timeout'&&game.phase!=='paused'){
   game.timeoutStreak??=[0,0];if(++game.timeoutStreak[before.active]>=3){game.winner=1-before.active;game.phase='finished'}
  }else if(command.type==='endTurn'&&game.phase!=='paused'){
   game.timeoutStreak??=[0,0];game.timeoutStreak[command.actor]=0;
  }
  const hash=createHash('sha256').update(JSON.stringify(game)).digest('hex');
  if(hash!==event.stateHash)mismatches.push(event.seq);
  actions[command.type]=(actions[command.type]||0)+1;
 }
 return {room:log.room,rulesVersion:game.rulesVersion,events:log.events.length,timeouts,actions,
  minutes:(log.finishedAt-log.startedAt)/60000,turns:game.turn,winner:game.winner,hp:game.players.map(p=>p.hp),
  mismatchedEvents:mismatches,finalStateMatches:JSON.stringify(game)===JSON.stringify(log.finalState),
  archiveSha256:createHash('sha256').update(bytes).digest('hex')};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const result=replayArchive(process.argv[2]);console.log(JSON.stringify(result,null,2));
 if(result.mismatchedEvents.length||!result.finalStateMatches)process.exitCode=1;
}
