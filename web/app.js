const $ = id => document.getElementById(id);
const sessionKey = 'firewell_session', serverKey = 'firewell_server', roomKey = 'firewell_room';
let token = localStorage.getItem(sessionKey) || '';
let apiBase = localStorage.getItem(serverKey) || '';
let room = localStorage.getItem(roomKey) || '';
let account = null, catalog = [], presets = [], savedDecks = [], deckIds = [], game = null;
let selected = null, selectedMulligan = new Set(), selectedVictims = new Set(), selectedRitual = null;
let selectedReward = null, selectedArtifactIndex = null, busy = false, loading = false;
function status(value) { $('status').textContent = value || ''; }
function show(id) { for (const pane of ['auth','home','builder','match']) $(pane).classList.toggle('hidden', pane !== id); }
function serverAddress() {
  const entered = $('apiUrl').value.trim().replace(/\/$/,'');
  if (!entered) {
    if (location.hostname.endsWith('.vercel.app')) throw Error('Укажи публичный HTTPS-адрес игрового сервера');
    return '';
  }
  const url = new URL(entered);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('Укажи только адрес сервера, без пути');
  if (location.protocol === 'https:' && url.protocol !== 'https:') throw Error('Для страницы HTTPS нужен HTTPS-адрес сервера');
  return url.origin;
}
async function api(path,data,method) {
  const response = await fetch(apiBase + path, {
    method: method || (data === undefined ? 'GET' : 'POST'),
    headers: {'content-type':'application/json',...(token ? {authorization:'Bearer '+token} : {})},
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw Error(result.error || 'Ошибка сервера');
  return result;
}
function button(label, click, disabled = false, className = '') {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label; element.disabled = disabled; element.className = className; element.onclick = click;
  return element;
}
function textElement(tag, value, className = '') {
  const element = document.createElement(tag); element.textContent = value; element.className = className; return element;
}
function initials(name) { return [...name.replace(/[^\p{L}\p{N}]/gu,'')].slice(0,2).join('').toUpperCase() || 'FW'; }
function cardButton(card, label, onClick, disabled = false, active = false) {
  const element = button('',onClick,disabled,'card '+(card.aspects?.[0] || 'neutral')+(active?' active':''));
  element.append(textElement('span',initials(card.name),'glyph'),textElement('b',card.name));
  element.append(textElement('small',label));
  const flags = [['unique','Уникальная'],['guard','Страж'],['flying','Полёт'],['firstStrike','Первый удар'],
    ['piercing','Пробивание'],['lifesteal','Похищение жизни'],['stealth','Скрытность'],['majestic','Величественный'],
    ['sacrifice','Жертва'],['haste','Мгновенная атака'],['zeal','Рвение']]
    .filter(([flag])=>card[flag]).map(([,name])=>name);
  if(card.ritual)flags.push('Ритуал '+card.ritual.threshold);
  if(card.poisonHit)flags.push('Отрава '+card.poisonHit.strength+'/'+card.poisonHit.ticks);
  if(card.shield)flags.push('Щит '+card.shield);
  if(card.abilities?.length)flags.push('⚠ Временно неактивно: '+card.abilities.join(', '));
  element.title=card.name+' · '+label+(flags.length?'\n'+flags.join(' · '):'');
  element.setAttribute('aria-label',card.name+' · '+label+(flags.length?' · '+flags.join(', '):''));
  if(card.abilities?.length)element.append(textElement('small','⚠ Способность пока не работает','inactive-ability'));
  return element;
}
function setAccount(value) {
  account = value;
  $('profileName').textContent = value.login;
  $('profileId').textContent = value.id;
  $('connection').textContent = 'В сети · '+value.login;
  show(room ? 'match' : 'home');
}
async function authenticate(register) {
  try {
    const origin=serverAddress(), login=$('login').value.trim(), password=$('password').value;
    const result=await fetch(origin+(register?'/api/register':'/api/login'),{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({login,password,...(register?{accessPassword:$('accessPassword').value}:{})}),
    });
    const data=await result.json();
    if (!result.ok) throw Error(data.error || 'Ошибка входа');
    apiBase=origin; token=data.token;
    localStorage.setItem(serverKey,apiBase);localStorage.setItem(sessionKey,token);
    $('password').value='';$('accessPassword').value='';
    setAccount(data.account);
    await loadData();await refresh();
    status('Профиль готов');
  } catch(error) { status(error.message); }
}
async function loadData() {
  const [cards, saved]=await Promise.all([api('/api/catalog'),api('/api/my-decks')]);
  catalog=cards.cards; presets=cards.presets; savedDecks=saved.decks;
  const options=[...presets.map(p=>({id:p.id,name:p.name})),...savedDecks.map(d=>({id:d.id,name:d.name+' · своя'}))];
  $('deck').replaceChildren(...options.map(o=>{const element=document.createElement('option');element.value=o.id;element.textContent=o.name;return element}));
  $('starter').replaceChildren(...presets.map(p=>{const element=document.createElement('option');element.value=p.id;element.textContent=p.name;return element}));
  $('savedDecks').replaceChildren(...savedDecks.map(d=>{
    const row=document.createElement('div');row.className='saved';
    row.append(textElement('span',d.name+' · '+d.count+' карт'));
    row.append(button('Удалить',async()=>{try{await api('/api/my-decks/'+d.id,undefined,'DELETE');await loadData();status('Колода удалена')}catch(e){status(e.message)}},false,'ghost'));
    return row;
  }));
}
function renderLobby(data) {
  $('presence').textContent='Онлайн: '+data.online+' · в поиске: '+data.searching;
  $('queueStatus').textContent=data.searchingSelf?'Поиск идёт. Подбираем другого игрока…':'';
  $('search').disabled=data.searchingSelf;
  $('cancelSearch').classList.toggle('hidden',!data.searchingSelf);
  const chat=$('chat'), pinned=chat.scrollTop+chat.clientHeight>=chat.scrollHeight-20;
  chat.replaceChildren(...data.chat.map(message=>{
    const line=document.createElement('div');line.className='message';
    line.append(textElement('strong',message.login+' '),textElement('small','ID '+message.accountId+' · '),
      textElement('span',message.body));
    line.title=message.accountId;return line;
  }));
  if (pinned) chat.scrollTop=chat.scrollHeight;
  if (data.room && !room) enterRoom(data.room);
}
async function refresh() {
  if (!token || loading) return;
  loading=true;
  try {
    if (room) {
      const data=await api('/api/rooms/'+room);
      game=data.game;show('match');renderGame(data.ready);
    } else if (!$('builder').classList.contains('hidden')) {
      // Editing is local until saved.
    } else {
      renderLobby(await api('/api/lobby'));show('home');
    }
  } catch(error) {
    if (error.message==='Войдите в профиль') { token='';localStorage.removeItem(sessionKey);show('auth');room='';localStorage.removeItem(roomKey); }
    else if (room && error.message==='Комната недоступна') { room='';game=null;localStorage.removeItem(roomKey);show('home');status('Матч недоступен. Вернулись в лобби.'); }
    else status(error.message);
  } finally { loading=false; }
}
function enterRoom(value) { room=value;localStorage.setItem(roomKey,room);game=null;show('match');refresh(); }
async function send(command) {
  if (busy || !game) return;
  busy=true;
  try {
    await api('/api/rooms/'+room+'/commands',{...command,expectedRevision:game.revision,key:crypto.randomUUID()});
    selected=null;selectedReward=null;selectedArtifactIndex=null;await refresh();status('Действие принято');
  } catch(error){status(error.message);await refresh()}
  finally{busy=false}
}
function cardLabel(p) {
  if (p.card.kind==='legend') return 'Лояльность '+p.loyalty;
  if (p.card.kind==='artifact') return 'Предмет · +'+(p.card.auraAttack??0)+' атаки';
  const stats=(p.card.attack??0)+'/'+Math.max(0,(p.card.health??0)-p.damage);
  return stats+(p.shield?' · Щит '+p.shield:'')+(p.exhausted?' · истощено':'');
}
function renderGame(ready) {
  $('roomLabel').textContent='Комната '+room;
  if (!ready || !game) {
    $('turnLabel').textContent='Ожидание соперника. Код комнаты: '+room;
    for(const id of ['mulligan','ritual','reward'])$(id).classList.add('hidden');
    document.querySelectorAll('.playarea').forEach(x=>x.classList.add('hidden'));
    return;
  }
  const seat=game.seat, me=game.players[seat], enemy=game.players[1-seat];
  const mine=game.active===seat&&game.phase==='main', defense=game.phase==='intercept'&&game.pendingAttack?.defender===seat;
  $('turnLabel').textContent=game.winner!==null?'Матч окончен: '+(game.winner==='draw'?'ничья':'победил игрок '+(game.winner+1))
    :'Ход '+game.turn+' · игрок '+(game.active+1);
  $('mulligan').classList.toggle('hidden',game.phase!=='mulligan');
  $('ritual').classList.toggle('hidden',game.phase!=='ritual'||seat!==game.active);
  $('reward').classList.toggle('hidden',game.phase!=='reward'||seat!==game.active);
  document.querySelectorAll('.playarea').forEach(x=>x.classList.toggle('hidden',['mulligan','ritual','reward'].includes(game.phase)));
  if(game.phase==='mulligan') {
    const done=game.mulliganReady[seat];$('mulliganHand').replaceChildren();
    if(!done)(me.hand||[]).forEach((c,i)=>$('mulliganHand').append(cardButton(c,c.kind,()=>{selectedMulligan.has(i)?selectedMulligan.delete(i):selectedMulligan.add(i);renderGame(ready)},false,selectedMulligan.has(i))));
    $('confirmMulligan').disabled=done;$('mulliganWait').textContent=done?'Ответ принят. Ожидание соперника.':'Отмечено на замену: '+selectedMulligan.size;
    return;
  }
  if(game.phase==='ritual') {
    const sources=game.readyRituals||[];
    if(!sources.some(r=>r.id===selectedRitual)){selectedRitual=sources[0]?.id;selectedVictims.clear()}
    const active=sources.find(r=>r.id===selectedRitual);
    $('ritualSources').replaceChildren(...sources.map(r=>button(r.color+' · Жертва '+r.threshold,()=>{selectedRitual=r.id;selectedVictims.clear();renderGame(ready)},false,r.id===selectedRitual?'secondary':'')));
    $('ritualVictims').replaceChildren(...[...me.main,...me.auxiliary].filter(p=>active?.eligibleIds.includes(p.objectId))
      .map(p=>cardButton(p.card,cardLabel(p),()=>{selectedVictims.has(p.objectId)?selectedVictims.delete(p.objectId):selectedVictims.add(p.objectId);renderGame(ready)},false,selectedVictims.has(p.objectId))));
    $('confirmRitual').disabled=selectedVictims.size!==active?.threshold;return;
  }
  if(game.phase==='reward') {
    const offers=game.pendingReward||[];
    $('rewardCards').replaceChildren(...offers.map(c=>cardButton(c,(c.attack??0)+'/'+(c.health??0),()=>{
      const zone=c.createdToken?me.auxiliary:me.main,limit=c.createdToken?4:8,choices=zone.filter(p=>!p.card.majestic);
      if(zone.length<limit||!choices.length)send({type:'chooseReward',rewardId:c.id});
      else{selectedReward=c.id;renderGame(ready)}
    },false,selectedReward===c.id)));
    const reward=offers.find(c=>c.id===selectedReward),zone=reward?.createdToken?me.auxiliary:me.main;
    $('rewardReplacements').replaceChildren(...(reward&&zone.length>=(reward.createdToken?4:8)
      ?zone.filter(p=>!p.card.majestic).map(p=>cardButton(p.card,'Заменить · '+cardLabel(p),()=>send({type:'chooseReward',rewardId:reward.id,replaceId:p.objectId}))):[]));
    return;
  }
  if(game.phase==='paused')status(game.pauseReason||'Матч приостановлен');
  $('myHp').textContent='· '+me.hp+' HP';$('enemyHp').textContent='· '+enemy.hp+' HP';
  $('myInfo').textContent='Колода '+me.deckCount+' · Рука '+me.handCount+' · Сброс '+me.discardCount+
    ' · Энергия '+(Object.entries(me.energy).filter(([,n])=>n).map(([c,n])=>c+':'+n).join(', ')||'0');
  $('enemyInfo').textContent='Колода '+enemy.deckCount+' · Рука '+enemy.handCount+' · Сброс '+enemy.discardCount;
  $('myLegends').replaceChildren(...me.legends.map(p=>cardButton(p.card,cardLabel(p)+' · '+(p.card.loyaltyAbility?.kind||''),
    ()=>send({type:'activateLegend',objectId:p.objectId}),!mine||p.lastActivatedTurn===game.turn)));
  $('enemyLegends').replaceChildren(...enemy.legends.map(p=>cardButton(p.card,cardLabel(p),
    ()=>send({type:'attack',attackerId:selected,target:{kind:'legend',objectId:p.objectId}}),!mine||selected===null)));
  for(const [id,zone] of [['myBoard',me.main],['myAux',me.auxiliary]]) {
    $(id).replaceChildren(...zone.map(p=>cardButton(p.card,cardLabel(p),()=>{
      if(defense)send({type:'intercept',interceptorId:p.objectId});
      else{selected=p.objectId;renderGame(ready)}
    },p.card.kind!=='creature'||!defense&&!mine||!!p.stasis||(!defense&&!!p.stunned)||p.exhausted,selected===p.objectId)));
  }
  for(const [id,zone] of [['enemyBoard',enemy.main],['enemyAux',enemy.auxiliary]])
    $(id).replaceChildren(...zone.map(p=>cardButton(p.card,cardLabel(p),
      ()=>send({type:'attack',attackerId:selected,target:{kind:'creature',objectId:p.objectId}}),
      !mine||selected===null||p.card.kind!=='creature'||!!p.card.stealth)));
  $('myDomains').replaceChildren(...me.domains.map(p=>button(p.card.name+(p.exhausted?' · истощено':' · готово'),
    ()=>send({type:'tapDomain',objectId:p.objectId}),!mine||p.exhausted,'secondary')));
  $('enemyDomains').textContent=enemy.domains.length+' Владений';
  $('hand').replaceChildren(...(me.hand||[]).map((c,i)=>cardButton(c,c.kind+(c.cost?' · '+(c.cost.generic+Object.values(c.cost.colored).reduce((a,b)=>a+b,0))+' энергии':''),
    ()=>{if(game.phase==='discard')send({type:'discard',handIndex:i});
      else if(c.kind==='legend'&&me.legends.some(p=>p.card.name===c.name))
        send({type:'playLegend',handIndex:i,keepExisting:confirm('Оставить уже находящуюся на поле Легенду?')});
      else if(c.kind==='artifact'&&me.auxiliary.some(p=>p.card.name===c.name))
        send({type:'playArtifact',handIndex:i,keepExisting:confirm('Оставить уже находящийся на поле предмет?')});
      else if((c.kind==='artifact'||c.kind==='creature'&&c.createdToken)&&me.auxiliary.length>=4){selectedArtifactIndex=i;renderGame(ready)}
      else send({type:c.kind==='domain'?'playDomain':c.kind==='technique'?'playTechnique':c.kind==='legend'?'playLegend':c.kind==='artifact'?'playArtifact':'playCreature',handIndex:i})},
    !(mine||game.phase==='discard'&&game.active===seat))));
  $('artifactReplacements').replaceChildren(...(selectedArtifactIndex===null?[]:me.auxiliary.filter(p=>!p.card.majestic)
    .map(p=>cardButton(p.card,'Вытеснить',()=>send({type:me.hand[selectedArtifactIndex]?.kind==='creature'?'playCreature':'playArtifact',handIndex:selectedArtifactIndex,replaceId:p.objectId})))));
  $('hero').disabled=!mine||selected===null;$('skip').disabled=!defense;$('end').disabled=!mine;
}
function renderBuilder() {
  $('deckCount').textContent=deckIds.length+'/70';
  const domains=deckIds.filter(id=>catalog.find(c=>c.id===id)?.kind==='domain').length;
  $('deckIssues').textContent=domains+' Владений · Легенды по 1 · другие карты до 3 копий. Проверка перед сохранением на сервере.';
  const counts=new Map();deckIds.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
  $('builtCards').replaceChildren(...[...counts].map(([id,n])=>entry(catalog.find(c=>c.id===id),n,()=>{deckIds.splice(deckIds.indexOf(id),1);renderBuilder()},'−')));
  const term=$('cardSearch').value.trim().toLocaleLowerCase('ru-RU'),aspect=$('aspectFilter').value;
  $('catalog').replaceChildren(...catalog.filter(c=>(!term||c.name.toLocaleLowerCase('ru-RU').includes(term))&&(!aspect||(c.aspects?.[0]||'neutral')===aspect))
    .map(c=>entry(c,counts.get(c.id)||0,()=>{const current=counts.get(c.id)||0,limit=c.kind==='domain'&&c.basic?70:c.unique||c.kind==='legend'?1:3;
      if(current>=limit||deckIds.length>=70){status('Достигнут предел копий или 70 карт');return}
      deckIds.push(c.id);renderBuilder()},'+')));
}
function entry(card,count,onClick,symbol) {
  const element=document.createElement('div');element.className='entry';
  element.append(textElement('span',initials(card.name),'mini-glyph'));
  const desc=document.createElement('div');desc.className='mini';
  desc.append(textElement('strong',card.name),textElement('small',card.kind+(card.cost?' · '+card.cost.generic+'+'+Object.values(card.cost.colored).reduce((a,b)=>a+b,0):'')));
  element.append(desc,textElement('span',String(count),'count'),button(symbol,onClick,false,'secondary'));
  return element;
}
$('register').onclick=()=>authenticate(true);
$('signIn').onclick=()=>authenticate(false);
$('logout').onclick=async()=>{try{await api('/api/logout',{})}catch{}token='';account=null;room='';localStorage.removeItem(sessionKey);localStorage.removeItem(roomKey);show('auth');status('Вы вышли')};
$('rename').onclick=async()=>{const login=prompt('Новый логин (3–20 букв, цифр или _)');if(login===null)return;try{setAccount((await api('/api/me/rename',{login})).account);status('Логин обновлён')}catch(e){status(e.message)}};
$('deleteProfile').onclick=async()=>{if(!confirm('Удалить профиль, колоды и доступ навсегда? Этот ID больше не восстановится.'))return;
  const password=prompt('Введи пароль профиля для удаления');if(password===null)return;
  try{await api('/api/me/delete',{password});token='';account=null;room='';localStorage.removeItem(sessionKey);localStorage.removeItem(roomKey);show('auth');status('Профиль удалён')}
  catch(e){status(e.message)} };
$('search').onclick=async()=>{try{const data=await api('/api/queue',{deckId:$('deck').value});if(data.room)enterRoom(data.room);else await refresh()}catch(e){status(e.message)}};
$('cancelSearch').onclick=async()=>{try{await api('/api/queue',undefined,'DELETE');await refresh()}catch(e){status(e.message)}};
$('createRoom').onclick=async()=>{try{enterRoom((await api('/api/rooms',{deckId:$('deck').value})).code)}catch(e){status(e.message)}};
$('joinRoom').onclick=async()=>{try{const code=$('code').value.trim().toUpperCase();await api('/api/rooms/'+code+'/join',{deckId:$('deck').value});enterRoom(code)}catch(e){status(e.message)}};
$('leaveMatch').onclick=async()=>{try{await api('/api/queue/leave',{})}catch{}room='';game=null;localStorage.removeItem(roomKey);show('home');await refresh()};
$('chatForm').onsubmit=async event=>{event.preventDefault();try{await api('/api/chat',{text:$('chatText').value});$('chatText').value='';await refresh()}catch(e){status(e.message)}};
$('feedbackForm').onsubmit=async event=>{event.preventDefault();try{await api('/api/feedback',{category:$('feedbackType').value,text:$('feedbackText').value});$('feedbackText').value='';status('Спасибо, сообщение сохранено на сервере')}catch(e){status(e.message)}};
$('openBuilder').onclick=()=>{deckIds=[...presets[0].cards];$('deckName').value='Моя колода';show('builder');renderBuilder()};
$('closeBuilder').onclick=()=>{show('home');refresh()};
$('loadStarter').onclick=()=>{deckIds=[...presets.find(p=>p.id===$('starter').value).cards];renderBuilder()};
$('saveDeck').onclick=async()=>{try{await api('/api/my-decks',{name:$('deckName').value,cards:deckIds});await loadData();show('home');status('Колода сохранена')}catch(e){status(e.message)}};
$('cardSearch').oninput=renderBuilder;$('aspectFilter').onchange=renderBuilder;
$('confirmMulligan').onclick=()=>send({type:'mulligan',indices:[...selectedMulligan].sort((a,b)=>a-b)});
$('confirmRitual').onclick=()=>send({type:'chooseRitual',effectId:selectedRitual,objectIds:[...selectedVictims]});
$('hero').onclick=()=>send({type:'attack',attackerId:selected,target:{kind:'player'}});
$('skip').onclick=()=>send({type:'intercept',interceptorId:null});
$('end').onclick=()=>send({type:'endTurn'});
function tick(){if(!game?.deadlineAt){$('timer').textContent='';return}const left=Math.max(0,Math.ceil((game.deadlineAt-Date.now())/1000));$('timer').textContent='⏱ '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')}
$('apiUrl').value=apiBase;
show('auth');
if(token)api('/api/me').then(async data=>{setAccount(data.account);await loadData();await refresh()}).catch(()=>{token='';localStorage.removeItem(sessionKey);show('auth')});
setInterval(refresh,2500);setInterval(tick,1000);
