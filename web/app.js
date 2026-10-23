import {requestAction} from './ui/action-dialogs.js';
import {createDeckBuilderUI} from './ui/deck-builder.js';
import {createMatchDialogs} from './ui/dialogs.js';
import {createBattlefieldUI} from './ui/battlefield.js';
import {createChatUI} from './ui/chat.js';
import {createApi} from './ui/api.js';
import {createCardUI} from './ui/cards.js';
import { locale, setLocale, cardName, archetypeName, translate, observeLocalization, localize } from './i18n.js';
import { renderPublicRules } from './rules.js';
import {formatCost,energyNames} from './ui/card-format.js';
import {applySavedLayout,layoutStorageKey} from './ui/layout-preferences.js';
applySavedLayout();
window.addEventListener('storage',event=>{if(event.key===layoutStorageKey)applySavedLayout()});
const $ = id => document.getElementById(id);
const sessionKey = 'firewell_session', serverKey = 'firewell_server', roomKey = 'firewell_room', minimizedKey='firewell_minimized_room';
// Public HTTPS installations use the current origin for their /api endpoints.
const hostedClient = location.protocol === 'https:' && !['localhost','127.0.0.1'].includes(location.hostname);
let token = localStorage.getItem(sessionKey) || '';
let apiBase = hostedClient ? '' : (localStorage.getItem(serverKey) || '');
let room = localStorage.getItem(roomKey) || '';
let minimizedRoom=localStorage.getItem(minimizedKey)||'';
let account = null, catalog = [], presets = [], savedDecks = [], deckIds = [], game = null;
let editingDeckId;
let selected = null, selectedMulligan = new Set(), selectedVictims = new Set(), selectedRitual = null;
let selectedReward = null, selectedRewardKeepExisting = undefined, selectedArtifactIndex = null, busy = false, loading = false;
let selectedLegendId = null, defenderChoice = null, attackAlertKey = null;
let autoDomainPayment=localStorage.getItem('firewell_auto_domain_payment')!=='false';
let chatAvailableAt=0,olderMessages=[],chatMore=true,spectating=null;
function status(value) { const message=translate(value||'');$('status').textContent=message;if(!$('auth').classList.contains('hidden'))$('authMessage').textContent=message; }
let healthProbeInFlight = false;
async function checkGameServer() {
  if (healthProbeInFlight) return;
  healthProbeInFlight = true;
  let online = false;
  try {
    // The HTML may load while the API/backend is offline.
    const response = await fetch(apiBase + '/api/health', {
      method:'GET', cache:'no-store', headers:{accept:'application/json'},
      signal:AbortSignal.timeout(6500)
    });
    if(response.ok && response.headers.get('content-type')?.includes('application/json')) {
      const data = await response.json();
      online = data?.ok === true && data?.service === 'firewell-ccg';
    }
  } catch {
    // Network failure or timeout: API is unreachable.
  } finally {
    const indicator = $('connection');
    indicator.dataset.state = online ? 'online' : 'offline';
    indicator.textContent = translate(online ? 'Сервер игры онлайн' : 'Сервер игры недоступен');
    healthProbeInFlight = false;
  }
}

let lastPage='auth';
function show(id) {
  document.body.dataset.screen=id;
  if(id!=='auth')$('authMessage').textContent='';
  if(id!=='rulesPage')lastPage=id;
  for(const pane of ['auth','home','builder','match','spectator','rulesPage'])$(pane).classList.toggle('hidden',pane!==id);
}
function serverAddress() {
  if (hostedClient) return ''; // Same-origin /api; Vercel may proxy it.
  const entered = $('apiUrl').value.trim().replace(/\/$/,'');
  if (!entered) return '';
  const url = new URL(entered);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
    throw Error('Укажи только адрес сервера, без пути');
  if (location.protocol === 'https:' && url.protocol !== 'https:') throw Error('Для страницы HTTPS нужен HTTPS-адрес сервера');
  return url.origin;
}
const api=createApi({getBase:()=>apiBase,getToken:()=>token});
function button(label, click, disabled = false, className = '') {
  const element = document.createElement('button');
  element.type = 'button'; element.textContent = label; element.disabled = disabled; element.className = className; element.onclick = click;
  return element;
}
function textElement(tag, value, className = '') {
  const element = document.createElement(tag); element.textContent = value; element.className = className; return element;
}
function initials(name) { return [...name.replace(/[^\p{L}\p{N}]/gu,'')].slice(0,2).join('').toUpperCase() || 'FW'; }
const {abilityText,effectText,chooseCards,playCreature,playTechnique,detailsText,traitDescriptions,showCardDetails,cardSummary,cardButton}=createCardUI({$,button,textElement,cardName,kindName,send,cardLabel,initials});
const renderBattlefield=createBattlefieldUI({$,button,textElement,cardButton,cardLabel,showCardDetails,send});
const renderMatchDialogs=createMatchDialogs({$,button,cardButton,kindName,cardLabel,send,chooseCards});
function setAccount(value) {
  account = value;
  $('profileName').textContent = value.login;
  $('profileId').textContent = value.id;
  // The header indicator reflects API health independent of authentication.
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
  const previousDeck=$('deck').value;
  const options=[...presets.map(p=>({id:p.id,name:archetypeName(p)})),...savedDecks.map(d=>({id:d.id,name:d.name+' · своя'}))];
  $('deck').replaceChildren(...options.map(o=>{const element=document.createElement('option');element.value=o.id;element.textContent=o.name;return element}));
  if(options.some(o=>o.id===previousDeck))$('deck').value=previousDeck;
  renderSelectedDeck();
  $('starter').replaceChildren(...presets.map(p=>{const element=document.createElement('option');element.value=p.id;element.textContent=archetypeName(p);return element}));
  $('savedDecks').replaceChildren(...savedDecks.map(d=>{
    const row=document.createElement('div');row.className='saved';
    row.append(textElement('span',d.name+' · '+d.count+' карт'));
    row.append(button('Редактировать',()=>editDeck(d),false,'secondary'));
    row.append(button('Удалить',async()=>{try{await api('/api/my-decks/'+d.id,undefined,'DELETE');await loadData();status('Колода удалена')}catch(e){status(e.message)}},false,'ghost'));
    return row;
  }));
}
function renderSelectedDeck(){
 const deck=[...presets,...savedDecks].find(d=>d.id===$('deck').value);if(!deck)return;
 $('selectedDeckTitle').textContent=deck.name||archetypeName(deck);
 const cards=(deck.cards||[]).map(id=>catalog.find(c=>c.id===id)).filter(Boolean);
 $('deckPreviewInfo').textContent=cards.length+' карт · '+cards.filter(c=>c.kind==='domain').length+' Владений';
 const preview=[...cards.filter(c=>c.kind==='legend').slice(0,1),...[...new Map(cards.filter(c=>c.kind==='creature').map(c=>[c.id,c])).values()].slice(0,2)];
 $('deckPreviewCards').replaceChildren(...preview.map(c=>cardButton(c,kindName(c.kind),()=>showCardDetails(c))));
}
$('deck').onchange=renderSelectedDeck;
$('editSelectedDeck').onclick=()=>$('openBuilder').click();
for(const [open,dialog,close] of [['profileOpen','profileDialog','profileClose'],['friendOpen','friendDialog','friendClose']]){
 $(open).onclick=()=>$(dialog).showModal();$(close).onclick=()=>$(dialog).close();
 $(dialog).onclick=e=>{const d=$(dialog),r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close()};
}
$('profileLanguage').onclick=()=>$('languageToggle').click();
function renderLeaderboard(board){
  if(!board)return;
  const root=$('leaderboard');
  root.replaceChildren(...(board.entries.length?board.entries.map(player=>{
    const item=document.createElement('li');item.className='leaderboard-entry';
    const identity=document.createElement('div');
    identity.append(textElement('strong',player.login,'user-value'),
      textElement('small','ID: '+player.id,'user-value'));
    item.append(identity,textElement('b',player.wins+' '+translate('побед')));
    return item;
  }):[textElement('li',translate('Пока нет завершённых матчей'))]));
  $('leaderboardUpdated').textContent=translate('Данные на: ')+
    new Date(board.updatedAt).toLocaleString(locale()==='en'?'en-US':'ru-RU');
}
function renderLobby(data) {
  renderLeaderboard(data.leaderboard);
  $('presence').textContent='Онлайн: '+data.online+' · в поиске: '+data.searching+' · в матчах: '+(data.inMatches??0);
  $('activeMatches').replaceChildren(...(data.activeMatches?.length?data.activeMatches.map(m=>{
    const row=document.createElement('div');row.className='spectator-entry';
    row.append(textElement('span',m.players.join(' против ')+' · ход '+m.turn),
      m.mine?button('Продолжить',()=>enterRoom(m.code),false,'secondary'):button('Смотреть',()=>openSpectator(m.code),false,'secondary'));
    return row;
  }):[textElement('p','Сейчас нет активных матчей','hint')]));
  renderSharedChat(data);
  $('queueStatus').textContent=data.searchingSelf?'Поиск идёт. Подбираем другого игрока…':'';
  $('search').disabled=data.searchingSelf;
  $('cancelSearch').classList.toggle('hidden',!data.searchingSelf);
  if(data.room && !room && data.room!==minimizedRoom)enterRoom(data.room);
}
async function refresh() {
  if (!token || loading || !$('rulesPage').classList.contains('hidden')) return;
  loading=true;
  try {
    if (spectating) {
      const snapshot=await api('/api/spectate/'+spectating);
      renderSpectator(snapshot);
      const lobby=await api('/api/lobby');renderSharedChat(lobby);
    } else if (room) {
      const data=await api('/api/rooms/'+room);
      game=data.game;show('match');renderGame(data.ready);if(data.bot)$('roomLabel').textContent='Тестовый матч против бота · '+room;
      renderSharedChat(await api('/api/lobby'));
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
function openSpectator(code){spectating=code;room='';game=null;localStorage.removeItem(roomKey);show('spectator');refresh()}
function renderSpectator(g){
 show('spectator');$('spectatorHeading').textContent='Матч '+g.code+' · ход '+g.turn+' · '+g.phase;
 for(const i of [0,1]){
 const root=$('spectatorPlayer'+i);root.replaceChildren(textElement('h3','Игрок '+(i+1)+' · '+g.players[i].hp+' HP · рука '+g.players[i].handCount));
 for(const [zone,title] of [['legends','Легенды'],['main','Основное поле'],['auxiliary','Вспомогательное поле'],['domains','Владения']]){
  const section=document.createElement('section');section.className='spectator-zone';section.append(textElement('h4',title));
  const row=document.createElement('div');row.className='spectator-cards';
  row.append(...g.players[i][zone].map(p=>cardButton(p.card,(p.exhausted?'Истощено · ':'')+(zone==='domains'?'Владение':cardLabel(p)),()=>showCardDetails(p.card,p),false,false,p)));
  if(!row.children.length)row.append(textElement('p','Пока пусто','hint'));section.append(row);root.append(section);
 }
 }
}
function enterRoom(value) {$('friendDialog').close();spectating=null;room=value;minimizedRoom='';localStorage.removeItem(minimizedKey);localStorage.setItem(roomKey,room);game=null;show('match');refresh(); }
async function send(command) {
  if (busy || !game) return;
  if(['playCreature','playTechnique','playLegend','playArtifact'].includes(command.type)&&command.domainIds===undefined&&!autoDomainPayment){
    const me=game.players[game.seat],card=me.hand?.[command.handIndex];
    if(card?.cost){openDomainPayment(card,me,ids=>send({...command,domainIds:ids}));return;}
  }
  busy=true;
  try {
    const payload={...command,expectedRevision:game.revision,key:crypto.randomUUID()};
    try {
      await api('/api/rooms/'+room+'/commands',payload);
    } catch (error) {
      // The other player's mulligan advances the shared revision. The local
      // selected cards have not changed, so exactly one safe retry is possible.
      if(command.type!=='mulligan'||error.message!=='Устаревшая ревизия')throw error;
      const latest=(await api('/api/rooms/'+room)).game;
      if(latest?.phase==='mulligan'&&!latest.mulliganReady?.[latest.seat]) {
        await api('/api/rooms/'+room+'/commands',{...payload,expectedRevision:latest.revision});
      } else if(!(latest?.mulliganReady?.[latest.seat]||latest?.phase==='main'))throw error;
    }
    selected=null;selectedReward=null;selectedRewardKeepExisting=undefined;selectedArtifactIndex=null;await refresh();status('Действие принято');
  } catch(error){status(error.message);await refresh()}
  finally{busy=false}
}
function openDomainPayment(card,me,onConfirm){
 const dlg=$('domainPaymentDialog'),ready=me.domains.filter(d=>!d.exhausted&&d.card.produces),selected=new Set();
 const costs=card.cost.colored||{},costTotal=Object.values(costs).reduce((a,b)=>a+b,0)+card.cost.generic;
 $('domainPaymentSummary').textContent=`${cardName(card)} · ${formatCost(card)}. В запасе: ${Object.entries(me.energy).filter(([,n])=>n).map(([c,n])=>`${energyNames[c]||c} ${n}`).join(', ')||'0'}.`;
 const choices=$('domainPaymentChoices');
 const update=()=>{
   const energy={...me.energy};for(const d of ready)if(selected.has(d.objectId))energy[d.card.produces]++;
   let payable=true;for(const [color,n] of Object.entries(costs))if((energy[color]||0)<n)payable=false;
   let total=Object.values(energy).reduce((a,b)=>a+b,0);if(total<costTotal)payable=false;
   $('domainPaymentStatus').textContent=payable?'Оплата возможна. Выбранные Владения истощатся при розыгрыше.':'Выбранной Энергии пока не хватает.';
   $('domainPaymentConfirm').disabled=!payable;
 };
 const makeGroup=(title,items)=>{const group=document.createElement('section');group.className='payment-group';group.append(textElement('h3',title));for(const d of items){const label=document.createElement('label');label.className='payment-domain';const input=document.createElement('input');input.type='checkbox';input.value=d.objectId;input.onchange=()=>{input.checked?selected.add(d.objectId):selected.delete(d.objectId);update()};label.append(input,textElement('span',`${d.card.name} · ${energyNames[d.card.produces]||d.card.produces}`));group.append(label)}choices.append(group)};
 choices.replaceChildren();makeGroup('Базовые',ready.filter(d=>d.card.basic));makeGroup('Особые',ready.filter(d=>!d.card.basic));update();
 $('domainPaymentConfirm').onclick=()=>{const ids=[...selected];dlg.close();onConfirm(ids)};
 dlg.showModal();
}
function kindName(kind){
  const ru={domain:'Владение',creature:'Существо',technique:'Техника',legend:'Легенда',artifact:'Артофакт'};
  const en={domain:'Domain',creature:'Creature',technique:'Technique',legend:'Legend',artifact:'Artifice'};
  return (locale()==='en'?en:ru)[kind]||kind;
}
function cardLabel(p) {
  if (p.card.kind==='legend') return 'Лояльность '+p.loyalty;
  if (p.card.kind==='artifact') return 'Предмет · +'+(p.card.auraAttack??0)+' атаки';
  const stats=(p.card.attack??0)+'/'+Math.max(0,(p.card.health??0)-p.damage);
  return stats+(p.shield?' · Щит '+p.shield:'')+(p.exhausted?' · истощено':'');
}
function enableHandDrag(canPlay) {
  const cards=[...$('hand').querySelectorAll('.card-wrapper>.card')];
  const zones=[...document.querySelectorAll('#myPlayarea .zone-main,#myPlayarea .zone-aux')];
  const playCard=card=>{if(card&&!card.classList.contains('unavailable'))card.onclick?.()};
  for(const [index,card] of cards.entries()){
    card.dataset.handIndex=String(index);
    card.draggable=canPlay&&!card.classList.contains('unavailable');
    let suppressedClickUntil=0,pointer=null;
    card.addEventListener('click',event=>{
      if(Date.now()<suppressedClickUntil){event.preventDefault();event.stopImmediatePropagation()}
    },true);
    card.addEventListener('dragstart',event=>{
      if(!card.draggable){event.preventDefault();return}
      event.dataTransfer?.setData('text/plain',String(index));
      event.dataTransfer?.setData('application/x-firewell-hand-index',String(index));
      card.classList.add('dragging');
      zones.forEach(zone=>zone.classList.add('drop-ready'));
    });
    card.addEventListener('dragend',()=>{card.classList.remove('dragging');zones.forEach(zone=>zone.classList.remove('drop-ready'))});
    card.addEventListener('pointerdown',event=>{
      if(!canPlay||event.pointerType==='mouse'||!card.draggable)return;
      pointer={id:event.pointerId,x:event.clientX,y:event.clientY,at:Date.now(),dragging:false};
      const move=e=>{
        if(!pointer||e.pointerId!==pointer.id)return;
        const distance=Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y);
        if(distance>16&&(Date.now()-pointer.at>170||distance>48)){pointer.dragging=true;card.classList.add('dragging');zones.forEach(zone=>zone.classList.add('drop-ready'));e.preventDefault()}
      };
      const finish=e=>{
        if(!pointer||e.pointerId!==pointer.id)return;
        if(pointer.dragging){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('#myPlayarea .zone-main,#myPlayarea .zone-aux');suppressedClickUntil=Date.now()+650;if(target)playCard(card);e.preventDefault()}
        pointer=null;card.classList.remove('dragging');zones.forEach(zone=>zone.classList.remove('drop-ready'));
        document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',finish,true);document.removeEventListener('pointercancel',finish,true);
      };
      document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',finish,true);document.addEventListener('pointercancel',finish,true);
    });
  }
  for(const zone of zones){
    if(zone.dataset.dragTargetBound)continue;
    zone.dataset.dragTargetBound='true';
    zone.addEventListener('dragover',event=>{event.preventDefault();zone.classList.add('drop-hover')});
    zone.addEventListener('dragleave',()=>zone.classList.remove('drop-hover'));
    zone.addEventListener('drop',event=>{
      event.preventDefault();const index=Number(event.dataTransfer?.getData('application/x-firewell-hand-index')||event.dataTransfer?.getData('text/plain'));
      zone.classList.remove('drop-hover');zones.forEach(x=>x.classList.remove('drop-ready'));
      if(Number.isInteger(index)&&index>=0)playCard($('hand').querySelector(`.card[data-hand-index="${index}"]`));
    });
  }
}
function renderGame(ready) {

  $('roomLabel').textContent='Комната '+room;
  $('surrenderMatch').disabled=!ready||!game||game.phase==='finished'||game.phase==='paused';
  if (!ready || !game) {
    $('turnLabel').textContent='Ожидание соперника. Код комнаты: '+room;
    for(const id of ['mulligan','ritual','reward'])$(id).classList.add('hidden');
    document.querySelectorAll('.playarea').forEach(x=>x.classList.add('hidden'));
    return;
  }
  const seat=game.seat, me=game.players[seat], enemy=game.players[1-seat];
  const mine=game.active===seat&&game.phase==='main', defense=game.phase==='intercept'&&game.pendingAttack?.defender===seat;
  const canRulerDraw=mine&&me.hp>2&&me.handCount<=3&&me.deckCount>=2&&me.lastRulerDrawTurn!==game.turn;
  $('rulerDraw').disabled=!canRulerDraw;
  $('rulerAbilityBar').classList.toggle('hidden',!ready||!game||game.phase==='finished');
  $('rulerDrawHint').textContent=!mine?'Доступно в свой основной ход':me.lastRulerDrawTurn===game.turn?'Уже использована в этом ходу':me.handCount>3?'Для добора оставь максимум 3 карты в руке':me.deckCount<2?'В колоде должно быть минимум 2 карты':me.hp<=2?'Нужно более 2 HP':'Можно взять 2 карты за 2 HP';
  const attack=defense?game.pendingAttack:null;
  const incoming=attack?[...enemy.main,...enemy.auxiliary].find(p=>p.objectId===attack.attackerId):null;
  const attackKey=attack?game.turn+':'+attack.attackerId+':'+JSON.stringify(attack.target):null;
  if(attackKey!==attackAlertKey){defenderChoice=null;attackAlertKey=attackKey}
  const target=attack?.target?.kind==='player'?'твоего Владетеля':
    attack?.target?.kind==='legend'?'Легенду '+(me.legends.find(p=>p.objectId===attack.target.objectId)?.card.name||''):
    attack?.target?.kind==='creature'?'Существо '+([...me.main,...me.auxiliary].find(p=>p.objectId===attack.target.objectId)?.card.name||''):'';
  $('attackAlert').classList.toggle('hidden',!defense);
  $('myPlayarea').classList.toggle('under-attack',defense);
  $('attackDetails').textContent=defense?(incoming?.card.name||'Противник')+' атакует '+target:'';
  $('attackHint').textContent=defenderChoice!==null?
    'Выбран защитник. Подтверди выбор или нажми на другое Существо.':
    'Нажми на своего доступного защитника. Для отказа нажми «Не защищать».';
  $('confirmDefense').classList.toggle('hidden',!defense||defenderChoice===null);
  $('turnLabel').textContent=game.winner!==null?'Матч окончен: '+(game.winner==='draw'?'ничья':'победил игрок '+(game.winner+1))
    :(game.active===seat?'Твой ход':'Ход соперника')+' · '+game.turn;
  const outcome=$('matchOutcome');outcome.classList.toggle('hidden',!['finished','paused'].includes(game.phase));
  if(['finished','paused'].includes(game.phase)){const title=game.phase==='paused'?'Матч приостановлен':game.winner==='draw'?'Ничья':game.winner===seat?'Победа':'Поражение';outcome.replaceChildren(textElement('h2',title),textElement('p',game.phase==='paused'?(game.pauseReason||'Матч приостановлен сервером'):'Матч завершён. Можно вернуться в лобби и выбрать следующую игру.'),button('Вернуться в лобби',()=>$('leaveMatch').click(),false,'secondary'))}
  if(renderMatchDialogs({game,me,seat,selectedMulligan,selectedVictims,
    selectedRitual,setSelectedRitual:v=>{selectedRitual=v},
    selectedReward,setSelectedReward:v=>{selectedReward=v},
    selectedRewardKeepExisting,setSelectedRewardKeepExisting:v=>{selectedRewardKeepExisting=v},
    rerender:()=>renderGame(ready)}))return;
  if(game.phase==='paused')status(game.pauseReason||'Матч приостановлен');
  $('myHp').textContent='· '+me.hp+' HP';$('enemyHp').textContent='· '+enemy.hp+' HP';
  $('myInfo').textContent='Колода '+me.deckCount+' · Рука '+me.handCount+' · Сброс '+me.discardCount+
    ' · Энергия '+(Object.entries(me.energy).filter(([,n])=>n).map(([c,n])=>c+':'+n).join(', ')||'0');
  $('enemyInfo').textContent='Колода '+enemy.deckCount+' · Рука '+enemy.handCount+' · Сброс '+enemy.discardCount;
  $('myLegends').replaceChildren(...me.legends.map(p=>cardButton(p.card,cardLabel(p),
    ()=>{selectedLegendId=p.objectId;renderGame(ready);$('legendDialog').showModal()},
    false,false,p)));
  const legend=me.legends.find(p=>p.objectId===selectedLegendId);
  $('legendDialogTitle').textContent=legend?cardName(legend.card):'Легенда';
  const legendView=$('legendCardView');legendView.replaceChildren();
  if(legend){
    legendView.replaceChildren(cardButton(legend.card,'Лояльность '+legend.loyalty,()=>showCardDetails(legend.card,legend),false,false,legend));
  }
  const actions=$('legendActions');
  actions.classList.toggle('hidden',!legend);
  actions.replaceChildren();
  $('discardPicker').replaceChildren();$('discardPicker').classList.add('hidden');
  if(legend) {
    actions.append(textElement('strong',legend.card.name+' · '+legend.loyalty+' лояльности'));
    const choices=legend.card.loyaltyAbilities?.length?legend.card.loyaltyAbilities:
      legend.card.loyaltyAbility?[legend.card.loyaltyAbility]:[];
    for(const [index,ability] of choices.entries()){
      const allowed=mine&&legend.lastActivatedTurn!==game.turn&&!legend.stunned&&!legend.stasis&&!legend.silenced&&
        legend.loyalty+ability.delta>=0&&
        (ability.kind!=='recoverCreature'||me.discard?.some(c=>c.kind==='creature'))&&
        (!['raiseSacrifice','summonSignature','summon'].includes(ability.kind)||me.auxiliary.length<4);
      actions.append(button(abilityText(ability),()=>{
        if(ability.kind==='recoverCreature'){
          const choices=(me.discard||[]).map((card,i)=>({card,index:i})).filter(x=>x.card.kind==='creature');
          $('legendDialog').close();
          chooseCards('Сброс → рука · выбери Существо',choices.map(item=>({card:item.card,label:'Вернуть в руку',choose:()=>send({type:'activateLegend',objectId:legend.objectId,abilityIndex:index,discardIndex:item.index})})));
        }else send({type:'activateLegend',objectId:legend.objectId,abilityIndex:index});
      },!allowed,index===0?'secondary':''));
    }
  }
  renderBattlefield({me,enemy,mine,defense,attack,incoming,target,selected,defenderChoice,
    rerender:()=>renderGame(ready),
    onSelected:value=>{selected=value},
    onDefenderChoice:value=>{defenderChoice=value}});
  $('hand').replaceChildren(...(me.hand||[]).map((c,i)=>cardButton(c,kindName(c.kind)+(c.cost?' · '+(c.cost.generic+Object.values(c.cost.colored).reduce((a,b)=>a+b,0))+' энергии':''),
    ()=>{if(game.phase==='discard')send({type:'discard',handIndex:i});
      else if(c.kind==='legend'&&me.legends.some(p=>p.card.name===c.name))
        chooseCards('Какую Легенду оставить?',[{card:me.legends.find(p=>p.card.name===c.name).card,label:'Оставить на поле',choose:()=>send({type:'playLegend',handIndex:i,keepExisting:true})},{card:c,label:'Оставить новую',choose:()=>send({type:'playLegend',handIndex:i,keepExisting:false})}]);
      else if(c.kind==='artifact'&&me.auxiliary.some(p=>p.card.name===c.name))
        chooseCards('Какой предмет оставить?',[{card:me.auxiliary.find(p=>p.card.name===c.name).card,label:'Оставить на поле',choose:()=>send({type:'playArtifact',handIndex:i,keepExisting:true})},{card:c,label:'Оставить новый',choose:()=>send({type:'playArtifact',handIndex:i,keepExisting:false})}]);
      else if(c.kind==='creature'&&c.unique&&[...me.main,...me.auxiliary].some(p=>p.card.name===c.name))
        chooseCards('Какое Уникальное Существо оставить?',[{card:c,label:'Оставить на поле',choose:()=>send({type:'playCreature',handIndex:i,keepExisting:true})},{card:c,label:'Оставить новое',choose:()=>send({type:'playCreature',handIndex:i,keepExisting:false})}]);
      else if(c.kind==='technique')playTechnique(c,i,me,enemy);
      else if(c.kind==='creature'&&!c.createdToken&&['stunEnemy','stasisEnemy'].includes(c.onEntry?.kind))playCreature(c,i,enemy);
      else if((c.kind==='artifact'||c.kind==='creature'&&c.createdToken)&&me.auxiliary.length>=4){selectedArtifactIndex=i;renderGame(ready)}
      else send({type:c.kind==='domain'?'playDomain':c.kind==='technique'?'playTechnique':c.kind==='legend'?'playLegend':c.kind==='artifact'?'playArtifact':'playCreature',handIndex:i})},
    !(mine||game.phase==='discard'&&game.active===seat))));
  enableHandDrag(mine);
  $('artifactReplacements').replaceChildren(...(selectedArtifactIndex===null?[]:me.auxiliary.filter(p=>!p.card.majestic)
    .map(p=>cardButton(p.card,'Вытеснить',()=>send({type:me.hand[selectedArtifactIndex]?.kind==='creature'?'playCreature':'playArtifact',handIndex:selectedArtifactIndex,replaceId:p.objectId})))));
  $('hero').disabled=!mine||selected===null;$('skip').disabled=!defense;$('end').disabled=!mine;
}
const {renderBuilder}=createDeckBuilderUI({$,button,textElement,initials,cardName,kindName,status,getCatalog:()=>catalog,getDeckIds:()=>deckIds,cardButton,showCardDetails});

$('rulesOpen').onclick=()=>{show('rulesPage');renderPublicRules();localize()};
$('homeRulesOpen').onclick=()=>$('rulesOpen').click();
$('rulesSearch').oninput=filterRules;
function filterRules(){const term=$('rulesSearch').value.toLocaleLowerCase('ru');for(const section of $('rulesContent').children){section.hidden=!!term&&!section.textContent.toLocaleLowerCase('ru').includes(term);const link=$('rulesToc').querySelector('[href="#'+section.id+'"]');if(link)link.hidden=section.hidden}}
$('rulesClose').onclick=()=>{show(lastPage);refresh()};
$('languageToggle').onclick=async()=>{
  setLocale(locale()==='ru'?'en':'ru');
  localize();
  if(!$('rulesPage').classList.contains('hidden'))renderPublicRules();
  if(!$('builder').classList.contains('hidden'))renderBuilder();
  if(token){await loadData();await refresh()}
  localize();
};
$('register').onclick=()=>authenticate(true);
$('signIn').onclick=()=>authenticate(false);
$('logout').onclick=async()=>{$('profileDialog').close();try{await api('/api/logout',{})}catch{}token='';account=null;room='';localStorage.removeItem(sessionKey);localStorage.removeItem(roomKey);show('auth');status('Вы вышли')};
$('rename').onclick=async()=>{await requestAction({title:'Сменить логин',message:'Твой постоянный ID, колоды и статистика сохранятся.',confirmText:'Сохранить',fields:[{name:'login',label:'Новый логин',value:account?.login,minLength:3,maxLength:20,pattern:'[A-Za-z0-9_]{3,20}',autocomplete:'username'}],onSubmit:async({login})=>{setAccount((await api('/api/me/rename',{login})).account);status('Логин обновлён')}})};
$('deleteProfile').onclick=async()=>{await requestAction({title:'Удалить профиль?',message:'Профиль, сохранённые колоды и доступ будут удалены навсегда. Введи пароль профиля для подтверждения.',confirmText:'Удалить навсегда',danger:true,fields:[{name:'password',label:'Пароль профиля',type:'password',autocomplete:'current-password',minLength:10,maxLength:128}],onSubmit:async({password})=>{await api('/api/me/delete',{password});token='';account=null;room='';localStorage.removeItem(sessionKey);localStorage.removeItem(roomKey);$('profileDialog').close();show('auth');status('Профиль удалён')}})};
$('search').onclick=async()=>{try{const data=await api('/api/queue',{deckId:$('deck').value});if(data.room)enterRoom(data.room);else await refresh()}catch(e){status(e.message)}};
$('cancelSearch').onclick=async()=>{try{await api('/api/queue',undefined,'DELETE');await refresh()}catch(e){status(e.message)}};
$('playBot').onclick=async()=>{try{const result=await api('/api/bot',{deckId:$('deck').value});enterRoom(result.code)}catch(e){status(e.message)}};
$('createRoom').onclick=async()=>{try{enterRoom((await api('/api/rooms',{deckId:$('deck').value})).code)}catch(e){status(e.message)}};
$('joinRoom').onclick=async()=>{try{const code=$('code').value.trim().toUpperCase();await api('/api/rooms/'+code+'/join',{deckId:$('deck').value});enterRoom(code)}catch(e){status(e.message)}};
$('leaveMatch').onclick=async()=>{minimizedRoom=room;localStorage.setItem(minimizedKey,room);room='';game=null;localStorage.removeItem(roomKey);show('home');await refresh();status('Матч продолжается. Вернитесь через «Продолжить» в лобби.')};
$('surrenderMatch').onclick=async()=>{
 if(!room||!game||game.phase==='finished'||game.phase==='paused')return;
 if(!await requestAction({title:'Сдаться в этом матче?',message:'Сопернику будет засчитана победа. Если хочешь только вернуться в лобби, используй «Свернуть матч».',confirmText:'Сдаться',danger:true}))return;
 await send({type:'surrender'});
};
const {renderSharedChat,updateChatCooldown,sendSharedChat}=createChatUI({$,textElement,api,refresh,status,getOlderMessages:()=>olderMessages,getChatMore:()=>chatMore,getAvailableAt:()=>chatAvailableAt,setAvailableAt:value=>{chatAvailableAt=value}});
for(const id of ['chatForm','matchChatForm','spectatorChatForm'])$(id).onsubmit=sendSharedChat;
$('chatOpen').onclick=()=>$('matchChatDialog').showModal();
$('chatClose').onclick=()=>$('matchChatDialog').close();
$('matchChatDialog').onclick=e=>{if(e.target===$('matchChatDialog'))$('matchChatDialog').close()};
$('legendClose').onclick=()=>$('legendDialog').close();
$('legendDialog').onclick=e=>{if(e.target===$('legendDialog'))$('legendDialog').close()};
$('domainPaymentClose').onclick=()=>$('domainPaymentDialog').close();
$('domainPaymentCancel').onclick=()=>$('domainPaymentDialog').close();
$('domainPaymentDialog').onclick=e=>{if(e.target===$('domainPaymentDialog'))$('domainPaymentDialog').close()};
$('autoDomainPayment').checked=autoDomainPayment;
$('autoDomainPayment').onchange=()=>{autoDomainPayment=$('autoDomainPayment').checked;localStorage.setItem('firewell_auto_domain_payment',String(autoDomainPayment))};
$('spectatorClose').onclick=()=>{spectating=null;show('home');refresh()};
$('olderChat').onclick=async()=>{
  try{
    const before=olderMessages[0]?.id||$('chat').dataset.earliest;
    const result=await api('/api/chat/history?limit=50'+(before?'&before='+encodeURIComponent(before):''));
    olderMessages=[...result.messages,...olderMessages].filter((m,i,a)=>a.findIndex(z=>z.id===m.id)===i);
    chatMore=result.hasMore;await refresh();
  }catch(e){status(e.message)}
};
async function reloadFeedback(){
  const records=(await api('/api/feedback/mine')).reports;
  $('myFeedback').replaceChildren(...records.map(report=>{
    const row=document.createElement('div');row.className='report-entry';
    row.append(textElement('strong','#'+report.id+' · '+report.title),
      textElement('small',report.category+' · '+report.status+' · '+new Date(report.createdAt).toLocaleString()),
      textElement('p',report.body));
    return row;
  }));
}
$('loadFeedback').onclick=()=>reloadFeedback().catch(e=>status(e.message));
$('feedbackForm').onsubmit=async event=>{
  event.preventDefault();$('feedbackSubmit').disabled=true;
  try{
    const result=await api('/api/feedback',{category:$('feedbackType').value,
      title:$('feedbackTitle').value,roomCode:$('feedbackRoom').value.trim().toUpperCase(),
      text:$('feedbackText').value});
    $('feedbackText').value='';$('feedbackTitle').value='';
    $('feedbackConfirm').textContent='Обращение №'+result.report.id+' сохранено';
    await reloadFeedback();
  }catch(e){status(e.message)}
  finally{$('feedbackSubmit').disabled=false}
};
function editDeck(deck){editingDeckId=savedDecks.some(d=>d.id===deck.id)?deck.id:undefined;deckIds=[...deck.cards];$('deckName').value=deck.name||'Моя колода';show('builder');renderBuilder()}
$('openBuilder').onclick=()=>editDeck(savedDecks.find(d=>d.id===$('deck').value)||presets.find(d=>d.id===$('deck').value)||presets[0]);
$('closeBuilder').onclick=()=>{show('home');refresh()};
$('loadStarter').onclick=()=>{editingDeckId=undefined;deckIds=[...presets.find(p=>p.id===$('starter').value).cards];renderBuilder()};
$('saveDeck').onclick=async()=>{try{await api('/api/my-decks',{name:$('deckName').value,cards:deckIds,...(editingDeckId?{id:editingDeckId}:{})});await loadData();show('home');status('Колода сохранена')}catch(e){status(e.message)}};
$('cardSearch').oninput=renderBuilder;for(const id of ['aspectFilter','kindFilter','costFilter','cardSort'])$(id).onchange=renderBuilder;
$('confirmMulligan').onclick=()=>send({type:'mulligan',indices:[...selectedMulligan].sort((a,b)=>a-b)});
$('confirmRitual').onclick=()=>send({type:'chooseRitual',effectId:selectedRitual,objectIds:[...selectedVictims]});
$('hero').onclick=()=>send({type:'attack',attackerId:selected,target:{kind:'player'}});
$('skip').onclick=()=>send({type:'intercept',interceptorId:null});
$('confirmDefense').onclick=()=>{if(defenderChoice!==null)send({type:'intercept',interceptorId:defenderChoice})};
$('end').onclick=()=>send({type:'endTurn'});
function tick(){if(!game?.deadlineAt){$('timer').textContent='';return}const left=Math.max(0,Math.ceil((game.deadlineAt-Date.now())/1000));$('timer').textContent='⏱ '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')}
$('apiUrl').value=apiBase;
if (hostedClient) {
  $('serverSettings').hidden = true;
  localStorage.removeItem(serverKey); // Ignore obsolete manual URLs on hosted pages.
} else if (apiBase) {
  $('serverSettings').open = true;
}
show('auth');
checkGameServer();
setInterval(checkGameServer,20000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){checkGameServer();refresh()} /* Hidden sessions expire via server TTL; don't issue unload-time requests rejected by mobile WebKit. */ });
if(token)api('/api/me').then(async data=>{
  setAccount(data.account);
  try{await loadData();await refresh()}catch(error){status(error.message)}
}).catch(error=>{
  if(error.status===401){token='';localStorage.removeItem(sessionKey);show('auth')}
  else status('Не удалось восстановить соединение. Обнови страницу, когда сервер будет доступен.');
});
observeLocalization();
setInterval(()=>{if(!document.hidden)refresh()},2500);setInterval(tick,1000);setInterval(updateChatCooldown,250);
updateChatCooldown();


