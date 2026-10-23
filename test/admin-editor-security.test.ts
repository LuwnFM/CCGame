import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createApp } from '../src/server.ts';

test('editor resources are gated by server-side password, account and session',async()=>{
 const app=createApp({databasePath:':memory:',accessPassword:'test-alpha-password',editorPassword:'separate-editor-test-2026'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 const port=app.server.address().port;
 const base='http://127.0.0.1:'+port;
 const request=async(path,options={})=>fetch(base+path,options);
 try {
  for(const path of ['/layout-editor.html','/ui-preview.html','/layout-editor.css','/ui/layout-editor.js','/ui/layout-preview.js']) {
   const response=await request(path);
   assert.equal(response.status,403,path);
   assert.equal(response.headers.get('cache-control'),'no-store');
  }
  const open=await request('/');
  assert.equal(open.status,200);
  const registration=await request('/api/register',{method:'POST',headers:{'content-type':'application/json'},
   body:JSON.stringify({login:'EditorGateTester',password:'PlayerPassword2026',accessPassword:'test-alpha-password'})});
  assert.equal(registration.status,200);
  const player=await registration.json();
  const headers={'content-type':'application/json',authorization:'Bearer '+player.token};
  let response=await request('/api/admin/editor/unlock',{method:'POST',headers,body:JSON.stringify({password:'test-alpha-password'})});
  assert.equal(response.status,403);
  assert.equal((await request('/layout-editor.html')).status,403);
  response=await request('/api/admin/editor/unlock',{method:'POST',headers,body:JSON.stringify({password:'separate-editor-test-2026'})});
  assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  assert.match(response.headers.get('set-cookie'),/HttpOnly/);
  assert.match(response.headers.get('set-cookie'),/SameSite=Strict/);
  for(const path of ['/layout-editor.html','/ui-preview.html','/layout-editor.css','/ui/layout-editor.js','/ui/layout-preview.js']) {
   response=await request(path,{headers:{cookie}});
   assert.equal(response.status,200,path);
  }
  response=await request('/api/logout',{method:'POST',headers});
  assert.equal(response.status,200);
  assert.equal((await request('/layout-editor.html',{headers:{cookie}})).status,403);
 } finally {
  app.server.closeAllConnections();
  await new Promise(resolve=>app.server.close(resolve));
  app.db.close();
 }
});
