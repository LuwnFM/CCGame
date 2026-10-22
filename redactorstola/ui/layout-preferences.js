/** Local, per-device layout overrides shared by the game and the visual editor. */
export const layoutStorageKey = 'firewell_layout_v1';
export const layoutProfiles = {
  desktop: {name:'Компьютер',width:1920,height:1080,media:'(min-width: 751px) and (min-height: 521px)'},
  phoneLandscape: {name:'Телефон горизонтально',width:844,height:390,media:'(orientation: landscape) and (max-height: 520px)'},
  phonePortrait: {name:'Телефон вертикально',width:390,height:844,media:'(orientation: portrait) and (max-width: 750px)'}
};
export const layoutProperties = {
  width:{label:'Ширина',min:0,max:1800,css:'width',unit:'px'},
  height:{label:'Высота',min:0,max:1200,css:'height',unit:'px'},
  minWidth:{label:'Минимальная ширина',min:0,max:1200,css:'min-width',unit:'px'},
  minHeight:{label:'Минимальная высота',min:0,max:1000,css:'min-height',unit:'px'},
  maxWidth:{label:'Максимальная ширина',min:0,max:1800,css:'max-width',unit:'px'},
  maxHeight:{label:'Максимальная высота',min:0,max:1200,css:'max-height',unit:'px'},
  fontSize:{label:'Размер текста',min:6,max:64,css:'font-size',unit:'px'},
  fontWeight:{label:'Толщина шрифта',min:100,max:900,css:'font-weight',unit:''},
  lineHeight:{label:'Высота строки',min:6,max:110,css:'line-height',unit:'px'},
  letterSpacing:{label:'Расстояние между буквами',min:0,max:20,css:'letter-spacing',unit:'px'},
  borderWidth:{label:'Толщина рамки',min:0,max:20,css:'border-width',unit:'px'},
  borderTopWidth:{label:'Рамка сверху',min:0,max:20,css:'border-top-width',unit:'px'},
  borderRightWidth:{label:'Рамка справа',min:0,max:20,css:'border-right-width',unit:'px'},
  borderBottomWidth:{label:'Рамка снизу',min:0,max:20,css:'border-bottom-width',unit:'px'},
  borderLeftWidth:{label:'Рамка слева',min:0,max:20,css:'border-left-width',unit:'px'},
  padding:{label:'Внутренний отступ',min:0,max:120,css:'padding',unit:'px'},
  margin:{label:'Внешний отступ',min:0,max:120,css:'margin',unit:'px'},
  gap:{label:'Промежуток',min:0,max:100,css:'gap',unit:'px'},
  borderRadius:{label:'Скругление',min:0,max:80,css:'border-radius',unit:'px'},
  offsetX:{label:'Сдвиг вправо / влево',min:-1600,max:1600,css:'',unit:'px'},
  offsetY:{label:'Сдвиг вниз / вверх',min:-1200,max:1200,css:'',unit:'px'},
  order:{label:'Порядок в ряду',min:-20,max:20,css:'order',unit:''},
  zIndex:{label:'Поверх других',min:0,max:100,css:'z-index',unit:''},
  opacity:{label:'Непрозрачность, %',min:0,max:100,css:'',unit:'%'},
  flexBasis:{label:'Ширина карты в руке',min:30,max:360,css:'flex-basis',unit:'px'},
  slotHeight:{label:'Высота ячейки поля',min:32,max:240,css:'--slot-height',unit:'px',board:true},
  gridColumns:{label:'Колонок в поле',min:1,max:8,css:'grid-template-columns',unit:'',board:true}
};
export const layoutChoices={
  fontFamily:{label:'Шрифт',css:'font-family',values:{system:'system-ui, sans-serif',arial:'Arial, sans-serif',georgia:'Georgia, serif',trebuchet:'"Trebuchet MS", sans-serif',mono:'ui-monospace, monospace'}},
  fontStyle:{label:'Начертание',css:'font-style',values:{normal:'normal',italic:'italic'}},
  textAlign:{label:'Выравнивание текста',css:'text-align',values:{left:'left',center:'center',right:'right'}},
  borderStyle:{label:'Стиль рамки',css:'border-style',values:{solid:'solid',dashed:'dashed',dotted:'dotted',double:'double',none:'none'}},
  alignSelf:{label:'Положение в ячейке',css:'align-self',values:{auto:'auto',start:'start',center:'center',end:'end',stretch:'stretch'}}
};
export const layoutColors={color:'Цвет текста',backgroundColor:'Цвет фона',borderColor:'Цвет рамки'};
const safeColor=/^#[0-9a-fA-F]{6}$/;
const safeSelector = /^#[A-Za-z][\w-]*(?:\s*>\s*:nth-child\([1-9][0-9]*\))*$/;
export const layoutDesigns={atlas:'Атлас · тактический стол',citadel:'Цитадель · боевые ряды',arena:'Очаг · открытая арена'};
export const defaultLayoutDesigns={desktop:'atlas',phoneLandscape:'arena',phonePortrait:'arena'};
const empty = () => ({version:1,design:'atlas',designs:{...defaultLayoutDesigns},profiles:{desktop:{},phoneLandscape:{},phonePortrait:{}},viewports:{}});
export function normalizeLayoutConfig(source) {
  const result=empty();
  if(!source || typeof source!=='object' || Array.isArray(source) || source.version!==1) return result;
  if(Object.hasOwn(layoutDesigns,source.design))result.design=source.design;
  for(const profile of Object.keys(layoutProfiles)){
    if(Object.hasOwn(layoutDesigns,source.designs?.[profile]))result.designs[profile]=source.designs[profile];
    const rules=source.profiles?.[profile];
    if(rules && typeof rules==='object' && !Array.isArray(rules)){
      for(const [selector,values] of Object.entries(rules)){
        if(!safeSelector.test(selector) || selector.length>240 || !values || typeof values!=='object' || Array.isArray(values))continue;
        const clean={};
        for(const [name,value] of Object.entries(values)){
          const definition=layoutProperties[name];
          if(definition && typeof value==='number' && Number.isFinite(value) && value>=definition.min && value<=definition.max && (name!=='gridColumns'||Number.isInteger(value)))
            clean[name]=Math.round(value*10)/10;
          else if(layoutChoices[name] && typeof value==='string' && Object.hasOwn(layoutChoices[name].values,value))clean[name]=value;
          else if(Object.hasOwn(layoutColors,name) && typeof value==='string' && safeColor.test(value))clean[name]=value.toLowerCase();
        }
        if(Object.keys(clean).length)result.profiles[profile][selector]=clean;
      }
    }
    const view=source.viewports?.[profile];
    if(view && Number.isInteger(view.width) && Number.isInteger(view.height) && view.width>=320 && view.width<=2560 && view.height>=300 && view.height<=1600)
      result.viewports[profile]={width:view.width,height:view.height};
  }
  return result;
}
export function buildLayoutCss(config) {
  const normalized=normalizeLayoutConfig(config);
  return Object.entries(layoutProfiles).map(([profile,{media}])=>{
    const rules=Object.entries(normalized.profiles[profile]).map(([selector,values])=>{
      const declarations=Object.entries(values).flatMap(([name,value])=>{
        if(name==='gridColumns')return `grid-template-columns:repeat(${value},minmax(0,1fr))!important`;
        if(name==='offsetX'||name==='offsetY')return [];
        if(name==='opacity')return `opacity:${value/100}!important`;
        if(name==='zIndex')return `position:relative!important;z-index:${value}!important`;
        if(name==='borderWidth'||name.startsWith('border')&&name.endsWith('Width'))return `border-style:${layoutChoices.borderStyle.values[values.borderStyle]||'solid'}!important;${layoutProperties[name].css}:${value}px!important`;
        if(layoutChoices[name])return `${layoutChoices[name].css}:${layoutChoices[name].values[value]}!important`;
        if(Object.hasOwn(layoutColors,name))return `${name.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}:${value}!important`;
        const {css,unit}=layoutProperties[name];return `${css}:${value}${unit}!important`;
      });
      if(values.offsetX!==undefined||values.offsetY!==undefined)declarations.push(`translate:${values.offsetX||0}px ${values.offsetY||0}px!important`);
      return `${selector}{${declarations.join(';')}}`;
    });
    return rules.length?`@media ${media}{${rules.join('\n')}}`:'';
  }).filter(Boolean).join('\n');
}
export function loadLayoutConfig(storage=globalThis.localStorage) {
  try {return normalizeLayoutConfig(JSON.parse(storage.getItem(layoutStorageKey)||'null'))}
  catch {return empty()}
}
export function saveLayoutConfig(config,storage=globalThis.localStorage) {
  const normalized=normalizeLayoutConfig(config);
  storage.setItem(layoutStorageKey,JSON.stringify(normalized));
  return normalized;
}
export function applyLayoutConfig(config,documentRef=globalThis.document,profile=null){
  const normalized=normalizeLayoutConfig(config);
  if(profile&&documentRef.body)documentRef.body.dataset.layoutProfile=profile;
  const device=profile||documentRef.body?.dataset.layoutProfile||['phoneLandscape','phonePortrait'].find(key=>documentRef.defaultView?.matchMedia(layoutProfiles[key].media).matches)||'desktop';
  if(documentRef.body)documentRef.body.dataset.design=normalized.designs[device]||defaultLayoutDesigns.desktop;
  let style=documentRef.getElementById('firewell-layout-overrides');
  if(!style){style=documentRef.createElement('style');style.id='firewell-layout-overrides';documentRef.head.append(style)}
  style.textContent=buildLayoutCss(config);
}
export function applySavedLayout(documentRef=globalThis.document){
  applyLayoutConfig(loadLayoutConfig(),documentRef);
  documentRef.defaultView?.addEventListener('resize',()=>applyLayoutConfig(loadLayoutConfig(),documentRef));
}
/** Anchor at the nearest stable ID; child positions survive replacing an empty slot by a card. */
export function selectorForElement(element){
  const steps=[];
  for(let current=element;current && current.nodeType===1;current=current.parentElement){
    if(current.id && /^[A-Za-z][\w-]*$/.test(current.id))return '#'+current.id+steps.reverse().join('');
    const parent=current.parentElement;
    if(!parent)break;
    steps.push(` > :nth-child(${Array.prototype.indexOf.call(parent.children,current)+1})`);
  }
  return null;
}
