/** Real browser + HTTP + SQLite opponent matches; temporary accounts/database only. */
import {strict as assert} from 'node:assert';
import {mkdtemp,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createApp} from '../src/server.ts';
import {chooseBotCommand} from '../src/bots/opponent.ts';
const temp=await mkdtemp(join(tmpdir(),'firewell-release-'));
const artifacts=join(process.cwd(),'artifacts/browser');await mkdir(artifacts,{recursive:true});
const app=createApp({databasePath:join(temp,'game.sqlite'),accessPassword:'release-test-access-123'});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+app.server.address().port;
const errors=[],results=[];
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.FIREWELL_BROWSER_PATH?{executablePath:process.env.FIREWELL_BROWSER_PATH,args:['--no-sandbox']}: {})});
 for(const [index,deck] of ['red','blue','green','gold','violet','neutral'].entries()){
  const phone=index%2===1;
  const context=await browser.newContext({viewport:phone?{width:844,height:390}:{width:1920,height:1080},isMobile:phone,hasTouch:phone});
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  page.on('response',res=>{if(res.status()>=400)errors.push(res.status()+' '+res.url())});
  await page.goto(url);await page.locator('#login').fill('Release_'+deck);await page.locator('#password').fill('release-password-123');await page.locator('#accessPassword').fill('release-test-access-123');await page.locator('#register').click();await page.locator('#home').waitFor({state:'visible'});
  assert.equal(await page.locator('body').getAttribute('data-design'),phone?'arena':'atlas');
  if(index===0){
   await page.locator('#openBuilder').click();await page.locator('#catalog .card').first().click();await page.locator('#cardInspector').waitFor({state:'visible'});assert.ok((await page.locator('#inspectorStats').innerText()).length>5);await page.locator('#inspectorClose').click();await page.locator('#kindFilter').selectOption('creature');await page.locator('#costFilter').selectOption('2');await page.screenshot({path:join(artifacts,'release-deck-builder.png'),fullPage:true});await page.locator('#closeBuilder').click();
  }
  await page.locator('#deck').selectOption(deck);await page.locator('#playBot').click();await page.locator('#confirmMulligan').waitFor({state:'visible'});await page.locator('#confirmMulligan').click();await page.locator('#hand .card').first().waitFor({state:'visible'});
  const code=await page.evaluate(()=>localStorage.getItem('firewell_room'));
  const request=async(path,payload)=>page.evaluate(async({path,payload})=>{
   const r=await fetch(path,{method:payload?'POST':'GET',headers:{authorization:'Bearer '+localStorage.getItem('firewell_session'),'content-type':'application/json'},...(payload?{body:JSON.stringify(payload)}:{})});const body=await r.json();return {status:r.status,body};
  },{path,payload});
  await page.locator('#chatOpen').click();await page.locator('#matchChatDialog').waitFor({state:'visible'});await page.mouse.click(2,2);await page.locator('#matchChatDialog').waitFor({state:'hidden'});
  let moves=0,captured=false;
  while(moves<600){
   await request('/api/rooms/'+code);
   const actual=JSON.parse(app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code).game);
   if(actual.phase==='finished'){results.push({deck,phone,moves,turn:actual.turn,winner:actual.winner});break}
   assert.notEqual(actual.phase,'paused','unexpected pause '+actual.pauseReason);
   // Reuse the bounded opponent policy as a deterministic test player. Seat swap
   // is confined to choosing a command, never written back into the server game.
   const mirror=structuredClone(actual);mirror.players=[actual.players[1],actual.players[0]];mirror.active=1-actual.active;
   if(mirror.pendingAttack)mirror.pendingAttack.defender=1-mirror.pendingAttack.defender;
   if(mirror.mulliganReady)mirror.mulliganReady=[...mirror.mulliganReady].reverse();
   if(mirror.pendingReward)mirror.pendingReward.owner=1-mirror.pendingReward.owner;
   const command=chooseBotCommand(mirror,deck);assert.ok(command,'player decision missing '+actual.phase);
   command.actor=0;command.expectedRevision=actual.revision;command.key='browser-player-'+moves;
   const result=await request('/api/rooms/'+code+'/commands',command);
   assert.equal(result.status,200,JSON.stringify({deck,command,error:result.body}));moves++;
   if(!captured&&actual.turn>=8&&actual.players[0].main.length){
    await page.reload();await page.locator('#hand .card').first().waitFor({state:'visible'});
    const box=await page.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight}));
    assert.ok(box.scrollWidth<=box.width+1&&box.scrollHeight<=box.height+1,JSON.stringify(box));
    assert.equal(await page.locator('#domainDetails').getAttribute('open'),null);
    await page.screenshot({path:join(artifacts,'release-'+(phone?'hearth':'atlas')+'-'+deck+'.png')});captured=true;
   }
  }
  assert.ok(results.some(r=>r.deck===deck),'match did not finish '+deck);
  await page.reload();await page.waitForFunction(()=>document.querySelector('#turnLabel')?.textContent.includes('Матч окончен'));
  console.log('[BOT RELEASE]',JSON.stringify(results.at(-1)));await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile(join(artifacts,'release-bot-results.json'),JSON.stringify(results,null,2));
}finally{await browser?.close();await new Promise(resolve=>app.server.close(resolve));app.db.close();await rm(temp,{recursive:true,force:true})}
