import {layoutProfiles,layoutProperties,loadLayoutConfig,saveLayoutConfig,applyLayoutConfig,normalizeLayoutConfig,selectorForElement} from './layout-preferences.js';
const $=id=>document.getElementById(id);
const frame=$('previewFrame'),area=$('previewArea'),box=$('viewportBox');
let config=loadLayoutConfig(),profile='desktop',selected=null,selector=null,interaction=false,oldOutline='';
const status=message=>{$('editorStatus').textContent=message};
function viewport(){return config.viewports[profile]||layoutProfiles[profile]}
function fitPreview(){
 const {width,height}=viewport();
 const scale=Math.min(1,Math.max(.1,(area.clientWidth-36)/width),Math.max(.1,(area.clientHeight-36)/height));
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${scale})`;
 box.style.width=Math.ceil(width*scale)+'px';box.style.height=Math.ceil(height*scale)+'px';
 $('previewScale').textContent=`${width} × ${height} · ${Math.round(scale*100)}%`;
}
function persist(){config=saveLayoutConfig(config);if(frame.contentDocument)applyLayoutConfig(config,frame.contentDocument);status('Сохранено в этом браузере')}
function setProfile(next){
 profile=next;for(const button of document.querySelectorAll('[data-profile]'))button.setAttribute('aria-pressed',String(button.dataset.profile===profile));
 const size=viewport();$('viewportWidth').value=size.width;$('viewportHeight').value=size.height;
 fitPreview();renderControls();
}
function choose(element){
 if(selected)selected.style.outline=oldOutline;
 selected=element;selector=element?selectorForElement(element):null;
 oldOutline=element?.style.outline||'';
 if(element)element.style.outline='3px solid #ffca72';
 const caption=element?(element.id?'#'+element.id:element.tagName.toLowerCase()+' · '+(element.textContent||'').trim().slice(0,45)):'Нажми на элемент справа.';
 $('selectedName').textContent=caption;$('selectedSelector').textContent=selector||'';
 $('selectParent').disabled=!element?.parentElement || element.parentElement===frame.contentDocument.documentElement;
 $('clearElement').disabled=!selector || !config.profiles[profile][selector];
 renderControls();
}
function controlValue(name){
 const override=selector && config.profiles[profile][selector]?.[name];
 if(override!==undefined)return override;
 const definition=layoutProperties[name];
 const computed=selected?.ownerDocument.defaultView.getComputedStyle(selected);
 if(name==='gridColumns')return 4;
 if(name==='slotHeight'){
   const raw=computed?.getPropertyValue('--slot-height');
   return Number.parseFloat(raw)||86;
 }
 const raw=computed?.getPropertyValue(definition.css);
 const value=Number.parseFloat(raw);
 return Number.isFinite(value)?Math.min(definition.max,Math.max(definition.min,Math.round(value*10)/10)):definition.min;
}
function renderControls(){
 const root=$('propertyControls');root.replaceChildren();
 if(!selected||!selector){root.textContent='Выбери элемент в предпросмотре, чтобы настроить его.';return}
 const board=selected.classList.contains('board');
 for(const [name,definition] of Object.entries(layoutProperties)){
   if(definition.board&&!board)continue;
   if(name==='flexBasis'&&!selected.classList.contains('card-wrapper')&&!selected.classList.contains('hand'))continue;
   const row=document.createElement('div');row.className='property-row';
   const label=document.createElement('label');label.textContent=definition.label;label.htmlFor='property-'+name;
   const range=document.createElement('input');range.type='range';range.min=definition.min;range.max=definition.max;range.step=name==='gridColumns'?'1':'1';range.value=controlValue(name);range.id='property-'+name;
   const number=document.createElement('input');number.type='number';number.min=definition.min;number.max=definition.max;number.step=name==='gridColumns'?'1':'0.1';number.value=controlValue(name);number.setAttribute('aria-label',definition.label);
   const reset=document.createElement('button');reset.type='button';reset.textContent='↺';reset.title='Вернуть исходный размер';reset.setAttribute('aria-label','Сбросить '+definition.label);
   const note=document.createElement('small');note.textContent=definition.unit||'колонок';
   row.append(label,range,number,reset,note);root.append(row);
   const mark=()=>row.classList.toggle('is-default',config.profiles[profile][selector]?.[name]===undefined);mark();
   const update=value=>{
     const n=Number(value);if(!Number.isFinite(n)||n<definition.min||n>definition.max||name==='gridColumns'&&!Number.isInteger(n))return;
     const rule={...config.profiles[profile][selector],[name]:n};config.profiles[profile][selector]=rule;
     range.value=n;number.value=n;persist();mark();$('clearElement').disabled=false;
   };
   range.oninput=()=>update(range.value);number.onchange=()=>update(number.value);
   reset.onclick=()=>{
     const rule=config.profiles[profile][selector];if(rule){delete rule[name];if(!Object.keys(rule).length)delete config.profiles[profile][selector]}
     persist();renderControls();$('clearElement').disabled=!config.profiles[profile][selector];
   };
 }
}
function bindFrame(){
 const doc=frame.contentDocument;if(!doc)return;
 applyLayoutConfig(config,doc);
 frame.contentWindow?.FirewellLayout?.setScreen($('previewScreen').value);
 frame.contentWindow?.FirewellLayout?.showDialog($('previewDialog').value);
 doc.addEventListener('click',event=>{
   if(interaction)return;
   event.preventDefault();event.stopImmediatePropagation();
   const target=event.target.nodeType===1?event.target:event.target.parentElement;
   choose(target);
 },true);
 doc.addEventListener('keydown',event=>{
   if(!interaction&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 fitPreview();
}
frame.addEventListener('load',bindFrame);
function switchPreview(){choose(null);frame.contentWindow?.FirewellLayout?.setScreen($('previewScreen').value);frame.contentWindow?.FirewellLayout?.showDialog($('previewDialog').value)}
$('previewScreen').onchange=switchPreview;
$('previewDialog').onchange=switchPreview;
for(const button of document.querySelectorAll('[data-profile]'))button.onclick=()=>setProfile(button.dataset.profile);
for(const [id,key] of [['viewportWidth','width'],['viewportHeight','height']])$(id).onchange=()=>{
 const value=Number($(id).value),limits=key==='width'?[320,2560]:[300,1600];
 if(!Number.isInteger(value)||value<limits[0]||value>limits[1]){$(id).value=viewport()[key];return}
 config.viewports[profile]={width:viewport().width,height:viewport().height,[key]:value};persist();fitPreview();
};
$('interactionMode').onclick=()=>{
 interaction=!interaction;$('interactionMode').setAttribute('aria-pressed',String(interaction));
 $('interactionMode').textContent='Режим просмотра: '+(interaction?'включён':'выключен');
 if(interaction&&selected)choose(null);
};
$('selectParent').onclick=()=>{if(selected?.parentElement)choose(selected.parentElement)};
$('clearElement').onclick=()=>{
 if(!selector)return;delete config.profiles[profile][selector];persist();renderControls();$('clearElement').disabled=true;
};
$('resetProfile').onclick=()=>{
 if(!confirm('Сбросить все размеры для устройства «'+layoutProfiles[profile].name+'»?'))return;
 config.profiles[profile]={};delete config.viewports[profile];persist();setProfile(profile);status('Размеры этого устройства сброшены');
};
$('downloadLayout').onclick=()=>{
 const file=new Blob([JSON.stringify(config,null,2)],{type:'application/json'}),url=URL.createObjectURL(file),link=document.createElement('a');
 link.href=url;link.download='firewell-layout.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
};
$('importLayout').onchange=async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
   if(file.size>1024*1024)throw Error('Файл слишком большой');
   const parsed=JSON.parse(await file.text());if(parsed.version!==1)throw Error('Нужен файл редактора версии 1');
   config=saveLayoutConfig(normalizeLayoutConfig(parsed));
   if(selected){selected.style.outline=oldOutline;selected=null;selector=null}
   if(frame.contentDocument)applyLayoutConfig(config,frame.contentDocument);
   setProfile(profile);choose(null);status('Настройки загружены');
 }catch(error){status('Не удалось загрузить: '+error.message)}
 finally{event.target.value=''}
};
new ResizeObserver(fitPreview).observe(area);
setProfile(profile);
