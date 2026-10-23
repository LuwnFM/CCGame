import {formatCost,energyNames} from './card-format.js';
/** Card views, choice modal, info popup and detailed trait descriptions. */
export function createCardUI({$,button,textElement,cardName,kindName,send,cardLabel,initials}) {
function abilityText(ability) {
  if(!ability)return 'Пока нет активной способности';
  if(ability.kind==='summon')return (ability.delta>0?'+':'')+ability.delta+' лояльности · Призвать: '+ability.cards.map(c=>c.name+' '+c.attack+'/'+c.health).join(', ');
  const effects={healRuler:'Восстановить '+ability.amount+' HP Владетелю',
    damageOpponent:'Нанести '+ability.amount+' урона Владетелю противника',
    draw:'Взять карт: '+ability.amount, recoverCreature:'Вернуть Существо из сброса в руку',
    raiseSacrifice:'Создать Жертву 2/2 во вспомогательной зоне',
    summonSignature:'Призвать сигнатурного бойца во вспомогательную зону'};
  return (ability.delta>0?'+':'')+ability.delta+' лояльности · '+(effects[ability.kind]||ability.kind);
}
function effectText(e) {
  if(e.kind==='summon')return 'Призвать: '+e.cards.map(c=>c.name+' '+c.attack+'/'+c.health).join(', ');
  const descriptions={summonSkeleton:'Призвать скелетов 1/1 с Жертвой: ',stunEnemy:'Ошеломить Существо противника: ',stasisEnemy:'Наложить Стазис на Существо противника: ',healRuler:'Восстановить HP Владетелю: ',draw:'Взять карт: ',damageOpponent:'Урон Владетелю соперника: ',damageController:'Урон своему Владетелю: ',damageAllCreatures:'Урон всем Существам: ',reanimate:'Вернуть Существо из своего сброса на поле: ',cleanse:'Снять отрицательные статусы: ',silence:'Подавить способности: ',bind:'Сковывание: '};
  return (descriptions[e.kind]||e.kind+' ')+e.amount;
}
function chooseCards(title,choices) {
  const dialog=$('choiceDialog');let selected=null;
  $('choiceTitle').textContent=title;$('choiceSelection').textContent='Карта не выбрана';$('choiceConfirm').disabled=true;
  const views=choices.map(x=>cardButton(x.card,x.label,()=>{
    selected=x;views.forEach(view=>{const face=view.querySelector('.card'),active=view===views[choices.indexOf(x)];face.classList.toggle('active',active);face.setAttribute('aria-pressed',String(active))});
    $('choiceSelection').textContent=cardName(x.card);$('choiceConfirm').disabled=false;
  }));
  for(const view of views)view.querySelector('.card').setAttribute('aria-pressed','false');
  $('choiceCards').replaceChildren(...views);
  if(!choices.length)$('choiceCards').append(textElement('p','Нет подходящих карт. Можно закрыть это окно.','hint'));
  $('choiceConfirm').onclick=()=>{if(selected){dialog.close();selected.choose()}};
  if(!dialog.open)dialog.showModal();
}
for(const id of ['choiceCancel','choiceClose'])$(id).onclick=()=>$('choiceDialog').close();
$('choiceDialog').addEventListener('click',e=>{const d=$('choiceDialog'),r=d.getBoundingClientRect();if(e.target===d&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))d.close()});
$('rulerDraw').onclick=()=>send({type:'rulerDraw'});
function playCreature(card,index,enemy) {
  const targets=card.onEntry?.kind==='stunEnemy'
    ? [...enemy.main,...enemy.auxiliary].filter(p=>p.card.kind==='creature'&&!p.card.majestic&&!p.stunned&&!p.stasis):
    card.onEntry?.kind==='stasisEnemy'
      ? [...enemy.main,...enemy.auxiliary].filter(p=>p.card.kind==='creature'&&!p.card.majestic&&!p.stasis):[];
  if(targets.length)chooseCards('Выбери Существо противника для '+(card.onEntry.kind==='stasisEnemy'?'Стазиса':'Ошеломления'),targets.map(p=>({
    card:p.card,label:cardLabel(p),choose:()=>send({type:'playCreature',handIndex:index,targetId:p.objectId})
  })));
  else send({type:'playCreature',handIndex:index});
}
function playTechnique(card,index,me,enemy) {
  const e=card.techniqueEffect;
  if(e?.kind==='reanimate') {
    chooseCards('Вернуть Существо на поле',(me.discard||[]).flatMap((c,i)=>c.kind==='creature'?[{card:c,label:'Воскресить',choose:()=>send({type:'playTechnique',handIndex:index,discardIndex:i})}]:[]));
  } else if(['cleanse','silence','bind'].includes(e?.kind)) {
    const side=e.kind==='cleanse'?me:enemy;
    chooseCards('Выбери цель Техники',[...side.main,...side.auxiliary,...side.legends].filter(p=>!p.card.majestic&&(e.kind==='bind'?p.card.kind==='creature':true)).map(p=>({card:p.card,label:cardLabel(p),choose:()=>send({type:'playTechnique',handIndex:index,targetId:p.objectId})})));
  } else send({type:'playTechnique',handIndex:index});
}
function detailsText(card,p) {
  const bits=[];
  if(card.attack!==undefined&&card.health!==undefined)bits.push('Сила '+card.attack+' / Здоровье '+card.health);
  if(p?.silenced)bits.push('Немота');
  if(p?.stasis)bits.push('Стазис '+p.stasis);
  if(p?.stunned)bits.push('Ошеломление');
  if(p?.poison)bits.push('Отрава '+p.poison.strength+'/'+p.poison.ticks);
  if(p?.damage)bits.push('Ранения '+p.damage);
  if(p?.shield)bits.push('Щит '+p.shield);
  if(p?.loyalty!==undefined)bits.push('Лояльность '+p.loyalty);
  if(card.cost)bits.push(formatCost(card));
  if(card.produces)bits.push('Даёт энергию: '+(energyNames[card.produces]||card.produces));
  if(card.unique)bits.push('Уникальная карта');
  if(card.cannotAttack)bits.push('Не может атаковать');
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
    ['untiring','Неутомимость: не истощается при атаке, но не получает дополнительных атак'],
    ['sacrifice','Жертва: подходит для ритуального принесения в жертву'],
    ['majestic','Величественный: нельзя выбрать целью прицельной Техники или способности; атаки Существ, урон по всем Существам и эффекты боевого попадания действуют. Нельзя вытеснить из зоны или принести в Жертву']];
  const result=traits.filter(([k])=>card[k]).map(([,txt])=>txt);
  if(card.shield)result.push('Щит '+card.shield+': поглощает урон');
  if(card.cannotAttack)result.push('Не может объявлять атаки (но может быть Стражем)');
  if(card.poisonHit)result.push('Отрава '+card.poisonHit.strength+' / '+card.poisonHit.ticks);
  if(card.extraAttacks)result.push('Ещё удар! ('+card.extraAttacks+'): столько дополнительных атак за ход');
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
  $('inspectorCard').replaceChildren(cardButton(card,kindName(card.kind),()=>{},false,false,p));
  $('inspectorCard').querySelector('.inspect-card')?.remove();
  $('inspectorCard').querySelector('.card').disabled=true;
  $('inspectorStats').textContent=kindName(card.kind)+' · '+detailsText(card,p);
  $('inspectorTraits').replaceChildren(...traitDescriptions(card).map(value=>textElement('p',value,'trait-description')));
  const lore=card.lore;
  $('inspectorLore').textContent=lore?([lore.summary,lore.state,lore.organization,lore.note].filter(Boolean).join(' · ')):'';
  dialog.showModal();
}
$('inspectorClose').onclick=()=>$('cardInspector').close();
$('cardInspector').onclick=e=>{if(e.target===$('cardInspector'))$('cardInspector').close()};
function cardSummary(card,p){
 const stats=card.kind==='creature'?(card.attack??0)+'/'+Math.max(0,(card.health??0)-(p?.damage||0)):card.kind==='legend'?'Лояльность '+(p?.loyalty??card.loyalty??0):'';
 return formatCost(card)+(stats?' · '+stats:'');
}
function cardButton(card, label, onClick, disabled = false, active = false, permanent = undefined) {
  const element = button('',onClick,disabled,'card '+(card.aspects?.[0] || 'neutral')+(active?' active':''));
  if(permanent?.objectId!==undefined)element.dataset.objectId=permanent.objectId;
  element.disabled=false;
  element.classList.toggle('unavailable',disabled);
  element.dataset.actionAvailable=String(!disabled);
  element.onclick=()=>disabled?showCardDetails(card,permanent):onClick();
  element.append(textElement('span',initials(cardName(card)),'glyph'),textElement('b',cardName(card)),textElement('span','','card-art'));
  // Card is a button itself. A nested interactive element is invalid HTML and
  // mobile browsers may swallow taps; use a sibling info button instead.
  const inspect=button('i',()=>showCardDetails(card,permanent),false,'inspect-card');
  inspect.setAttribute('aria-label','Подробнее о карте '+cardName(card));
  const wrapper=document.createElement('span');wrapper.className='card-wrapper';
  wrapper.append(element,inspect);
  element.append(textElement('small',cardSummary(card,permanent),'card-summary'),textElement('small',label,'card-action-label'));
  const description=traitDescriptions(card).join(' · ')||card.lore?.summary||'';
  if(description)element.append(textElement('small',description,'card-description'));
  const flags = [['unique','Уникальная'],['guard','Страж'],['flying','Полёт'],['firstStrike','Первый удар'],
    ['piercing','Пробивание'],['lifesteal','Похищение жизни'],['stealth','Скрытность'],['majestic','Величественный'],
    ['sacrifice','Жертва'],['haste','Мгновенная атака'],['zeal','Рвение'],['untiring','Неутомимость']]
    .filter(([flag])=>card[flag]).map(([,name])=>name);
  if(card.ritual)flags.push('Ритуал '+card.ritual.threshold);
  if(card.poisonHit)flags.push('Отрава '+card.poisonHit.strength+'/'+card.poisonHit.ticks);
  if(card.shield)flags.push('Щит '+card.shield);
  if(card.abilities?.length)flags.push('⚠ Временно неактивно: '+card.abilities.join(', '));
  element.title=cardName(card)+' · '+label+(flags.length?'\n'+flags.join(' · '):'');
  element.setAttribute('aria-label',cardName(card)+' · '+cardSummary(card)+' · '+label+(flags.length?' · '+flags.join(', '):''));
  if(flags.length)element.append(textElement('small',flags.slice(0,2).join(' · ')+(flags.length>2?' · +'+(flags.length-2):''),'card-flags'));
  if(card.abilities?.length)element.append(textElement('small','⚠ Способность пока не работает','inactive-ability'));
  return wrapper;
}

return {abilityText,effectText,chooseCards,playCreature,playTechnique,detailsText,traitDescriptions,showCardDetails,cardSummary,cardButton};
}
