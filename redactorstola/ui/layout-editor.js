import {layoutProfiles,layoutProperties,layoutChoices,layoutColors,loadLayoutConfig,saveLayoutConfig,applyLayoutConfig,normalizeLayoutConfig,selectorForElement} from './layout-preferences.js?v=20261022b';
const $=id=>document.getElementById(id);
const frame=$('previewFrame'),area=$('previewArea'),box=$('viewportBox');
let config=loadLayoutConfig(),profile='desktop',selected=null,selector=null,interaction=false,moving=false,oldOutline='',zoomFactor=1,currentScale=1,pinchActive=false;
let fullscreenHistory=false;
const status=message=>{$('editorStatus').textContent=message};
function viewport(){return config.viewports[profile]||layoutProfiles[profile]}
function baseScale(){const {width,height}=viewport();return Math.min(1,Math.max(.1,(area.clientWidth-36)/width),Math.max(.1,(area.clientHeight-36)/height))}
function fitPreview(){
 const {width,height}=viewport();
 const scale=Math.max(.15,Math.min(4,baseScale()*zoomFactor));currentScale=scale;
 frame.style.width=width+'px';frame.style.height=height+'px';frame.style.transform=`scale(${scale})`;
 box.style.width=Math.ceil(width*scale)+'px';box.style.height=Math.ceil(height*scale)+'px';
 $('previewScale').textContent=`${width} × ${height} · ${Math.round(scale*100)}%`;
}
function setZoom(scale,x=area.getBoundingClientRect().left+area.clientWidth/2,y=area.getBoundingClientRect().top+area.clientHeight/2){
 const before=box.getBoundingClientRect();const anchorX=(x-before.left)/currentScale,anchorY=(y-before.top)/currentScale;
 zoomFactor=Math.max(.15,Math.min(4,scale))/baseScale();fitPreview();
 const after=box.getBoundingClientRect();
 area.scrollLeft+=(after.left+anchorX*currentScale)-x;
 area.scrollTop+=(after.top+anchorY*currentScale)-y;
}
function wheelZoom(event,x=event.clientX,y=event.clientY){
 event.preventDefault();setZoom(currentScale*Math.exp(-event.deltaY*.0015),x,y);
}
function pinchHandlers(target,coords){
 let start=null;
 target.addEventListener('touchstart',event=>{
  if(event.touches.length!==2)return;
  pinchActive=true;const [a,b]=[...event.touches].map(coords);
  start={distance:Math.hypot(a.x-b.x,a.y-b.y),scale:currentScale};event.preventDefault();
 },{passive:false,capture:true});
 target.addEventListener('touchmove',event=>{
  if(!start||event.touches.length!==2)return;
  event.preventDefault();const [a,b]=[...event.touches].map(coords);
  const distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(start.distance>0)setZoom(start.scale*distance/start.distance,(a.x+b.x)/2,(a.y+b.y)/2);
 },{passive:false,capture:true});
 const end=event=>{if(event.touches.length<2){start=null;pinchActive=false}};
 target.addEventListener('touchend',end,true);target.addEventListener('touchcancel',end,true);
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
 if(name==='offsetX'||name==='offsetY'||name==='order'||name==='zIndex')return 0;
 if(name==='opacity')return Math.round(Number(computed?.opacity??1)*100);
 if(name==='gridColumns')return 4;
 if(name==='slotHeight'){
   const raw=computed?.getPropertyValue('--slot-height');
   return Number.parseFloat(raw)||86;
 }
 const raw=computed?.getPropertyValue(definition.css);
 const value=Number.parseFloat(raw);
 return Number.isFinite(value)?Math.min(definition.max,Math.max(definition.min,Math.round(value*10)/10)):definition.min;
}
function setRule(name,value,save=true){
 if(!selector)return;
 config.profiles[profile][selector]={...config.profiles[profile][selector],[name]:value};
 if(save)persist();else applyLayoutConfig(config,frame.contentDocument);
 $('clearElement').disabled=false;
}
function resetRule(name){
 const rule=config.profiles[profile][selector];if(rule){delete rule[name];if(!Object.keys(rule).length)delete config.profiles[profile][selector]}
 persist();renderControls();$('clearElement').disabled=!config.profiles[profile][selector];
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
     range.value=n;number.value=n;setRule(name,n);mark();
   };
   range.oninput=()=>update(range.value);number.onchange=()=>update(number.value);
   reset.onclick=()=>resetRule(name);
 }
 for(const [name,definition] of Object.entries(layoutChoices)){
  const row=document.createElement('div');row.className='property-row';
  const label=document.createElement('label');label.textContent=definition.label;label.htmlFor='choice-'+name;
  const select=document.createElement('select');select.id='choice-'+name;
  select.append(new Option('Исходное значение',''));
  for(const choice of Object.keys(definition.values))select.append(new Option(choice==='system'?'Системный':choice==='mono'?'Моноширинный':choice,choice));
  select.value=config.profiles[profile][selector]?.[name]||'';
  select.onchange=()=>select.value?setRule(name,select.value):resetRule(name);
  row.append(label,select);root.append(row);
 }
 for(const [name,labelText] of Object.entries(layoutColors)){
  const row=document.createElement('div');row.className='property-row';
  const label=document.createElement('label');label.textContent=labelText;label.htmlFor='color-'+name;
  const input=document.createElement('input');input.type='color';input.id='color-'+name;
  const computed=selected.ownerDocument.defaultView.getComputedStyle(selected).getPropertyValue(name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase()));
  const parts=computed.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  input.value=config.profiles[profile][selector]?.[name]||(parts?'#'+parts.slice(1).map(part=>Number(part).toString(16).padStart(2,'0')).join(''):'#ffffff');
  const reset=document.createElement('button');reset.type='button';reset.textContent='↺';reset.title='Исходный цвет';reset.onclick=()=>resetRule(name);
  input.oninput=()=>setRule(name,input.value);
  row.append(label,input,reset);root.append(row);
 }
}
function bindFrame(){
 const doc=frame.contentDocument;if(!doc)return;
 doc.body.style.touchAction=moving?'none':'';
 doc.documentElement.style.touchAction='pan-x pan-y';
 doc.addEventListener('wheel',event=>{
  const rect=frame.getBoundingClientRect();wheelZoom(event,rect.left+event.clientX*currentScale,rect.top+event.clientY*currentScale);
 },{passive:false,capture:true});
 pinchHandlers(doc,touch=>{const rect=frame.getBoundingClientRect();return {x:rect.left+touch.clientX*currentScale,y:rect.top+touch.clientY*currentScale}});
 applyLayoutConfig(config,doc);
 frame.contentWindow?.FirewellLayout?.setScreen($('previewScreen').value);
 frame.contentWindow?.FirewellLayout?.showDialog($('previewDialog').value);
 doc.addEventListener('click',event=>{
   if(interaction)return;
   event.preventDefault();event.stopImmediatePropagation();
   const target=event.target.nodeType===1?event.target:event.target.parentElement;
   choose(target);
 },true);
 let drag=null;
 doc.addEventListener('pointerdown',event=>{
  if(!moving||pinchActive||event.button!==0)return;
  event.preventDefault();event.stopImmediatePropagation();
  const target=event.target.nodeType===1?event.target:event.target.parentElement;
  choose(target);
  if(!selector)return;
  drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,startX:config.profiles[profile][selector]?.offsetX||0,startY:config.profiles[profile][selector]?.offsetY||0};
  if(target.setPointerCapture)target.setPointerCapture(event.pointerId);
 },true);
 doc.addEventListener('pointermove',event=>{
  if(!drag||pinchActive||event.pointerId!==drag.pointerId||!selected)return;
  event.preventDefault();
  const x=Math.max(-1600,Math.min(1600,Math.round(drag.startX+event.clientX-drag.x)));
  const y=Math.max(-1200,Math.min(1200,Math.round(drag.startY+event.clientY-drag.y)));
  setRule('offsetX',x,false);setRule('offsetY',y,false);
 },true);
 const finish=event=>{if(drag&&event.pointerId===drag.pointerId){drag=null;persist();renderControls()}};
 doc.addEventListener('pointerup',finish,true);doc.addEventListener('pointercancel',finish,true);
 doc.addEventListener('keydown',event=>{
   if(!interaction&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopImmediatePropagation()}
 },true);
 fitPreview();
}
frame.addEventListener('load',bindFrame);
area.addEventListener('wheel',wheelZoom,{passive:false});
pinchHandlers(area,touch=>({x:touch.clientX,y:touch.clientY}));
$('zoomIn').onclick=()=>setZoom(currentScale*1.25);
$('zoomOut').onclick=()=>setZoom(currentScale/1.25);
$('zoomFit').onclick=()=>{zoomFactor=1;fitPreview();area.scrollTo(0,0)};
function closeFullscreen(fromHistory=false){
 if(!document.body.classList.contains('preview-fullscreen'))return;
 document.body.classList.remove('preview-fullscreen');
 if(document.fullscreenElement===area)document.exitFullscreen().catch(()=>{});
 if(fullscreenHistory&&!fromHistory)history.back();
 fullscreenHistory=false;
 requestAnimationFrame(fitPreview);
}
$('previewFullscreen').onclick=async()=>{
 if(document.body.classList.contains('preview-fullscreen'))return;
 document.body.classList.add('preview-fullscreen');
 history.pushState({firewellPreviewFullscreen:true},'');fullscreenHistory=true;
 try{if(area.requestFullscreen)await area.requestFullscreen()}catch{/* CSS overlay remains available on mobile browsers. */}
 requestAnimationFrame(fitPreview);
};
$('exitFullscreen').onclick=()=>closeFullscreen();
document.addEventListener('keydown',event=>{if(event.key==='Escape')closeFullscreen()});
window.addEventListener('popstate',()=>closeFullscreen(true));
document.addEventListener('fullscreenchange',()=>{
 if(!document.fullscreenElement&&document.body.classList.contains('preview-fullscreen'))closeFullscreen();
});
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
 if(interaction&&moving)$('moveMode').click();
 if(interaction&&selected)choose(null);
};
$('moveMode').onclick=()=>{
 moving=!moving;$('moveMode').setAttribute('aria-pressed',String(moving));
 $('moveMode').textContent='Перемещение: '+(moving?'включено':'выключено');
 if(moving&&interaction)$('interactionMode').click();
 frame.classList.toggle('move-active',moving);
 if(frame.contentDocument)frame.contentDocument.body.style.touchAction=moving?'none':'';
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
