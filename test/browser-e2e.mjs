import { strict as assert } from 'node:assert';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createApp } from '../src/server.ts';

const temp = await mkdtemp(join(tmpdir(), 'firewell-browser-'));
const app = createApp({ databasePath: join(temp, 'alpha.sqlite'), accessPassword: 'test-access-password-123' });
await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
const address = app.server.address();
assert(address && typeof address !== 'string');
const url = 'http://127.0.0.1:' + address.port;
const artifacts = join(process.cwd(), 'artifacts', 'browser');
await mkdir(artifacts, { recursive: true });
let browser;
const pages = [];
const errors = [];
async function register(page, name) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#login').fill(name);
  await page.locator('#password').fill('very-secure-test-password');
  await page.locator('#accessPassword').fill('test-access-password-123');
  await page.locator('#register').click();
  await page.locator('#home').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#profileName').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#profileName').innerText(), name);
  assert.match(await page.locator('#profileId').innerText(), /^[a-f0-9-]{36}$/);
  await page.waitForFunction(() => document.querySelector('#deck')?.options.length > 0);
}
try {
  browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1350, height: 900 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const a = await desktop.newPage(), b = await phone.newPage();
  pages.push(a,b);
  for (const page of [a,b]) page.on('pageerror', error => errors.push(error.message));

  await register(a, 'AlphaBrowser');
  await a.locator('#leaderboard').waitFor({state:'visible'});
  assert.equal(await a.locator('#leaderboard li').count(),1);
  await a.reload({waitUntil:'domcontentloaded'});
  await a.locator('#profileName').waitFor({state:'visible'});
  assert.equal(await a.locator('#profileName').innerText(),'AlphaBrowser');
  await a.waitForFunction(()=>document.querySelector('#deck')?.options.length>0);
  await a.locator('#languageToggle').click();
  await a.getByText('Open deck builder').waitFor({state:'visible'});
  await a.locator('#rulesOpen').click();
  await a.locator('#rulesContent').getByText(/Cera Van Troupe/).first().waitFor();
  await a.locator('#rulesContent').getByText(/exactly 70 cards/i).waitFor();
  await a.locator('#languageToggle').click();
  await a.locator('#rulesContent').getByText(/Цера Ван Троуп/).first().waitFor();
  await a.locator('#rulesClose').click();
  await a.locator('#chatText').fill('Привет из браузерного теста');
  await a.locator('#chatForm button').click();
  await a.locator('#feedbackTitle').fill('Тестовое обращение');
  await a.locator('#feedbackType').selectOption('problem');
  await a.locator('#feedbackText').fill('Проверка формы обратной связи в браузере');
  await a.locator('#feedbackForm button').click();
  await a.locator('#feedbackConfirm').getByText(/Обращение №\d+ сохранено/).waitFor();
  await a.locator('#chatCooldown').getByText(/Повторная отправка через/).waitFor();
  await a.locator('#openBuilder').click();
  await a.locator('#builder').waitFor({ state: 'visible' });
  assert.equal(await a.locator('#deckCount').innerText(), '70/70');
  await a.locator('#deckName').fill('Браузерная колода');
  await a.locator('#saveDeck').click();
  await a.locator('#home').waitFor({ state: 'visible' });
  await a.locator('#savedDecks').getByText('Браузерная колода').waitFor();
  await a.screenshot({ path: join(artifacts, 'alpha-lobby-desktop.png'), fullPage: true });

  await register(b, 'BetaMobile');
  assert.equal(await b.locator('#languageToggle').count(),1);
  const scrollInfo=await b.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(scrollInfo.body<=scrollInfo.viewport+5,JSON.stringify(scrollInfo));
  await b.locator('#presence').waitFor();
  await b.screenshot({ path: join(artifacts, 'alpha-lobby-mobile.png'), fullPage: true });

  await a.locator('summary').first().click();
  await a.locator('#createRoom').click();
  await a.locator('#match').waitFor({ state: 'visible' });
  await a.waitForFunction(() => /^Комната [A-F0-9]{8}$/.test(document.querySelector('#roomLabel')?.textContent ?? ''));
  const code = (await a.locator('#roomLabel').innerText()).match(/[A-F0-9]{8}/)[0];
  await b.locator('summary').first().click();
  await b.locator('#code').fill(code);
  await b.locator('#joinRoom').click();
  await b.locator('#mulligan').waitFor({ state: 'visible' });
  await a.locator('#mulligan').waitFor({ state: 'visible', timeout: 12000 });
  assert.equal(await a.locator('#mulliganHand .card').count(), 7);
  assert.equal(await b.locator('#mulliganHand .card').count(), 7);
  await a.locator('#confirmMulligan').click();
  await b.locator('#confirmMulligan').click();
  await a.locator('#mulligan').waitFor({ state: 'hidden', timeout: 12000 });
  await b.locator('#mulligan').waitFor({ state: 'hidden', timeout: 12000 });
  await a.locator('#hand .card').first().waitFor({ state: 'visible' });
  assert.equal(await a.locator('#hand .card').count(), 7);
  assert.equal(await b.locator('#hand .card').count(), 7);
  const visibility = await b.evaluate(async code => {
    const token = localStorage.getItem('firewell_session');
    const response = await fetch('/api/rooms/' + code, { headers: { authorization: 'Bearer ' + token } });
    const data = await response.json();
    return { own: Array.isArray(data.game.players[1].hand), enemyHidden: !('hand' in data.game.players[0]) };
  }, code);
  assert.deepEqual(visibility, { own: true, enemyHidden: true });
  await a.locator('#hand .card').filter({ hasText: /владение/i }).first().click();
  await a.locator('#myDomains button').first().waitFor({ state: 'visible' });
  await a.locator('#myDomains button').first().click();
  await a.waitForFunction(() => document.querySelector('#myInfo')?.textContent.includes('red:1'));
  await a.locator('#end').click();
  await b.waitForFunction(() => {
    const button = document.querySelector('#end');
    return button && !button.disabled && !document.querySelector('#match').classList.contains('hidden');
  }, null, { timeout: 12000 });
  await b.locator('#hand .card').filter({ hasText: /владение/i }).first().click();
  await b.locator('#myDomains button').first().waitFor({ state: 'visible' });
  // Inject a battle-ready server state to verify the entire client -> command -> server -> board path.
  // The same browser sessions and authenticated room are preserved.
  const row = app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code);
  const battle = JSON.parse(row.game);
  const attackCard = {id:'ui-attacker',name:'Атакующий теста',kind:'creature',attack:4,health:4};
  const guardCard = {id:'ui-guard',name:'Оглушённый страж теста',kind:'creature',attack:1,health:3,guard:true};
  battle.phase='main'; battle.active=0; battle.turn=7; battle.pendingAttack=null; battle.nextObjectId=503;
  battle.players[0].main=[{objectId:501,card:attackCard,exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:1}];
  battle.players[1].main=[{objectId:502,card:guardCard,exhausted:false,damage:0,shield:0,interceptions:0,enteredTurn:1,stunned:true}];
  battle.revision++;
  app.db.prepare('UPDATE rooms SET game=? WHERE code=?').run(JSON.stringify(battle),code);
  await a.waitForFunction(() => document.querySelector('#myBoard .card')?.textContent.includes('Атакующий теста'));
  await a.locator('#myBoard .card').first().click();
  await a.locator('#hero').click();
  await b.waitForFunction(() => !document.querySelector('#skip').disabled, null, {timeout:15000});
  await b.locator('#myBoard .card').first().click();
  await a.waitForFunction(() => document.querySelector('#myBoard .card')?.textContent.includes('4/3'), null, {timeout:15000});
  const finalRow = app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code);
  const afterCombat = JSON.parse(finalRow.game);
  assert.equal(afterCombat.phase,'main');
  assert.equal(afterCombat.players[0].main[0].damage,1);
  assert.equal(afterCombat.players[1].main.length,0);
  assert.equal(afterCombat.players[0].hp,30);
  assert.equal(afterCombat.players[1].hp,30);
  await b.screenshot({ path: join(artifacts, 'alpha-match-mobile.png'), fullPage: true });
  await a.screenshot({ path: join(artifacts, 'alpha-match-desktop.png'), fullPage: true });
  // Vercel-like static client on a separate origin: browser CORS and bearer auth.
  const staticSite=createServer(async (req,res)=>{
    const file=req.url==='/'?'index.html':['/app.js','/style.css','/i18n.js','/rules.js'].includes(req.url)?req.url.slice(1):null;
    if(!file){res.writeHead(404);res.end();return}
    res.writeHead(200,{'content-type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html'});
    res.end(await readFile(new URL('../web/'+file,import.meta.url)));
  });
  await new Promise(resolve=>staticSite.listen(0,'127.0.0.1',resolve));
  const externalOrigin='http://127.0.0.1:'+staticSite.address().port;
  let crossApp;
  try {
    crossApp=createApp({databasePath:join(temp,'cross.sqlite'),accessPassword:'test-access-password-123',clientOrigin:externalOrigin});
    await new Promise(resolve=>crossApp.server.listen(0,'127.0.0.1',resolve));
    const backend='http://127.0.0.1:'+crossApp.server.address().port;
    const crossPage=await browser.newPage();pages.push(crossPage);
    crossPage.on('pageerror',error=>errors.push(error.message));
    await crossPage.goto(externalOrigin);
    await crossPage.locator('#apiUrl').fill(backend);
    await crossPage.locator('#login').fill('CrossOriginTester');
    await crossPage.locator('#password').fill('cross-origin-password-123');
    await crossPage.locator('#accessPassword').fill('test-access-password-123');
    await crossPage.locator('#register').click();
    await crossPage.locator('#home').waitFor({state:'visible',timeout:15000});
    await crossPage.waitForFunction(()=>document.querySelector('#deck')?.options.length===6);
    await crossPage.screenshot({path:join(artifacts,'alpha-separate-client-origin.png'),fullPage:true});
  } finally {
    if(crossApp){await new Promise(resolve=>crossApp.server.close(resolve));crossApp.db.close()}
    await new Promise(resolve=>staticSite.close(resolve));
  }
  assert.deepEqual(errors, []);
  console.log('BROWSER PASS: two registrations, chat, feedback, custom 70-card deck, private hands, PvP room, mulligan, energy, 2 turns and client-triggered combat with stunned interception and separate-origin CORS');
} catch (error) {
  for (let index=0; index<pages.length;index++) {
    try { await pages[index].screenshot({ path: join(artifacts, 'failure-'+index+'.png'), fullPage: true, timeout: 5000 }); } catch {}
  }
  throw error;
} finally {
  if (browser) await browser.close();
  await new Promise(resolve => app.server.close(resolve));
  app.db.close();
  await rm(temp, { recursive: true, force: true });
}
