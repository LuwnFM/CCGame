/** Keep game data intact across restarts. Only extend the timer budgets for
 * ongoing rooms once on boot. PostgreSQL uses FOR UPDATE to protect against
 * concurrent old/new instances during Render's replacement sequence.
 */
export const RESUME_CLOCK_MS={
 mulligan:90_000,main:120_000,intercept:15_000,
 discard:60_000,ritual:60_000,reward:60_000
};
export function restoreActiveMatchTimers(db:any,now=Date.now(),postgres=false):number{
 const sql='SELECT code,game,deadline,turn_deadline,intercept_started FROM rooms WHERE guest IS NOT NULL'+
   (postgres?' FOR UPDATE':'');
 let adjusted=0;
 db.exec('BEGIN IMMEDIATE');
 try{
  const rows=db.prepare(sql).all();
  const update=db.prepare('UPDATE rooms SET deadline=?,turn_deadline=?,intercept_started=? WHERE code=?');
  for(const row of rows){
   let game:any;
   try{game=JSON.parse(row.game)}catch{continue}
   if(game.winner!==null||game.phase==='finished'||game.phase==='paused')continue;
   const grant=RESUME_CLOCK_MS[game.phase as keyof typeof RESUME_CLOCK_MS];
   if(!grant)continue;
   const oldDeadline=Number(row.deadline)||0;
   const deadline=Math.max(oldDeadline,now+grant);
   const extension=oldDeadline>0?deadline-oldDeadline:0;
   const oldTurn=Number(row.turn_deadline)||0;
   const turnDeadline=game.turn>0
     ? Math.max(oldTurn>0?oldTurn+extension:0,now+(game.phase==='main'?120_000:grant))
     : 0;
   // A defender must not lose bank time while the process is unavailable.
   const started=game.phase==='intercept'?now:0;
   if(deadline===oldDeadline&&turnDeadline===oldTurn&&started===Number(row.intercept_started||0))continue;
   update.run(deadline,turnDeadline,started,row.code);
   adjusted++;
  }
  db.exec('COMMIT');
 }catch(error){db.exec('ROLLBACK');throw error}
 if(adjusted)console.info('Match restart recovery: restored clocks for',adjusted,'active rooms');
 return adjusted;
}
