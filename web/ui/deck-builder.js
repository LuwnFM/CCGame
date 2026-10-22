/** UI-only deck editor. Never decides server-side deck validity. */
export function createDeckBuilderUI({$,button,textElement,initials,cardName,kindName,status,getCatalog,getDeckIds}){
function renderBuilder() {
  const catalog=getCatalog(),deckIds=getDeckIds();
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
 return {renderBuilder};
}
