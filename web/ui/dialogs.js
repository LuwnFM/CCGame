/** Owns only match choice screens. The game state remains immutable and server-owned. */
export function createMatchDialogs({$,button,cardButton,kindName,cardLabel,send}){
 return function renderMatchDialogs({game,me,seat,selectedMulligan,selectedVictims,
  selectedRitual,setSelectedRitual,selectedReward,setSelectedReward,
  selectedRewardKeepExisting,setSelectedRewardKeepExisting,rerender}){
  $('mulligan').classList.toggle('hidden',game.phase!=='mulligan');
  $('ritual').classList.toggle('hidden',game.phase!=='ritual'||seat!==game.active);
  $('reward').classList.toggle('hidden',game.phase!=='reward'||seat!==game.active);
  document.querySelectorAll('.playarea').forEach(x=>x.classList.toggle('hidden',['mulligan','ritual','reward'].includes(game.phase)));
  if(game.phase==='mulligan') {
    const done=game.mulliganReady[seat];$('mulliganHand').replaceChildren();
    if(!done)(me.hand||[]).forEach((c,i)=>$('mulliganHand').append(cardButton(c,kindName(c.kind),()=>{selectedMulligan.has(i)?selectedMulligan.delete(i):selectedMulligan.add(i);rerender()},false,selectedMulligan.has(i))));
    $('confirmMulligan').disabled=done;$('mulliganWait').textContent=done?'Ответ принят. Ожидание соперника.':'Отмечено на замену: '+selectedMulligan.size;
    return true;
  }
  if(game.phase==='ritual') {
    const sources=game.readyRituals||[];
    if(!sources.some(r=>r.id===selectedRitual)){setSelectedRitual(sources[0]?.id);selectedVictims.clear()}
    const active=sources.find(r=>r.id===selectedRitual);
    $('ritualSources').replaceChildren(...sources.map(r=>button(r.color+' · Жертва '+r.threshold,()=>{setSelectedRitual(r.id);selectedVictims.clear();rerender()},false,r.id===selectedRitual?'secondary':'')));
    $('ritualVictims').replaceChildren(...[...me.main,...me.auxiliary].filter(p=>active?.eligibleIds.includes(p.objectId))
      .map(p=>cardButton(p.card,cardLabel(p),()=>{selectedVictims.has(p.objectId)?selectedVictims.delete(p.objectId):selectedVictims.add(p.objectId);rerender()},false,selectedVictims.has(p.objectId))));
    $('confirmRitual').disabled=selectedVictims.size!==active?.threshold;return true;
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
      else{setSelectedReward(c.id);setSelectedRewardKeepExisting(keepExisting);rerender()}
    },false,selectedReward===c.id)));
    const reward=offers.find(c=>c.id===selectedReward),zone=reward?.createdToken?me.auxiliary:me.main;
    const existing=reward?.unique?[...me.main,...me.auxiliary].find(p=>p.card.name===reward.name):undefined;
    const remaining=existing&&selectedRewardKeepExisting===false?zone.filter(p=>p.objectId!==existing.objectId):zone;
    $('rewardReplacements').replaceChildren(...(reward&&remaining.length>=(reward.createdToken?4:8)
      ?remaining.filter(p=>!p.card.majestic).map(p=>cardButton(p.card,'Заменить · '+cardLabel(p),
         ()=>send({type:'chooseReward',rewardId:reward.id,replaceId:p.objectId,keepExisting:selectedRewardKeepExisting}))):[]));
    return true;
  }
  return false;
 };
}
