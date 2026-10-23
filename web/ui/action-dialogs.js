/** Accessible application forms and confirmations, shared with the layout editor. */
export function requestAction({title,message='',fields=[],confirmText='Подтвердить',danger=false,onSubmit}={}){
 return new Promise(resolve=>{
  const dialog=document.createElement('dialog');dialog.id='actionDialog';dialog.className='action-dialog';
  const form=document.createElement('form');form.noValidate=true;
  const head=document.createElement('div');head.className='inspector-top';
  const heading=document.createElement('h2');heading.id='actionTitle';heading.textContent=title;dialog.setAttribute('aria-labelledby',heading.id);
  const close=document.createElement('button');close.type='button';close.textContent='✕';close.className='secondary';close.setAttribute('aria-label','Закрыть');close.onclick=()=>dialog.close();head.append(heading,close);
  const description=document.createElement('p');description.textContent=message;
  const body=document.createElement('div');body.className='action-fields';
  for(const field of fields){
   const label=document.createElement('label');label.textContent=field.label;
   const input=document.createElement('input');input.name=field.name;input.id='action-'+field.name;input.type=field.type||'text';input.value=field.value||'';input.required=field.required!==false;input.autocomplete=field.autocomplete||'off';
   for(const key of ['minLength','maxLength','pattern','placeholder'])if(field[key]!==undefined)input[key]=field[key];
   label.append(input);body.append(label);
  }
  const error=document.createElement('p');error.className='action-error';error.setAttribute('role','alert');
  const footer=document.createElement('div');footer.className='dialog-footer';
  const cancel=document.createElement('button');cancel.type='button';cancel.className='secondary';cancel.textContent='Отмена';cancel.onclick=()=>dialog.close();
  const submit=document.createElement('button');submit.type='submit';submit.textContent=confirmText;if(danger)submit.className='danger';footer.append(cancel,submit);
  let result=null,pending=false;
  form.onsubmit=async event=>{
   event.preventDefault();if(pending)return;
   if(!form.checkValidity()){const input=form.querySelector(':invalid');error.textContent=input?.name==='login'?'Логин: 3–20 латинских букв, цифр или _.':input?.name==='password'?'Введи пароль профиля длиной 10–128 символов.':'Проверь обязательные поля.';input?.focus();return;}
   pending=true;submit.disabled=true;error.textContent='';
   const values=Object.fromEntries(new FormData(form));
   try{const value=onSubmit?await onSubmit(values):values;result=value??values;dialog.close()}
   catch(e){error.textContent=e.message||'Не удалось выполнить действие. Попробуй ещё раз.'}
   finally{pending=false;submit.disabled=false}
  };
  // A request in flight cannot be dismissed and then silently perform an action.
  dialog.addEventListener('cancel',e=>{if(pending)e.preventDefault()});
  for(const b of [close,cancel])b.onclick=()=>{if(!pending)dialog.close()};
  dialog.onclick=e=>{if(e.target===dialog&&!pending){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}};
  dialog.addEventListener('close',()=>{dialog.remove();resolve(result)},{once:true});
  form.append(head,description,body,error,footer);dialog.append(form);document.body.append(dialog);dialog.showModal();
  (fields.length?body.querySelector('input'):cancel).focus();
 });
}
