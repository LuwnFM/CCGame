import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { firefox, webkit } from 'playwright';
import { createApp } from '../src/server.ts';
const tmp=await mkdtemp(join(tmpdir(),'firewell-crossbrowser-'));
const screenshots=join(process.cwd(),'artifacts','browser');
await mkdir(screenshots,{recursive:true});
const app=createApp({databasePath:join(tmp,'crossbrowser.sqlite'),accessPassword:'alpha-test-access-123'});
await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
const url='http://127.0.0.1:'+app.server.address().port;
try{
 for(const [name,driver,size] of [
  ['firefox',firefox,{width:1350,height:900}],
  ['webkit',webkit,{width:390,height:844}]
 ]){
  const browser=await driver.launch({headless:true});
  const context=await browser.newContext({viewport:size,hasTouch:name==='webkit'});
  const page=await context.newPage();
  const exceptions=[];
  page.on('pageerror',e=>exceptions.push(e.message));
  try{
   await page.goto(url,{waitUntil:'domcontentloaded'});
   await page.locator('#login').fill(name+'Player');
   await page.locator('#password').fill('Crossbrowser-pass1');
   await page.locator('#accessPassword').fill('alpha-test-access-123');
   await page.locator('#register').click();
   await page.locator('#home').waitFor({state:'visible',timeout:12000});
   await page.waitForFunction(()=>document.querySelector('#deck')?.options.length===6);
   const login=await page.locator('#profileName').innerText();
   assert.equal(login,name+'Player');
   await page.reload({waitUntil:'domcontentloaded'});
   await page.locator('#home').waitFor({state:'visible',timeout:12000});
   assert.equal(await page.locator('#profileName').innerText(),login);
   await page.locator('#languageToggle').click();
   await page.getByText('Find an opponent',{exact:true}).waitFor();
   await page.locator('#rulesOpen').click();
   await page.locator('#rulesContent').getByText(/Victory and starting Health/).first().waitFor();
   await page.locator('#rulesContent').getByText(/Untiring and Extra Attack/).first().waitFor();
   assert.equal(await page.locator('#rulesContent').getByText(/Coldrake Shaw and Cera Van Troupe/).count(),0);
   await page.locator('#rulesContent').getByText(/Color archetypes/).first().waitFor();
   await page.locator('#rulesClose').click();
   await page.locator('#languageToggle').click();
   await page.locator('#playBot').waitFor({state:'visible'});
   const dimensions=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}));
   assert.ok(dimensions.scroll<=dimensions.width+8,JSON.stringify({name,...dimensions}));
   assert.deepEqual(exceptions,[]);
   await page.screenshot({path:join(screenshots,'crossbrowser-'+name+'.png'),fullPage:true});
   console.log(name+' PASS: register, persistent session, RU/EN, public rules, responsive viewport');
  } finally{
   await browser.close();
  }
 }
}finally{
 await new Promise(resolve=>app.server.close(resolve));app.db.close();
 await rm(tmp,{recursive:true,force:true});
}
