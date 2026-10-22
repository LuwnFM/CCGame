/** Read-only projection of server-authoritative battle state into the board DOM.
 * Interactions dispatch callbacks; this module never mutates the game.
 */
export function createBattlefieldUI({$,button,textElement,cardButton,cardLabel,showCardDetails,send}){
 return function renderBattlefield({me,enemy,mine,defense,attack,incoming,target,selected,defenderChoice,rerender,onSelected,onDefenderChoice}){
  $('enemyLegends').replaceChildren(...enemy.legends.map(p=>{
    const el=cardButton(p.card,cardLabel(p),()=>send({type:'attack',attackerId:selected,target:{kind:'legend',objectId:p.objectId}}),!mine||selected===null,false,p);
    return el;
  }));
  for(const [id,zone] of [['myBoard',me.main],['myAux',me.auxiliary]]) {
    $(id).replaceChildren(...zone.map(p=>cardButton(p.card,cardLabel(p),()=>{
      if(defense){onDefenderChoice(p.objectId);rerender()}
      else{onSelected(p.card.cannotAttack?null:p.objectId);rerender()}
    },p.card.kind!=='creature'||(!defense&&!mine)||!!p.stasis||(!defense&&!!p.stunned)||p.exhausted||(!defense&&!!p.card.cannotAttack)||
      (defense&&(p.interceptions>0||(attack?.target?.kind==='creature'&&(!p.card.guard||p.silenced))||
        (incoming?.card.flying&&!incoming.silenced&&(!p.card.flying||p.silenced)))),selected===p.objectId||defenderChoice===p.objectId,p)));
  }
  for(const [id,zone] of [['enemyBoard',enemy.main],['enemyAux',enemy.auxiliary]])
    $(id).replaceChildren(...zone.map(p=>{
      const el=cardButton(p.card,cardLabel(p),
        ()=>send({type:'attack',attackerId:selected,target:{kind:'creature',objectId:p.objectId}}),
        !mine||selected===null||p.card.kind!=='creature'||!!p.card.stealth&&!p.silenced&&!p.stasis,false,p);
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
    const wrapper=document.createElement('span');wrapper.className='domain-item';
    const el=button(domainLabels[p.card.produces]||'◇',()=>send({type:'tapDomain',objectId:p.objectId}),
      !mine||p.exhausted,'domain-chip '+(p.card.produces||'neutral')+(p.exhausted?' spent':''));
    el.title=p.card.name+(p.exhausted?' · истощено':' · готово');
    el.setAttribute('aria-label','Получить Энергию: '+el.title);
    const inspect=button('ⓘ',()=>showCardDetails(p.card,p),false,'domain-inspect');
    inspect.setAttribute('aria-label','Подробнее о Владении '+p.card.name);
    wrapper.append(el,inspect);
    return wrapper;
  }));
  $('enemyDomainCount').textContent=String(enemy.domains.length);
  $('enemyDomains').replaceChildren(...enemy.domains.map(p=>{
    const el=button(domainLabels[p.card.produces]||'◇',()=>showCardDetails(p.card,p),false,
      'domain-chip '+(p.card.produces||'neutral')+(p.exhausted?' spent':''));
    el.title=p.card.name+(p.exhausted?' · истощено':' · готово');
    el.setAttribute('aria-label','Подробнее о Владении соперника '+el.title);
    return el;
  }));
 };
}
