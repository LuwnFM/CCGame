import {applySavedLayout} from './layout-preferences.js';
const $=id=>document.getElementById(id);
const card=(name,color,summary,description)=>{
 const wrapper=document.createElement('span');wrapper.className='card-wrapper';
 const button=document.createElement('button');button.type='button';button.className='card '+color;
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
$('domainDetails').open=true;
$('chatOpen').onclick=()=>$('matchChatDialog').showModal();
$('chatClose').onclick=()=>$('matchChatDialog').close();
$('myLegends').onclick=()=>$('legendDialog').showModal();
$('legendClose').onclick=()=>$('legendDialog').close();
$('demoChat').onsubmit=event=>event.preventDefault();
for(const id of ['matchChatDialog','legendDialog'])$(id).onclick=event=>{if(event.target===$(id))$(id).close()};
applySavedLayout();
window.FirewellLayout={applyConfig:config=>import('./layout-preferences.js').then(({applyLayoutConfig})=>applyLayoutConfig(config))};
