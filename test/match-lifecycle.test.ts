import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {isOngoingGame,lobbyMatchIsActive} from '../web/ui/match-lifecycle.js';

test('only unfinished and unpaused matches are active',()=>{
 for(const phase of ['mulligan','main','intercept','discard','ritual','reward'])
   assert.equal(isOngoingGame({phase,winner:null}),true,phase);
 for(const phase of ['finished','paused'])
   assert.equal(isOngoingGame({phase,winner:null}),false,phase);
 assert.equal(isOngoingGame({phase:'main',winner:0}),false);
 assert.equal(isOngoingGame(null),false);
});
test('only currently active owned server rooms permit a continuation message',()=>{
 const lobby={activeMatches:[{code:'ABCDEF12',mine:true,phase:'main'},
  {code:'12345678',mine:false,phase:'main'},
  {code:'87654321',mine:true,phase:'finished'}]};
 assert.equal(lobbyMatchIsActive(lobby,'ABCDEF12'),true);
 for(const id of ['12345678','87654321','00000000',''])
   assert.equal(lobbyMatchIsActive(lobby,id),false,id);
 assert.equal(lobbyMatchIsActive({activeMatches:[]},'ABCDEF12'),false);
 assert.equal(lobbyMatchIsActive({},'ABCDEF12'),false);
});
