import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {buildLayoutCss,normalizeLayoutConfig,selectorForElement,saveLayoutConfig,loadLayoutConfig} from '../web/ui/layout-preferences.js';

test('layout editor keeps separate device rules and stable slot selectors',()=>{
 const config=normalizeLayoutConfig({version:1,profiles:{
  desktop:{'#myBoard > :nth-child(2)':{slotHeight:110,width:95}},
  phoneLandscape:{'#myBoard':{slotHeight:48,gridColumns:4}},
  phonePortrait:{'#myBoard':{slotHeight:72,gridColumns:2}}
 }});
 const css=buildLayoutCss(config);
 assert.match(css,/@media \(min-width: 751px\) and \(min-height: 521px\)/);
 assert.match(css,/#myBoard > :nth-child\(2\)\{--slot-height:110px!important;width:95px!important\}/);
 assert.match(css,/@media \(orientation: landscape\) and \(max-height: 520px\)/);
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)!important/);
 const board={nodeType:1,id:'myBoard',parentElement:null,children:[] as object[]};
 const first={nodeType:1,id:'',parentElement:board,children:[] as object[]};
 const second={nodeType:1,id:'',parentElement:board,children:[] as object[]};
 board.children=[first,second];
 assert.equal(selectorForElement(second),'#myBoard > :nth-child(2)');
});

test('layout import discards unsafe selectors and values before CSS injection',()=>{
 const config=normalizeLayoutConfig({version:1,profiles:{desktop:{
  '#myBoard{color:red}':{width:100},
  '#myBoard':{width:140,gridColumns:2.5,height:-10,background:'red',fontSize:16}
 }}});
 const css=buildLayoutCss(config);
 assert.doesNotMatch(css,/color:red|background|height:-10|2\.5/);
 assert.match(css,/#myBoard\{width:140px!important;font-size:16px!important\}/);
 const entries=new Map<string,string>();
 const storage={getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>{entries.set(key,value)}};
 saveLayoutConfig(config,storage);
 assert.deepEqual(loadLayoutConfig(storage),config);
});

test('text and border controls produce scoped CSS',()=>{
 const css=buildLayoutCss({version:1,profiles:{desktop:{'#signIn':{width:180,height:44,fontSize:18,lineHeight:24,letterSpacing:1,borderWidth:3,borderRadius:12}}}});
 assert.match(css,/#signIn\{width:180px!important;height:44px!important;font-size:18px!important;line-height:24px!important;letter-spacing:1px!important;border-style:solid!important;border-width:3px!important;border-radius:12px!important\}/);
});

test('import retains device positions, colors, fonts and individual borders safely',()=>{
 const config=normalizeLayoutConfig({version:1,profiles:{phoneLandscape:{'#chatOpen':{
  offsetX:-320,offsetY:42,zIndex:9,opacity:85,fontFamily:'georgia',fontStyle:'italic',
  borderLeftWidth:4,borderStyle:'dashed',backgroundColor:'#AABBCC',color:'#fff000',
  borderColor:'red',fontWeight:700
 }}}});
 assert.equal(config.profiles.phoneLandscape['#chatOpen'].borderColor,undefined);
 const css=buildLayoutCss(config);
 assert.match(css,/translate:-320px 42px!important/);
 assert.match(css,/border-left-width:4px!important/);
 assert.match(css,/font-family:Georgia, serif!important/);
 assert.match(css,/background-color:#aabbcc!important/);
 assert.doesNotMatch(css,/border-color:red/);
});

test('design variant survives JSON export and rejects unknown designs',()=>{
 const entries=new Map<string,string>();
 const storage={getItem:(key:string)=>entries.get(key)||null,setItem:(key:string,value:string)=>{entries.set(key,value)}};
 const config=normalizeLayoutConfig({version:1,design:'arena',profiles:{phoneLandscape:{'#hero':{width:110}}}});
 saveLayoutConfig(config,storage);
 assert.equal(loadLayoutConfig(storage).design,'arena');
 assert.equal(normalizeLayoutConfig({version:1,design:'unknown'}).design,'atlas');
});
