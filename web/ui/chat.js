/** Shared public chat for lobby, PvP and spectator views. */
export function createChatUI({$,textElement,api,refresh,status,getOlderMessages,getChatMore,getAvailableAt,setAvailableAt}) {
function renderSharedChat(data) {
  for(const chat of [$('chat'),$('matchChat'),$('spectatorChat')]){
   if(!chat)continue;
   const pinned=chat.scrollTop+chat.clientHeight>=chat.scrollHeight-20;
  const items=[...new Map([...getOlderMessages(),...data.chat].map(message=>[message.id,message])).values()].sort((a,b)=>a.id-b.id);
  chat.dataset.earliest=String(items[0]?.id||'');
  chat.replaceChildren(...items.map(message=>{
    const line=document.createElement('div');line.className='message';
    line.append(textElement('strong',message.login+' '),textElement('small','· '),
      textElement('span',message.body));
    line.title=message.accountId;return line;
  }));
  if (pinned) chat.scrollTop=chat.scrollHeight;
   $('olderChat').disabled=!getChatMore();
  }
}
function updateChatCooldown(){
  const left=Math.max(0,Math.ceil((getAvailableAt()-Date.now())/1000));
  for(const id of ['chatSubmit','matchChatSubmit','spectatorChatSubmit'])if($(id))$(id).disabled=left>0;
  for(const id of ['chatSubmit','matchChatSubmit','spectatorChatSubmit'])if($(id))$(id).textContent=left?'Отправить ('+left+'с)':'Отправить';
  $('chatCooldown').textContent=left?'Повторная отправка через '+left+' сек.':'';
}
async function sendSharedChat(event){
  event.preventDefault();if(Date.now()<getAvailableAt())return;
  try {
    const field=event.currentTarget.querySelector('input');
    const response=await api('/api/chat',{text:field.value});
    field.value='';setAvailableAt(response.nextAllowedAt||Date.now()+5000);
    updateChatCooldown();await refresh();
  } catch(e){
    const match=/Подождите (\d+) сек/.exec(e.message);
    if(match){setAvailableAt(Date.now()+Number(match[1])*1000);updateChatCooldown()}
    status(e.message);
  }
}
return {renderSharedChat,updateChatCooldown,sendSharedChat};
}
