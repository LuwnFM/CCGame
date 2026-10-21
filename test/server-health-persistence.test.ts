import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../src/server.ts';

test('health reports API availability without login, while accounts survive SQLite reopen', async () => {
  const dir=await mkdtemp(join(tmpdir(),'fw-ccg-health-'));
  const databasePath=join(dir,'persistent.sqlite');
  const config={databasePath,accessPassword:'railway-alpha-test-123456',clientOrigin:'https://ccgame-omega.vercel.app'};
  const login='PersistenceAlpha';
  const password='passwordForTest12345';
  let token='';
  const serve=async () => {
    const app=createApp(config);
    await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const bound=app.server.address();
    if(!bound||typeof bound==='string')throw Error('No TCP port');
    return {app,url:'http://127.0.0.1:'+bound.port};
  };
  const stop=async (app:ReturnType<typeof createApp>)=>{
    app.server.closeAllConnections();
    await new Promise<void>(resolve=>app.server.close(()=>resolve()));
    app.db.close();
  };
  try {
    let {app,url}=await serve();
    try {
      const health=await fetch(url+'/api/health',{headers:{accept:'application/json'}});
      assert.equal(health.status,200);
      assert.equal(health.headers.get('cache-control'),'no-store');
      assert.deepEqual(await health.json(),{ok:true,service:'firewell-ccg'});
      const unauthorized=await fetch(url+'/api/me');
      assert.equal(unauthorized.status,401);
      const deniedOrigin=await fetch(url+'/api/health',{headers:{origin:'https://evil.example'}});
      assert.equal(deniedOrigin.status,403);
      const created=await fetch(url+'/api/register',{
        method:'POST',headers:{'content-type':'application/json'},
        body:JSON.stringify({login,password,accessPassword:config.accessPassword})
      });
      assert.equal(created.status,200);
      const profile=await created.json();
      assert.equal(profile.account.login,login);
      token=profile.token;
      assert.equal(typeof token,'string');
    } finally { await stop(app); }
    ({app,url}=await serve());
    try {
      const me=await fetch(url+'/api/me',{headers:{authorization:'Bearer '+token}});
      assert.equal(me.status,200);
      const profile=await me.json();
      assert.equal(profile.account.login,login);
      assert.match(profile.account.id,/^[0-9a-f-]{36}$/);
    } finally { await stop(app); }
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
});
