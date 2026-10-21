import { locale, setLocale, cardName, archetypeName, translate, observeLocalization, localize } from './i18n.js';
import { renderPublicRules } from './rules.js';
const $ = id => document.getElementById(id);
const sessionKey = 'firewell_session', serverKey = 'firewell_server', roomKey = 'firewell_room';
const hostedClient = location.hostname.endsWith('.vercel.app');
let token = localStorage.getItem(sessionKey) || '';
let apiBase = hostedClient ? '' : (localStorage.getItem(serverKey) || '');
let room = localStorage.getItem(roomKey) || '';
let account = null, catalog = [], presets = [], savedDecks = [], deckIds = [], game = null;
let selected = null, selectedMulligan = new Set(), selectedVictims = new Set(), selectedRitual = null;
let selectedReward = null, selectedRewardKeepExisting = undefined, selectedArtifactIndex = null, busy = false, loading = false;
let selectedLegendId = null, defenderChoice = null, attackAlertKey = null;
let chatAvailableAt=0,olderMessages=[],chatMore=true;
function status(value) { $('status').textContent = translate(value || ''); }
let lastPage='auth';
function show(id) {
  if(id!=='rulesPage')lastPage=id;
  for(const pane of ['auth','home','builder','match','rulesPage'])$(pane).classList.toggle('hidden',pane!==id);
}
function serverAddress() {
  if (hostedClient) return ''; // Vercel proxies /api/* to the configured game server.
  const entered = $('apiUrl').value.trim().replace(/\/$/,'');
  if (!entered) return '';
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
function abilityText(ability) {
  if(!ability)return 'Пока нет активной способности';
  const effects={healRuler:'Восстановить '+ability.amount+' HP Владетелю',
    damageOpponent:'Нанести '+ability.amount+' урона Владетелю противника',
    draw:'Взять карт: '+ability.amount, recoverCreature:'Вернуть Существо из сброса в руку',
    raiseSacrifice:'Создать Жертву 2/2 во вспомогательной зоне'};
  return (ability.delta>0?'+':'')+ability.delta+' лояльности · '+(effects[ability.kind]||ability.kind);
}
function effectText(e) {
  const descriptions={summonSkeleton:'Призвать скелетов 1/1 с Жертвой: ',healRuler:'Восстановить HP Владетелю: ',draw:'Взять карт: ',damageOpponent:'Урон Владетелю соперника: ',damageController:'Урон своему Владетелю: ',damageAllCreatures:'Урон всем Существам: ',reanimate:'Вернуть Существо из своего сброса на поле: ',cleanse:'Снять отрицательные статусы: ',silence:'Подавить способности: ',bind:'Сковывание: '};
  return (descriptions[e.kind]||e.kind+' ')+e.amount;
}
function chooseCards(title,choices) {
  $('choiceTitle').textContent=title;
  $('choiceCards').replaceChildren(...choices.map(x=>cardButton(x.card,x.label,()=>{$('choiceDialog').close();x.choose()})));
  if(!choices.length)$('choiceCards').append(textElement('p','Нет подходящих карт'));
  $('choiceDialog').showModal();
}
$('choiceCancel').onclick=()=>$('choiceDialog').close();
$('rulerDraw').onclick=()=>send({type:'rulerDraw'});
function playTechnique(card,index,me,enemy) {
  const e=card.techniqueEffect;
  if(e?.kind==='reanimate') {
    chooseCards('Вернуть Существо на поле',(me.discard||[]).flatMap((c,i)=>c.kind==='creature'?[{card:c,label:'Воскресить',choose:()=>send({type:'playTechnique',handIndex:index,discardIndex:i})}]:[]));
  } else if(['cleanse','silence','bind'].includes(e?.kind)) {
    const side=e.kind==='cleanse'?me:enemy;
    chooseCards('Выбери цель Техники',[...side.main,...side.auxiliary,...side.legends].filter(p=>e.kind==='bind'?p.card.kind==='creature':true).map(p=>({card:p.card,label:cardLabel(p),choose:()=>send({type:'playTechnique',handIndex:index,targetId:p.objectId})})));
  } else send({type:'playTechnique',handIndex:index});
}
function detailsText(card,p) {
  const bits=[];
  if(card.attack!==undefined&&card.health!==undefined)bits.push('Сила '+card.attack+' / Здоровье '+card.health);
  if(p?.damage)bits.push('Ранения '+p.damage);
  if(p?.shield)bits.push('Щит '+p.shield);
  if(p?.loyalty!==undefined)bits.push('Лояльность '+p.loyalty);
  if(card.cost)bits.push('Стоимость '+(card.cost.generic+Object.values(card.cost.colored||{}).reduce((a,b)=>a+b,0))+' энергии');
  if(card.produces)bits.push('Даёт энергию: '+card.produces);
  if(card.unique)bits.push('Уникальная карта');
  return bits.join(' · ');
}
function traitDescriptions(card) {
  const traits=[
    ['guard','Страж: может перехватывать нападение на Существо'],
    ['flying','Полёт: перехватывается только летающими Существами'],
    ['firstStrike','Первый удар: наносит урон до ответного удара'],
    ['piercing','Пробивание: избыточный урон после перехвата проходит к исходной цели'],
    ['lifesteal','Похищение жизни: восстанавливает HP на величину нанесённого урона'],
    ['stealth','Скрытность: Существо нельзя выбрать целью атаки'],
    ['haste','Мгновенная атака: может атаковать в ход выхода'],
    ['zeal','Рвение: может сразу атаковать Существо'],
    ['sacrifice','Жертва: подходит для ритуального принесения в жертву'],
    ['majestic','Величественный: нельзя вытеснить из зоны']];
  const result=traits.filter(([k])=>card[k]).map(([,txt])=>txt);
  if(card.shield)result.push('Щит '+card.shield+': поглощает урон');
  if(card.poisonHit)result.push('Отрава '+card.poisonHit.strength+' / '+card.poisonHit.ticks);
  if(card.extraAttacks)result.push('Дополнительные атаки: '+card.extraAttacks);
  if(card.ritual)result.push('Ритуал: нужно Жертв '+card.ritual.threshold);
  if(card.onDeath)result.push('Последнее слово: '+effectText(card.onDeath));
  if(card.onEntry)result.push('Вступление: '+effectText(card.onEntry));
  if(card.secondChance)result.push('Второй шанс: '+effectText(card.secondChance));
  if(card.techniqueEffect)result.push(effectText(card.techniqueEffect));
  if(card.loyaltyAbilities?.length)result.push(...card.loyaltyAbilities.map(abilityText));
  else if(card.loyaltyAbility)result.push(abilityText(card.loyaltyAbility));
  if(card.abilities?.length)result.push('Ещё не реализовано: '+card.abilities.join(', '));
  return result;
}
function showCardDetails(card,p) {
  const dialog=$('cardInspector');
  $('inspectorTitle').textContent=cardName(card);
  $('inspectorStats').textContent=kindName(card.kind)+' · '+detailsText(card,p);
  $('inspectorTraits').replaceChildren(...traitDescriptions(card).map(value=>textElement('p',value,'trait-description')));
  const lore=card.lore;
  $('inspectorLore').textContent=lore?([lore.state,lore.organization,lore.note].filter(Boolean).join(' · ')):'';
  dialog.showModal();
}
$('inspectorClose').onclick=()=>$('cardInspector').close();
$('cardInspector').onclick=e=>{if(e.target===$('cardInspector'))$('cardInspector').close()};
function cardButton(card, label, onClick, disabled = false, active = false, permanent = undefined) {
  const element = button('',onClick,disabled,'card '+(card.aspects?.[0] || 'neutral')+(active?' active':''));
  if(permanent?.objectId!==undefined)element.dataset.objectId=permanent.objectId;
  element.disabled=false;
  element.classList.toggle('unavailable',disabled);
  element.onclick=()=>disabled?showCardDetails(card,permanent):onClick();
  element.append(textElement('span',initials(cardName(card)),'glyph'),textElement('b',cardName(card)));
  const inspect=textElement('span','ⓘ','inspect-card');
  inspect.setAttribute('role','button'); inspect.tabIndex=0;inspect.setAttribute('aria-label','Подробнее о карте '+cardName(card));
  const reveal=e=>{e.stopPropagation();showCardDetails(card,permanent)};
  inspect.onclick=reveal;
  inspect.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal(e)}};
  element.append(inspect);
  element.append(textElement('small',label));
  const flags = [['unique','Уникальная'],['guard','Страж'],['flying','Полёт'],['firstStrike','Первый удар'],
    ['piercing','Пробивание'],['lifesteal','Похищение жизни'],['stealth','Скрытность'],['majestic','Величественный'],
    ['sacrifice','Жертва'],['haste','Мгновенная атака'],['zeal','Рвение']]
    .filter(([flag])=>card[flag]).map(([,name])=>name);
  if(card.ritual)flags.push('Ритуал '+card.ritual.threshold);
  if(card.poisonHit)flags.push('Отрава '+card.poisonHit.strength+'/'+card.poisonHit.ticks);
  if(card.shield)flags.push('Щит '+card.shield);
  if(card.abilities?.length)flags.push('⚠ Временно неактивно: '+card.abilities.join(', '));
  element.title=cardName(card)+' · '+label+(flags.length?'\n'+flags.join(' · '):'');
  element.setAttribute('aria-label',cardName(card)+' · '+label+(flags.length?' · '+flags.join(', '):''));
  if(flags.length)element.append(textElement('small',flags.slice(0,2).join(' · ')+(flags.length>2?' · +'+(flags.length-2):''),'card-flags'));
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
  const options=[...presets.map(p=>({id:p.id,name:archetypeName(p)})),...savedDecks.map(d=>({id:d.id,name:d.name+' · своя'}))];
  $('deck').replaceChildren(...options.map(o=>{const element=document.createElement('option');element.value=o.id;element.textContent=o.name;return element}));
  $('starter').replaceChildren(...presets.map(p=>{const element=document.createElement('option');element.value=p.id;element.textContent=archetypeName(p);return element}));
  $('savedDecks').replaceChildren(...savedDecks.map(d=>{
    const row=document.createElement('div');row.className='saved';
    row.append(textElement('span',d.name+' · '+d.count+' карт'));
    row.append(button('Удалить',async()=>{try{await api('/api/my-decks/'+d.id,undefined,'DELETE');await loadData();status('Колода удалена')}catch(e){status(e.message)}},false,'ghost'));
    return row;
  }));
}
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
  $('presence').textContent='Онлайн: '+data.online+' · в поиске: '+data.searching;
  $('queueStatus').textContent=data.searchingSelf?'Поиск идёт. Подбираем другого игрока…':'';
  $('search').disabled=data.searchingSelf;
  $('cancelSearch').classList.toggle('hidden',!data.searchingSelf);
  const chat=$('chat'), pinned=chat.scrollTop+chat.clientHeight>=chat.scrollHeight-20;
  const items=[...new Map([...olderMessages,...data.chat].map(message=>[message.id,message])).values()].sort((a,b)=>a.id-b.id);
  chat.dataset.earliest=String(items[0]?.id||'');
  chat.replaceChildren(...items.map(message=>{
    const line=document.createElement('div');line.className='message';
    line.append(textElement('strong',message.login+' '),textElement('small','ID '+message.accountId+' · '),
      textElement('span',message.body));
    line.title=message.accountId;return line;
  }));
  if (pinned) chat.scrollTop=chat.scrollHeight;
  $('olderChat').disabled=!chatMore;
  if (data.room && !room) enterRoom(data.room);
}
async function refresh() {
  if (!token || loading || !$('rulesPage').classList.contains('hidden')) return;
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
function renderGame(ready) {
  if (game?.rulesVersion === '0.9.13-alpha' && !location.pathname.includes('/versions/0.9.13/')) {
    location.replace('/versions/0.9.13/index.html'); return;
  }
  $('roomLabel').textContent='Комната '+room;
  if (!ready || !game) {
    $('turnLabel').textContent='Ожидание соперника. Код комнаты: '+room;
    for(const id of ['mulligan','ritual','reward'])$(id).classList.add('hidden');
    document.querySelectorAll('.playarea').forEach(x=>x.classList.add('hidden'));
    return;
  }
  const seat=game.seat, me=game.players[seat], enemy=game.players[1-seat];
  const mine=game.active===seat&&game.phase==='main', defense=game.phase==='intercept'&&game.pendingAttack?.defender===seat;
  $('rulerDraw').disabled=!mine||me.hp<=2||me.handCount>3||me.deckCount<2||me.lastRulerDrawTurn===game.turn;
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
    :'Ход '+game.turn+' · игрок '+(game.active+1);
  $('mulligan').classList.toggle('hidden',game.phase!=='mulligan');
  $('ritual').classList.toggle('hidden',game.phase!=='ritual'||seat!==game.active);
  $('reward').classList.toggle('hidden',game.phase!=='reward'||seat!==game.active);
  document.querySelectorAll('.playarea').forEach(x=>x.classList.toggle('hidden',['mulligan','ritual','reward'].includes(game.phase)));
  if(game.phase==='mulligan') {
    const done=game.mulliganReady[seat];$('mulliganHand').replaceChildren();
    if(!done)(me.hand||[]).forEach((c,i)=>$('mulliganHand').append(cardButton(c,kindName(c.kind),()=>{selectedMulligan.has(i)?selectedMulligan.delete(i):selectedMulligan.add(i);renderGame(ready)},false,selectedMulligan.has(i))));
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
      const zone=c.createdToken?me.auxiliary:me.main,limit=c.createdToken?4:8;
      const existing=c.unique?[...me.main,...me.auxiliary].find(p=>p.card.name===c.name):undefined;
      const keepExisting=existing?confirm('Оставить уже находящееся на поле Уникальное Существо?'):undefined;
      if(keepExisting===true){send({type:'chooseReward',rewardId:c.id,keepExisting});return}
      const remaining=existing?zone.filter(p=>p.objectId!==existing.objectId):zone;
      const choices=remaining.filter(p=>!p.card.majestic);
      if(remaining.length<limit||!choices.length)send({type:'chooseReward',rewardId:c.id,keepExisting});
      else{selectedReward=c.id;selectedRewardKeepExisting=keepExisting;renderGame(ready)}
    },false,selectedReward===c.id)));
    const reward=offers.find(c=>c.id===selectedReward),zone=reward?.createdToken?me.auxiliary:me.main;
    const existing=reward?.unique?[...me.main,...me.auxiliary].find(p=>p.card.name===reward.name):undefined;
    const remaining=existing&&selectedRewardKeepExisting===false?zone.filter(p=>p.objectId!==existing.objectId):zone;
    $('rewardReplacements').replaceChildren(...(reward&&remaining.length>=(reward.createdToken?4:8)
      ?remaining.filter(p=>!p.card.majestic).map(p=>cardButton(p.card,'Заменить · '+cardLabel(p),
         ()=>send({type:'chooseReward',rewardId:reward.id,replaceId:p.objectId,keepExisting:selectedRewardKeepExisting}))):[]));
    return;
  }
  if(game.phase==='paused')status(game.pauseReason||'Матч приостановлен');
  $('myHp').textContent='· '+me.hp+' HP';$('enemyHp').textContent='· '+enemy.hp+' HP';
  $('myInfo').textContent='Колода '+me.deckCount+' · Рука '+me.handCount+' · Сброс '+me.discardCount+
    ' · Энергия '+(Object.entries(me.energy).filter(([,n])=>n).map(([c,n])=>c+':'+n).join(', ')||'0');
  $('enemyInfo').textContent='Колода '+enemy.deckCount+' · Рука '+enemy.handCount+' · Сброс '+enemy.discardCount;
  $('myLegends').replaceChildren(...me.legends.map(p=>cardButton(p.card,cardLabel(p),
    ()=>{selectedLegendId=selectedLegendId===p.objectId?null:p.objectId;renderGame(ready)},
    !mine,false,p)));
  const legend=me.legends.find(p=>p.objectId===selectedLegendId);
  const actions=$('legendActions');
  actions.classList.toggle('hidden',!legend);
  actions.replaceChildren();
  $('discardPicker').replaceChildren();$('discardPicker').classList.add('hidden');
  if(legend) {
    actions.append(textElement('strong',legend.card.name+' · '+legend.loyalty+' лояльности'));
    const choices=legend.card.loyaltyAbilities?.length?legend.card.loyaltyAbilities:
      legend.card.loyaltyAbility?[legend.card.loyaltyAbility]:[];
    for(const [index,ability] of choices.entries()){
      const allowed=mine&&legend.lastActivatedTurn!==game.turn&&!legend.stunned&&!legend.stasis&&
        legend.loyalty+ability.delta>=0&&
        (ability.kind!=='recoverCreature'||me.discard?.some(c=>c.kind==='creature'))&&
        (ability.kind!=='raiseSacrifice'||me.auxiliary.length<4);
      actions.append(button(abilityText(ability),()=>{
        if(ability.kind==='recoverCreature'){
          const picker=$('discardPicker');
          picker.classList.remove('hidden');
          picker.replaceChildren(textElement('h3','Выбери Существо из сброса'));
          const choices=(me.discard||[]).map((card,i)=>({card,index:i})).filter(x=>x.card.kind==='creature');
          for(const item of choices)picker.append(cardButton(item.card,detailsText(item.card),()=>{
            send({type:'activateLegend',objectId:legend.objectId,abilityIndex:index,discardIndex:item.index});
            picker.classList.add('hidden');
          }));
        }else send({type:'activateLegend',objectId:legend.objectId,abilityIndex:index});
      },!allowed,index===0?'secondary':''));
    }
  }
  $('enemyLegends').replaceChildren(...enemy.legends.map(p=>{
    const el=cardButton(p.card,cardLabel(p),()=>send({type:'attack',attackerId:selected,target:{kind:'legend',objectId:p.objectId}}),!mine||selected===null,false,p);
    return el;
  }));
  for(const [id,zone] of [['myBoard',me.main],['myAux',me.auxiliary]]) {
    $(id).replaceChildren(...zone.map(p=>cardButton(p.card,cardLabel(p),()=>{
      if(defense){defenderChoice=p.objectId;renderGame(ready)}
      else{selected=p.objectId;renderGame(ready)}
    },p.card.kind!=='creature'||(!defense&&!mine)||!!p.stasis||(!defense&&!!p.stunned)||p.exhausted||
      (defense&&(p.interceptions>0||(attack?.target?.kind==='creature'&&!p.card.guard)||
        (incoming?.card.flying&&!p.card.flying))),selected===p.objectId||defenderChoice===p.objectId,p)));
  }
  for(const [id,zone] of [['enemyBoard',enemy.main],['enemyAux',enemy.auxiliary]])
    $(id).replaceChildren(...zone.map(p=>{
      const el=cardButton(p.card,cardLabel(p),
        ()=>send({type:'attack',attackerId:selected,target:{kind:'creature',objectId:p.objectId}}),
        !mine||selected===null||p.card.kind!=='creature'||!!p.card.stealth,false,p);
      if(defense&&p.objectId===attack?.attackerId){
        el.classList.add('incoming-attacker');
        el.setAttribute('aria-label','Атакует '+target+' · '+p.card.name);
        el.append(textElement('small','⚔ Атакует '+target,'attack-target'));
      }
      return el;
    }));
  if(defense&&attack?.target?.objectId){
    for(const id of ['myBoard','myAux','myLegends']){
      const el=[...$(id).querySelectorAll('.card')].find(x=>x.dataset.objectId===String(attack.target.objectId));
      if(el)el.classList.add('attack-target-highlight');
    }
  }
  // Show the real 8+4 capacity even when the field is empty.
  for(const [id,limit] of [['myBoard',8],['enemyBoard',8],['myAux',4],['enemyAux',4]]) {
    for(let i=$(id).children.length;i<limit;i++){
      const place=textElement('div','◇','slot-placeholder');place.setAttribute('aria-hidden','true');$(id).append(place);
    }
  }
  const domainLabels={red:'К',blue:'С',green:'З',gold:'Ж',violet:'Ф',neutral:'Н'};
  const readyDomains=me.domains.filter(p=>!p.exhausted);
  $('domainSummary').textContent=me.domains.length+' всего · '+readyDomains.length+' готовы · '+(me.domains.length-readyDomains.length)+' истощены';
  $('myDomains').replaceChildren(...me.domains.map(p=>{
    const el=button(domainLabels[p.card.produces]||'◇',()=>send({type:'tapDomain',objectId:p.objectId}),
      !mine||p.exhausted,'domain-chip '+(p.card.produces||'neutral')+(p.exhausted?' spent':''));
    el.title=p.card.name+(p.exhausted?' · истощено':' · готово');
    el.setAttribute('aria-label',el.title);
    return el;
  }));
  $('enemyDomains').textContent=enemy.domains.length+' Владений';
  $('hand').replaceChildren(...(me.hand||[]).map((c,i)=>cardButton(c,kindName(c.kind)+(c.cost?' · '+(c.cost.generic+Object.values(c.cost.colored).reduce((a,b)=>a+b,0))+' энергии':''),
    ()=>{if(game.phase==='discard')send({type:'discard',handIndex:i});
      else if(c.kind==='legend'&&me.legends.some(p=>p.card.name===c.name))
        chooseCards('Какую Легенду оставить?',[{card:me.legends.find(p=>p.card.name===c.name).card,label:'Оставить на поле',choose:()=>send({type:'playLegend',handIndex:i,keepExisting:true})},{card:c,label:'Оставить новую',choose:()=>send({type:'playLegend',handIndex:i,keepExisting:false})}]);
      else if(c.kind==='artifact'&&me.auxiliary.some(p=>p.card.name===c.name))
        chooseCards('Какой предмет оставить?',[{card:me.auxiliary.find(p=>p.card.name===c.name).card,label:'Оставить на поле',choose:()=>send({type:'playArtifact',handIndex:i,keepExisting:true})},{card:c,label:'Оставить новый',choose:()=>send({type:'playArtifact',handIndex:i,keepExisting:false})}]);
      else if(c.kind==='technique')playTechnique(c,i,me,enemy);
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
  const counts=new Map();deckIds.forEach(id=>counts.set(id,(counts.get(id)||0)+1));
  const selected=deckIds.map(id=>catalog.find(c=>c.id===id)).filter(Boolean);
  const warnings=[];
  if(deckIds.length!==70)warnings.push('для сохранения нужно ровно 70 карт');
  if(domains<26)warnings.push('Владений меньше 26');
  if(!selected.some(c=>c.kind==='domain'&&c.basic&&c.produces!=='neutral'))warnings.push('нет базового цветного Владения');
  const source={red:0,blue:0,green:0,gold:0,violet:0};
  const need={red:0,blue:0,green:0,gold:0,violet:0};
  for(const c of selected){
    if(c.kind==='domain'&&source[c.produces]!==undefined)source[c.produces]++;
    for(const [color,cost] of Object.entries(c.cost?.colored||{}))if(need[color]!==undefined)need[color]+=cost||0;
  }
  for(const color of Object.keys(need))if(need[color]>0&&source[color]===0)
    warnings.push('нет источника цвета '+color+' для '+need[color]+' затрат');
  else if(need[color]>0&&source[color]<4)warnings.push('мало источников цвета '+color+' ('+source[color]+')');
  const spells=selected.filter(c=>c.kind!=='domain');
  const mean=spells.length?spells.reduce((sum,c)=>sum+(c.cost?.generic||0)+Object.values(c.cost?.colored||{}).reduce((a,b)=>a+b,0),0)/spells.length:0;
  if(mean>3.8)warnings.push('высокая средняя стоимость '+mean.toFixed(1));
  $('deckIssues').textContent=domains+' Владений · Подсказки suggest (не изменяют колоду): '+
    (warnings.length?warnings.join('; '):'критических предупреждений нет')+'. Сервер проверит легальность при сохранении.';
  $('builtCards').replaceChildren(...[...counts].map(([id,n])=>entry(catalog.find(c=>c.id===id),n,()=>{deckIds.splice(deckIds.indexOf(id),1);renderBuilder()},'−')));
  const term=$('cardSearch').value.trim().toLocaleLowerCase('ru-RU'),aspect=$('aspectFilter').value;
  $('catalog').replaceChildren(...catalog.filter(c=>(!term||c.name.toLocaleLowerCase('ru-RU').includes(term))&&(!aspect||(c.aspects?.[0]||'neutral')===aspect))
    .map(c=>entry(c,counts.get(c.id)||0,()=>{const current=counts.get(c.id)||0,limit=c.kind==='domain'&&c.basic?70:c.unique||c.kind==='legend'?1:3;
      if(current>=limit||deckIds.length>=70){status('Достигнут предел копий или 70 карт');return}
      deckIds.push(c.id);renderBuilder()},'+')));
}
function entry(card,count,onClick,symbol) {
  const element=document.createElement('div');element.className='entry';
  element.append(textElement('span',initials(cardName(card)),'mini-glyph'));
  const desc=document.createElement('div');desc.className='mini';
  desc.append(textElement('strong',cardName(card)),textElement('small',kindName(card.kind)+(card.cost?' · '+card.cost.generic+'+'+Object.values(card.cost.colored).reduce((a,b)=>a+b,0):'')));
  element.append(desc,textElement('span',String(count),'count'),button(symbol,onClick,false,'secondary'));
  return element;
}
$('rulesOpen').onclick=()=>{show('rulesPage');renderPublicRules();localize()};
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
function updateChatCooldown(){
  const left=Math.max(0,Math.ceil((chatAvailableAt-Date.now())/1000));
  $('chatSubmit').disabled=left>0;
  $('chatSubmit').textContent=left?'Отправить ('+left+'с)':'Отправить';
  $('chatCooldown').textContent=left?'Повторная отправка через '+left+' сек.':'';
}
$('chatForm').onsubmit=async event=>{
  event.preventDefault();if(Date.now()<chatAvailableAt)return;
  try {
    const response=await api('/api/chat',{text:$('chatText').value});
    $('chatText').value='';chatAvailableAt=response.nextAllowedAt||Date.now()+5000;
    updateChatCooldown();await refresh();
  } catch(e){
    const match=/Подождите (\d+) сек/.exec(e.message);
    if(match){chatAvailableAt=Date.now()+Number(match[1])*1000;updateChatCooldown()}
    status(e.message);
  }
};
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
$('openBuilder').onclick=()=>{deckIds=[...presets[0].cards];$('deckName').value='Моя колода';show('builder');renderBuilder()};
$('closeBuilder').onclick=()=>{show('home');refresh()};
$('loadStarter').onclick=()=>{deckIds=[...presets.find(p=>p.id===$('starter').value).cards];renderBuilder()};
$('saveDeck').onclick=async()=>{try{await api('/api/my-decks',{name:$('deckName').value,cards:deckIds});await loadData();show('home');status('Колода сохранена')}catch(e){status(e.message)}};
$('cardSearch').oninput=renderBuilder;$('aspectFilter').onchange=renderBuilder;
$('confirmMulligan').onclick=()=>send({type:'mulligan',indices:[...selectedMulligan].sort((a,b)=>a-b)});
$('confirmRitual').onclick=()=>send({type:'chooseRitual',effectId:selectedRitual,objectIds:[...selectedVictims]});
$('hero').onclick=()=>send({type:'attack',attackerId:selected,target:{kind:'player'}});
$('skip').onclick=()=>send({type:'intercept',interceptorId:null});
$('confirmDefense').onclick=()=>{if(defenderChoice!==null)send({type:'intercept',interceptorId:defenderChoice})};
$('end').onclick=()=>send({type:'endTurn'});
function tick(){if(!game?.deadlineAt){$('timer').textContent='';return}const left=Math.max(0,Math.ceil((game.deadlineAt-Date.now())/1000));$('timer').textContent='⏱ '+Math.floor(left/60)+':'+String(left%60).padStart(2,'0')}
$('apiUrl').value=apiBase;
if (hostedClient) {
  $('apiUrl').closest('label').style.display='none';
  $('apiHint').style.display='none';
  localStorage.removeItem(serverKey); // Ignore any obsolete manually entered tunnel URL.
}
show('auth');
if(token)api('/api/me').then(async data=>{setAccount(data.account);await loadData();await refresh()}).catch(()=>{token='';localStorage.removeItem(sessionKey);show('auth')});
observeLocalization();
setInterval(refresh,2500);setInterval(tick,1000);setInterval(updateChatCooldown,250);
updateChatCooldown();

