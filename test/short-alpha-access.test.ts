import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from '../src/server.ts';

test('short alpha code is opt-in only while personal passwords remain strict', async () => {
  const original=process.env.FIREWELL_ALLOW_SHORT_ALPHA_PASSWORD;
  try {
    delete process.env.FIREWELL_ALLOW_SHORT_ALPHA_PASSWORD;
    assert.throws(()=>createApp({databasePath:':memory:',accessPassword:'123'}),/10 символов/);
    process.env.FIREWELL_ALLOW_SHORT_ALPHA_PASSWORD='true';
    const app=createApp({databasePath:':memory:',accessPassword:'123'});
    try {
      await new Promise<void>(resolve=>app.server.listen(0,'127.0.0.1',resolve));
      const address=app.server.address();
      assert.ok(address&&typeof address!=='string');
      const url='http://127.0.0.1:'+address.port+'/api/register';
      const headers={'content-type':'application/json'};
      const weakProfile=await fetch(url,{method:'POST',headers,body:JSON.stringify({
        login:'AlphaShortTest',password:'123',accessPassword:'123'
      })});
      assert.equal(weakProfile.status,409);
      const proper=await fetch(url,{method:'POST',headers,body:JSON.stringify({
        login:'AlphaShortTest',password:'PrivatePass123',accessPassword:'123'
      })});
      assert.equal(proper.status,200);
      assert.equal((await proper.json()).account.login,'AlphaShortTest');
    } finally {
      app.server.closeAllConnections();
      await new Promise<void>(resolve=>app.server.close(()=>resolve()));
      app.db.close();
    }
  } finally {
    if(original===undefined)delete process.env.FIREWELL_ALLOW_SHORT_ALPHA_PASSWORD;
    else process.env.FIREWELL_ALLOW_SHORT_ALPHA_PASSWORD=original;
  }
});
