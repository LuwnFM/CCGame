import {applySavedLayout,applyLayoutConfig} from './layout-preferences.js?v=designs1';
const $=id=>document.getElementById(id);
const card=(name,color,summary,description)=>{
 const wrapper=document.createElement('span');wrapper.className='card-wrapper';
 const button=document.createElement('button');button.type='button';button.className='card '+color;
 const power=summary.match(/\d+\/\d+/);if(power)button.dataset.power=power[0];
 const glyph=document.createElement('span');glyph.className='glyph';glyph.textContent=[...name].slice(0,2).join('').toUpperCase();
 const title=document.createElement('b');title.textContent=name;
 const art=document.createElement('span');art.className='card-art';
 const stats=document.createElement('small');stats.className='card-summary';stats.textContent=summary;
 const kind=document.createElement('small');kind.textContent='Карта';
 const text=document.createElement('small');text.className='card-description';text.textContent=description;
 button.append(glyph,title,art,stats,kind,text);
 const inspect=document.createElement('button');inspect.type='button';inspect.className='inspect-card';inspect.textContent='ⓘ';inspect.setAttribute('aria-label','Подробнее о карте '+name);
 wrapper.append(button,inspect);return wrapper;
};
function board(id,cards,limit){
 const root=$(id);root.append(...cards.map(args=>card(...args)));
 for(let i=cards.length;i<limit;i++){
  const slot=document.createElement('div');slot.className='slot-placeholder';slot.textContent='◇';slot.setAttribute('aria-hidden','true');root.append(slot);
 }
}
$('enemyHp').textContent='· 24 HP';$('myHp').textContent='· 31 HP';
$('enemyInfo').textContent='Колода 31 · Рука 4 · Сброс 2';$('myInfo').textContent='Колода 28 · Рука 4 · Сброс 2';
$('domainSummary').textContent='6 всего · 2 готовы';$('enemyDomainCount').textContent='4';
$('enemyLegends').append(card('Астрид Вельт','blue','Лояльность 4','Открывает синие сочетания.'));
$('myLegends').append(card('Лиора Кейн','green','Лояльность 4','Защищает границы королевства.'));
board('enemyBoard',[['Ледяной дозорный','blue','3/4 · Страж','Сдерживает нападение.'],['Крылатый посланник','blue','2/2 · Полёт','Летает над полем.']],8);
board('myBoard',[['Рудокоп стали','red','2/2 · Жертва','Подходит для ритуала.'],['Лесной страж','green','3/4 · Страж','Может перехватить атаку.']],8);
board('enemyAux',[],4);board('myAux',[['Щит заставы','gold','Предмет','Укрепляет защиту.']],4);
$('hand').append(card('Клинок разведчика','red','1 красная · 2/2','Удар при выходе.'),card('Лесной страж','green','2 зелёных · 3/4','Страж.'),card('Печать перехода','violet','1 энергия · предмет','Оберегает Владетеля.'),card('Отголосок','blue','2 синих · Техника','Вернуть Существо.'));
for(const [id,labels] of [['myBasicDomains',['К','К','С','Ж']],['mySpecialDomains',['Каменный исток ⓘ']],['enemyBasicDomains',['С','С','Ж']],['enemySpecialDomains',['Особое ⓘ']]]){
 const root=$(id);for(const value of labels){const chip=document.createElement('button');chip.type='button';chip.className='domain-chip '+(value.length>2?'special':'red');chip.textContent=value;root.append(chip)}
}
$('profileName').textContent='Игрок';$('profileId').textContent='FW-1042';
$('presence').textContent='Онлайн: 8 · в поиске: 2';$('deckCount').textContent='70/70';
$('roomLabel').textContent='Матч · пример';$('turnLabel').textContent=' · Твой ход';$('timer').textContent='01:24';
for(const id of ['deck','starter'])for(const name of ['Лесной дозор','Стальной клинок','Астральный круг'])$(id).add(new Option(name,name));
for(const [id,label,actions] of [['savedDecks','Лесной дозор · 70 карт',['Выбрать','Удалить']],['activeMatches','Дружеский матч · A1B2C3D4',['Продолжить','Наблюдать']]]){
 const row=document.createElement('div');row.className='preview-list-row';row.append(document.createTextNode(label+' '));
 for(const title of actions){const button=document.createElement('button');button.type='button';button.textContent=title;row.append(button)}
 $(id).append(row);
}
$('chat').textContent='Добро пожаловать в общий чат!';$('matchChat').textContent='Добро пожаловать в общий чат!';
$('leaderboard').append(...['Лиора · 12 побед','Астрид · 8 побед'].map(value=>{const item=document.createElement('li');item.textContent=value;return item}));
for(const id of ['builtCards','catalog'])$(id).append(card('Лесной страж','green','3/4 · Страж','Может перехватить атаку.'),card('Клинок разведчика','red','2/2 · Существо','Удар при выходе.'));
$('spectatorPlayer0').append(card('Лесной страж','green','3/4','На поле игрока 1.'));
$('spectatorPlayer1').append(card('Ледяной дозорный','blue','3/4','На поле игрока 2.'));
$('spectatorChat').textContent='Общий чат';
$('rulesContent').innerHTML='<h2>Ход и поле</h2><p>Игроки разыгрывают карты и управляют Владениями. Основное поле вмещает восемь карт, вспомогательное — четыре.</p><h2>Бой</h2><p>Выбери атакующего и цель; защитник может принять удар.</p>';
$('mulliganHand').append(card('Лесной страж','green','3/4','Выбрать для замены.'));
$('ritualSources').append(Object.assign(document.createElement('button'),{textContent:'Источник · 2 Жертвы'}));
$('ritualVictims').append(card('Рудокоп стали','red','2/2','Выбрать Жертву.'));
$('rewardCards').append(card('Крылатый посланник','blue','2/2','Награда после боя.'));
$('rewardReplacements').append(card('Лесной страж','green','3/4','Заменяемая карта.'));
$('attackDetails').textContent='Лесной страж атакует Владетеля на 3 урона.';$('confirmDefense').classList.remove('hidden');
$('legendDialogTitle').textContent='Лиора Кейн';$('legendCardView').append(card('Лиора Кейн','green','Лояльность 4','Защищает границы королевства.'));
for(const label of ['Первая способность','Вторая способность'])$('legendActions').append(Object.assign(document.createElement('button'),{type:'button',textContent:label}));
$('domainPaymentSummary').textContent='Выбери Владения для оплаты карты.';
$('domainPaymentChoices').append(...['Базовое красное','Базовое зелёное','Каменный исток'].map(label=>{const line=document.createElement('label');const box=document.createElement('input');box.type='checkbox';line.append(box,document.createTextNode(label));return line}));
$('inspectorTitle').textContent='Лесной страж';$('inspectorStats').textContent='3/4 · Страж';$('inspectorTraits').textContent='Существо · зелёный аспект';$('inspectorLore').textContent='Может перехватить атаку.';
$('inspectorActions').append(Object.assign(document.createElement('button'),{type:'button',textContent:'Разыграть'}));
$('choiceTitle').textContent='Выбери карту';$('choiceCards').append(card('Лесной страж','green','3/4','Страж.'));
// The design study reuses the game's IDs and controls. Domains are visible cards;
// payment preferences stay in a collapsed details control, never a forced overlay.
for(const [areaId,settingsId,basicId,specialId,own] of [
 ['myPlayarea','domainDetails','myBasicDomains','mySpecialDomains',true],
 ['enemyPlayarea',null,'enemyBasicDomains','enemySpecialDomains',false]
]){
 const area=$(areaId),aux=area.querySelector('.zone-aux'),settings=settingsId?$(settingsId):area.querySelector('details');
 const rack=document.createElement('section');rack.className='domains-zone';rack.id=own?'myDomainRack':'enemyDomainRack';
 const title=document.createElement('h3');title.textContent=own?'Владения · 6 / 2 готовы':'Владения · 4 / 4 готовы';rack.append(title);
 const row=document.createElement('div');row.className='domain-cards';row.id=own?'myDomainCards':'enemyDomainCards';
 for(const [id,cards] of [[basicId,own?[
  ['Красное Владение','red','К · 1 энергия','Базовое Владение.'],['Красное Владение','red','К · 1 энергия','Базовое Владение.'],
  ['Синее Владение','blue','С · 1 энергия','Базовое Владение.'],['Зелёное Владение','green','Ж · 1 энергия','Базовое Владение.'],
  ['Зелёное Владение','green','Ж · 1 энергия','Базовое Владение.']
 ]:[['Синее Владение','blue','С · 1 энергия','Базовое Владение.'],['Синее Владение','blue','С · 1 энергия','Базовое Владение.'],['Зелёное Владение','green','Ж · 1 энергия','Базовое Владение.']]],
 [specialId,[['Каменный исток','gold','Особое Владение','Нажми ⓘ, чтобы прочитать эффект.']]]]){
  const group=$(id);group.replaceChildren(...cards.map(args=>card(...args)));group.className='domain-card-group';
  for(const [i,wrapper] of [...group.children].entries()){
   const button=wrapper.querySelector('.card');button.classList.add('domain-card');
   const exhausted=own&&id===basicId&&i<4;button.classList.toggle('exhausted',exhausted);button.setAttribute('aria-pressed',String(exhausted));
   button.onclick=()=>{if(!own)return;const next=!button.classList.contains('exhausted');button.classList.toggle('exhausted',next);button.setAttribute('aria-pressed',String(next));
    const ready=rack.querySelectorAll('.domain-card:not(.exhausted)').length;title.textContent=`Владения · 6 / ${ready} готовы`;
   };
  }
  row.append(group);
 }
 rack.append(row);aux.append(rack);
 settings.querySelector('.domain-groups')?.remove();settings.classList.add('domain-settings');settings.open=false;
 settings.querySelector('summary').textContent=own?'Оплата · базовые первыми':'Сведения о Владениях';
 if(!own){const note=document.createElement('p');note.className='hint';note.textContent='Открытые Владения соперника. Истощённые карты отмечены символом ↷.';settings.append(note)}
 aux.append(settings);
}
$('hand').append(card('Крылатый посланник','blue','2 синих · 2/2','Полёт. Может атаковать над защитой.'));
const designNote=document.createElement('span');designNote.className='table-phase';designNote.textContent='ТВОЙ ХОД · ОСНОВНАЯ ФАЗА';$('myPlayarea').prepend(designNote);
const screens=['auth','home','builder','match','spectator','rulesPage'];
const phases=['mulligan','ritual','reward','attackAlert'];
const dialogs=['choiceDialog','cardInspector','legendDialog','domainPaymentDialog','matchChatDialog'];
function setScreen(screen){
 const base=phases.includes(screen)?'match':screens.includes(screen)?screen:'match';
 for(const id of screens)$(id).classList.toggle('hidden',id!==base);
 for(const id of phases)$(id).classList.toggle('hidden',id!==screen);
}
function showDialog(id){for(const name of dialogs)if($(name).open)$(name).close();if(dialogs.includes(id))$(id).showModal()}
for(const form of document.forms)form.addEventListener('submit',event=>event.preventDefault());
for(const [button,dialog] of [['chatOpen','matchChatDialog'],['myLegends','legendDialog']])$(button).onclick=()=>showDialog(dialog);
for(const [button,dialog] of [['chatClose','matchChatDialog'],['legendClose','legendDialog'],['domainPaymentClose','domainPaymentDialog'],['domainPaymentCancel','domainPaymentDialog'],['inspectorClose','cardInspector'],['choiceCancel','choiceDialog']])$(button).onclick=()=>$(dialog).close();
for(const id of dialogs)$(id).onclick=event=>{if(event.target===$(id))$(id).close()};
document.addEventListener('click',event=>{
 const info=event.target.closest('.inspect-card');
 if(info){const button=info.parentElement.querySelector('.card');$('inspectorTitle').textContent=button.querySelector('b').textContent;$('inspectorStats').textContent=button.querySelector('.card-summary').textContent;$('inspectorLore').textContent=button.querySelector('.card-description').textContent;showDialog('cardInspector');return}
 const button=event.target.closest('#hand .card,.zone-main .card,.zone-aux>.board .card');
 if(button){document.querySelectorAll('.card.is-selected').forEach(el=>el.classList.remove('is-selected'));button.classList.add('is-selected')}
});
setScreen('match');applySavedLayout();
window.FirewellLayout={setScreen,showDialog,applyConfig:config=>applyLayoutConfig(config)};
