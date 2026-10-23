/** A room is resumable only while the authoritative server state is active. */
export function isOngoingGame(game) {
 return !!game && !['finished','paused'].includes(game.phase) && game.winner===null;
}
export function lobbyMatchIsActive(lobby,code) {
 return !!code&&Array.isArray(lobby?.activeMatches)&&
   lobby.activeMatches.some(m=>m.mine===true&&m.code===code&&!['finished','paused'].includes(m.phase));
}
