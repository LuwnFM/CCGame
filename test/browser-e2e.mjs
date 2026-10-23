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
const report = [];
function checkpoint(name) {
  const message = '[E2E] ' + new Date().toISOString() + ' ' + name;
  report.push(message);
  console.log(message);
}
async function register(page, name) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.locator('#login').fill(name);
  await page.locator('#password').fill('very-secure-test-password1');
  await page.locator('#accessPassword').fill('test-access-password-123');
  await page.locator('#register').click();
  try { await page.locator('#home').waitFor({ state: 'visible', timeout: 15000 }); }
  catch(error){console.error('[E2E] auth diagnostics',await page.evaluate(()=>({status:document.querySelector('#status')?.textContent,connection:document.querySelector('#connection')?.textContent,auth:document.querySelector('#auth')?.className,home:document.querySelector('#home')?.className,script:[...document.scripts].map(x=>x.src)})));throw error;}
  await page.locator('#profileName').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#profileName').innerText(), name);
  assert.match(await page.locator('#profileId').innerText(), /^[a-f0-9-]{36}$/);
  await page.waitForFunction(() => document.querySelector('#deck')?.options.length > 0);
}
try {
  browser = await chromium.launch({ headless: true, ...(process.env.FIREWELL_BROWSER_PATH?{executablePath:process.env.FIREWELL_BROWSER_PATH,args:['--no-sandbox']}: {}) });
  const desktop = await browser.newContext({ viewport: { width: 1350, height: 900 } });
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const a = await desktop.newPage(), b = await phone.newPage();
  pages.push(a,b);
  for (const page of [a,b]) {
    page.setDefaultTimeout(12_000);
    page.setDefaultNavigationTimeout(15_000);
    page.on('pageerror', error => {
      errors.push(error.message);
      checkpoint('pageerror: '+error.message);
    });
  }
  checkpoint('start: browser contexts created');

  checkpoint("desktop registration");
  await register(a, 'AlphaBrowser');
  await a.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='online',null,{timeout:12000});
  // Availability indicator must describe the API, not authentication state.
  await a.route('**/api/health',route=>route.fulfill({
    status:503,contentType:'application/json',
    body:JSON.stringify({error:'test: backend unreachable'})
  }));
  await a.reload({waitUntil:'domcontentloaded'});
  await a.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='offline',null,{timeout:12000});
  await a.unroute('**/api/health');
  await a.reload({waitUntil:'domcontentloaded'});
  await a.waitForFunction(()=>document.querySelector('#connection')?.dataset.state==='online',null,{timeout:12000});
  await a.locator('#leaderboard').waitFor({state:'visible'});
  assert.equal(await a.locator('#leaderboard li').count(),1);
  const savedSession=await a.evaluate(()=>localStorage.getItem('firewell_session'));
  await a.route('**/api/me',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'temporary outage'})}));
  await a.reload({waitUntil:'domcontentloaded'});
  await a.locator('#status').getByText(/Не удалось восстановить соединение/).waitFor();
  assert.equal(await a.evaluate(()=>localStorage.getItem('firewell_session')),savedSession);
  await a.unroute('**/api/me');
  await a.reload({waitUntil:'domcontentloaded'});
  await a.locator('#profileName').waitFor({state:'visible'});
  assert.equal(await a.locator('#profileName').innerText(),'AlphaBrowser');
  await a.waitForFunction(()=>document.querySelector('#deck')?.options.length>0);
  await a.locator('#languageToggle').click();
  await a.getByText('Open deck builder').waitFor({state:'visible'});
  await a.locator('#rulesOpen').click();
  await a.locator('#rulesContent').getByText(/Legends and Loyalty/).first().waitFor();
  await a.locator('#rulesContent').getByText(/exactly 70 cards/i).waitFor();
  await a.locator('#languageToggle').click();
  await a.locator('#rulesContent').getByText(/Легенды и Лояльность/).first().waitFor();
  await a.locator('#rulesClose').click();
  await a.locator('#chatText').fill('Привет из браузерного теста');
  await a.locator('#chatForm button').click();
  await a.locator('#feedbackForm').locator('..').locator('summary').click();
  await a.locator('#feedbackTitle').fill('Тестовое обращение');
  await a.locator('#feedbackType').selectOption('problem');
  await a.locator('#feedbackText').fill('Проверка формы обратной связи в браузере');
  await a.locator('#feedbackForm button').click();
  await a.locator('#feedbackConfirm').getByText(/Обращение №\d+ сохранено/).waitFor();
  await a.locator('#chatCooldown').getByText(/Повторная отправка через/).waitFor();
  checkpoint("desktop lobby, chat, and feedback completed");
  await a.locator('#openBuilder').click();
  await a.locator('#builder').waitFor({ state: 'visible' });
  assert.equal(await a.locator('#deckCount').innerText(), '70/70');
  await a.locator('#deckName').fill('Браузерная колода');
  await a.locator('#saveDeck').click();
  await a.locator('#home').waitFor({ state: 'visible' });
  await a.locator('#savedDecks').getByText('Браузерная колода').waitFor();
  await a.screenshot({ path: join(artifacts, 'alpha-lobby-desktop.png'), fullPage: true });

  checkpoint("deck editor saved");
  await register(b, 'BetaMobile');
  assert.equal(await b.locator('#languageToggle').count(),1);
  const scrollInfo=await b.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(scrollInfo.body<=scrollInfo.viewport+5,JSON.stringify(scrollInfo));
  await b.locator('#presence').waitFor();
  // Phone controls are available in the lobby and in an active match.
  assert.equal(await b.locator('#fullscreenToggle').isVisible(),true);
  assert.equal(await b.locator('#orientationToggle').isVisible(),true);
  assert.equal(await b.locator('#adminEditorOpen').isVisible(),true);
  assert.equal(await b.locator('#match a[href="/layout-editor.html"]').count(),0);
  await b.evaluate(()=>{
    Object.defineProperty(document.documentElement,'requestFullscreen',{configurable:true,value:async()=>{window.__gameFullscreenRequested=true}});
    Object.defineProperty(screen.orientation,'lock',{configurable:true,value:async orientation=>{window.__gameOrientationRequested=orientation}});
  });
  await b.locator('#orientationToggle').click();
  await b.waitForFunction(()=>window.__gameOrientationRequested==='landscape');
  assert.equal(await b.evaluate(()=>window.__gameFullscreenRequested),true);
  await b.locator('#adminEditorOpen').click();
  await b.locator('#editorAuthDialog').waitFor({state:'visible'});
  await b.locator('#editorPassword').fill('incorrect-test-password');
  await b.locator('#editorAuthSubmit').click();
  await b.locator('#editorAuthError').getByText(/Неверный пароль|не настроен/).waitFor();
  await b.locator('#editorAuthCancel').click();
  await b.screenshot({ path: join(artifacts, 'alpha-lobby-mobile.png'), fullPage: true });

  await a.locator('summary:visible').first().click();
  checkpoint("both players registered");
  await a.locator('#friendOpen').click();
  await a.locator('#createRoom').click();
  await a.locator('#match').waitFor({ state: 'visible' });
  await a.waitForFunction(() => /^Комната [A-F0-9]{8}$/.test(document.querySelector('#roomLabel')?.textContent ?? ''));
  const code = (await a.locator('#roomLabel').innerText()).match(/[A-F0-9]{8}/)[0];
  await b.locator('summary:visible').first().click();
  await b.locator('#friendOpen').click();
  await b.locator('#code').fill(code);
  checkpoint("room created, invite sent");
  await b.locator('#joinRoom').click();
  checkpoint("guest joined; waiting for mulligan");
  await b.locator('#mulligan').waitFor({ state: 'visible' });
  assert.equal(await b.locator('#fullscreenToggle').isVisible(),true);
  assert.equal(await b.locator('#orientationToggle').isVisible(),true);
  await a.locator('#mulligan').waitFor({ state: 'visible', timeout: 12000 });
  assert.equal(await a.locator('#mulliganHand .card').count(), 7);
  assert.equal(await b.locator('#mulliganHand .card').count(), 7);
  checkpoint("both opening hands visible");
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
  checkpoint("mulligan completed; preparing energy");
  await a.locator('#myBasicDomains .card').first().waitFor({ state: 'visible' });
  await a.locator('#myBasicDomains .card').first().click();
  await a.waitForFunction(() => document.querySelector('#myInfo')?.textContent.includes('red:1'));
  checkpoint("first player energy and turn confirmed");
  await a.locator('#end').click();
  await b.waitForFunction(() => {
    const button = document.querySelector('#end');
    return button && !button.disabled && !document.querySelector('#match').classList.contains('hidden');
  }, null, { timeout: 12000 });
  await b.locator('#hand .card').filter({ hasText: /владение/i }).first().click();
  await b.waitForFunction(()=>!!document.querySelector('#matchStatus')?.textContent,{timeout:6000});
  const matchToastBounds=await b.evaluate(()=>{
    const notice=document.querySelector('#matchStatus').getBoundingClientRect();
    const actions=document.querySelector('#match>.playarea:last-child>.actions').getBoundingClientRect();
    return {
      overlaps:notice.left<actions.right&&notice.right>actions.left&&notice.top<actions.bottom&&notice.bottom>actions.top,
      inHandHeading:document.querySelector('#matchStatus').closest('h2')?.textContent.startsWith('Рука'),
      noticeRight:notice.right,actionsLeft:actions.left
    };
  });
  assert.equal(matchToastBounds.inHandHeading,true,JSON.stringify(matchToastBounds));
  assert.equal(matchToastBounds.overlaps,false,JSON.stringify(matchToastBounds));
  await b.waitForFunction(()=>document.querySelector('#matchStatus')?.textContent==='',null,{timeout:6500});
  await b.locator('#myBasicDomains .card').first().waitFor({ state: 'visible' });
  assert.match(await b.locator('#domainSummary').innerText(),/\d+ · готовы \d+/i);
  await b.locator('#myBasicDomains .inspect-card').first().click();
  await b.locator('#cardInspector').waitFor({state:'visible'});
  assert.match(await b.locator('#inspectorLore').innerText(),/энергией и укрытием/);
  await b.locator('#inspectorClose').click();
  await a.locator('#enemyBasicDomains .card').first().click();
  await a.locator('#cardInspector').waitFor({state:'visible'});
  await a.locator('#inspectorClose').click();
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
  checkpoint("opponent turn confirmed, battle injected");
  await a.locator('#hero').click();
  await b.waitForFunction(() => !document.querySelector('#skip').disabled, null, {timeout:15000});
  assert.equal(await b.locator('#attackAlert').isVisible(),true);
  assert.equal(await b.locator('#attackAlert #skip').isVisible(),true);
  assert.match(await b.locator('#attackDetails').innerText(),/Атакующий теста.*Владетел/);
  assert.equal(await b.locator('#enemyBoard .incoming-attacker').count(),1);
  await b.screenshot({path:join(artifacts,'alpha-incoming-attack-mobile.png'),fullPage:true});
  await b.locator('#myBoard .card').first().click();
  checkpoint("defense selected");
  assert.equal(await b.locator('#confirmDefense').isVisible(),true);
  await b.locator('#confirmDefense').click();
  await a.waitForFunction(() => document.querySelector('#myBoard .card')?.textContent.includes('4/3'), null, {timeout:15000});
  const finalRow = app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code);
  const afterCombat = JSON.parse(finalRow.game);
  assert.equal(afterCombat.phase,'main');
  assert.equal(afterCombat.players[0].main[0].damage,1);
  assert.equal(afterCombat.players[1].main.length,0);
  assert.equal(afterCombat.players[0].hp,40);
  assert.equal(afterCombat.players[1].hp,40);
  // Inspect an enemy card on mobile; unavailable actions must remain inspectable.
  checkpoint("battle resolved; inspecting enemy card");
  await b.locator('#enemyBoard .card-wrapper > .inspect-card').first().click();
  await b.locator('#cardInspector').waitFor({state:'visible'});
  await b.locator('#inspectorClose').click();
  // Targeted resurrection uses a card picker, then Ruler draw is a real API action.
  const resumed=JSON.parse(app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code).game);
  resumed.active=1;resumed.turn=8;resumed.revision++;
  resumed.players[1].hand=[{id:'ui-revive',name:'Возвращение теста',kind:'technique',cost:{colored:{},generic:0},techniqueEffect:{kind:'reanimate',amount:1}}];
  resumed.players[1].discard=[{id:'ui-reborn',name:'Возвращённый теста',kind:'creature',attack:2,health:3,secondChance:{kind:'summon',cards:[{id:'violet-skeleton-token',name:'Призванный скелет',kind:'creature',aspects:['violet'],attack:1,health:1,createdToken:true,sacrifice:true}]}}];
  app.db.prepare('UPDATE rooms SET game=?,deadline=?,turn_deadline=? WHERE code=?').run(JSON.stringify(resumed),Date.now()+120000,Date.now()+120000,code);
  await b.waitForFunction(()=>document.querySelector('#hand')?.textContent.includes('Возвращение теста'));
  checkpoint("resurrection battle injected");
  await b.locator('#hand .card').first().click();
  await b.locator('#choiceDialog').waitFor({state:'visible'});
  await b.locator('#choiceCards .card').first().click();
  await b.locator('#choiceConfirm').click();
  await b.waitForFunction(()=>document.querySelector('#myBoard')?.textContent.includes('Возвращённый теста'));
  assert.equal(await b.locator('#myAux .card').count(),1);
  checkpoint("resurrection and second chance resolved");
  await b.locator('#rulerDraw').click();
  await b.waitForFunction(()=>document.querySelector('#myHp')?.textContent.includes('38 HP'));
  assert.equal(await b.locator('#rulerDraw').isDisabled(),true);
  checkpoint("ruler draw resolved");
  const withLegend=JSON.parse(app.db.prepare('SELECT game FROM rooms WHERE code=?').get(code).game);
  withLegend.players[1].legends=[{objectId:503,card:{id:'ui-legend',name:'Легенда двух решений',kind:'legend',loyalty:3,
    loyaltyAbilities:[{delta:1,kind:'healRuler',amount:1},{delta:-2,kind:'damageOpponent',amount:2}]},
    loyalty:3,damage:0,shield:0,exhausted:false,interceptions:0,enteredTurn:8}];
  withLegend.nextObjectId=504;withLegend.revision++;
  app.db.prepare('UPDATE rooms SET game=? WHERE code=?').run(JSON.stringify(withLegend),code);
  await b.waitForFunction(()=>document.querySelector('#myLegends')?.textContent.includes('Легенда двух решений'));
  await b.locator('#myLegends .card').click();
  assert.equal(await b.locator('#legendActions button').count(),2);
  assert.match(await b.locator('#legendActions button').first().innerText(),/\+1/);
  assert.match(await b.locator('#legendActions button').last().innerText(),/−2|-2/);
  await b.locator('#legendActions button').first().click();
  await b.waitForFunction(()=>document.querySelector('#legendActions')?.textContent.includes('4 лояльности'));
  assert.equal(await b.locator('#legendActions button').last().isDisabled(),true);
  checkpoint("both Legend choices and once-per-turn lock confirmed on phone");
  await b.reload({waitUntil:'domcontentloaded'});
  await b.waitForFunction(()=>document.querySelector('#myBoard')?.textContent.includes('Возвращённый теста'));
  const matchWidth=await b.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(matchWidth.body<=matchWidth.viewport+5,JSON.stringify(matchWidth));
  await b.screenshot({ path: join(artifacts, 'alpha-match-mobile.png'), fullPage: true });
  await a.screenshot({ path: join(artifacts, 'alpha-match-desktop.png'), fullPage: true });
  await b.setViewportSize({width:320,height:700});
  const smallWidth=await b.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(smallWidth.body<=smallWidth.viewport+5,JSON.stringify(smallWidth));
  await b.screenshot({path:join(artifacts,'alpha-match-small-phone.png'),fullPage:true});
  // Vercel-like static client on a separate origin: browser CORS and bearer auth.
  checkpoint("mobile reload, responsive match, screenshots passed");
  const staticSite=createServer(async (req,res)=>{
    const file=req.url==='/'?'index.html':(['/app.js','/style.css','/i18n.js','/rules.js'].includes(req.url)||/^\/ui\/[a-z][a-z0-9-]*\.js$/.test(req.url))?req.url.slice(1):null;
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
    const crossPage=await browser.newPage();pages.push(crossPage);crossPage.setDefaultTimeout(12000);
    crossPage.on('pageerror',error=>errors.push(error.message));
    await crossPage.goto(externalOrigin);
    await crossPage.locator('#serverSettings summary').click();
    await crossPage.locator('#apiUrl').fill(backend);
    await crossPage.locator('#login').fill('CrossOriginTester');
    await crossPage.locator('#password').fill('cross-origin-password-123');
    await crossPage.locator('#accessPassword').fill('test-access-password-123');
    await crossPage.locator('#register').click();
    await crossPage.locator('#home').waitFor({state:'visible',timeout:15000});
    await crossPage.waitForFunction(()=>document.querySelector('#deck')?.options.length===6);
    await crossPage.screenshot({path:join(artifacts,'alpha-separate-client-origin.png'),fullPage:true});
  } finally {
    // Stop browsers polling these HTTP fixtures *before* awaiting server.close().
    // Otherwise idle keep-alive sockets can prevent the E2E from exiting.
    for(const crossPage of pages.slice(2))if(!crossPage.isClosed())await crossPage.close({runBeforeUnload:false}).catch(()=>{});
    if(crossApp){
      crossApp.server.closeAllConnections();
      await new Promise(resolve=>crossApp.server.close(resolve));
      crossApp.db.close();
    }
    staticSite.closeAllConnections();
    await new Promise(resolve=>staticSite.close(resolve));
  }
  checkpoint("cross-origin registration passed");
  assert.deepEqual(errors, []);
  console.log('BROWSER PASS: two registrations, chat, feedback, custom 70-card deck, private hands, PvP room, mulligan, energy, 2 turns and client-triggered combat with stunned interception and separate-origin CORS');
 } catch (error) {
  console.error('[E2E] FAILURE after:',report.at(-1));
  console.error('[E2E] Browser exceptions:',JSON.stringify(errors));
  const { writeFile } = await import('node:fs/promises');
  await writeFile(join(artifacts, 'test-progress.log'),report.join('\n')+'\n'+String(error.stack||error)+'\n');
  for (let index=0; index<pages.length;index++) {
    try { await pages[index].screenshot({ path: join(artifacts, 'failure-'+index+'.png'), fullPage: true, timeout: 5000 }); } catch {}
  }
  throw error;
} finally {
  if (browser) await browser.close();
  // Force-close hanging HTTP keepalive connections; fixtures must always terminate.
  app.server.closeAllConnections();
  await new Promise(resolve => app.server.close(resolve));
  app.db.close();
  await rm(temp, { recursive: true, force: true });
}



