import {readdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {join,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const colors=['red','blue','green','gold','violet','neutral'];
const groups=['domains','creatures','techniques','legends','artifacts'];
const root=join(process.cwd(),'src','cards');
const check=process.argv.includes('--check');
const importRx=/import\\s+(\\w+)\\s+from\\s+['"]\\.\\/([^'"]+\\.ts)['"];?/g;
function modules(color){
 const folder=join(root,color);
 return groups.flatMap(group=>{
  const dir=join(folder,group);
  return existsSync(dir)?readdirSync(dir).filter(name=>name.endsWith('.ts')&&!name.startsWith('_'))
    .map(name=>group+'/'+name):[];
 }).sort();
}
export function syncCatalog({checkOnly=false}={}){
 let added=0;
 for(const color of colors){
  const target=join(root,color,'index.ts');
  let content=readFileSync(target,'utf8');
  const imported=new Set([...content.matchAll(importRx)].map(m=>m[2]));
  const missing=modules(color).filter(path=>!imported.has(path));
  if(!missing.length)continue;
  if(checkOnly)throw Error(color+' has unregistered card files: '+missing.join(', '));
  const index=content.indexOf('export const starter:');
  if(index<0)throw Error(color+' lacks stable starter export');
  const prior=[...content.matchAll(/import card(\\d+) from/g)].map(m=>Number(m[1]));
  let serial=Math.max(0,...prior)+1;
  const imports=missing.map(path=>({path,identifier:'addedCard'+(serial++)}));
  const lines=imports.map(v=>"import "+v.identifier+" from './"+v.path+"';").join('\\n')+'\\n';
  content=content.slice(0,index)+lines+content.slice(index);
  const regex=/export const additional:readonly Card\\[\\]=\\[([^\\]]*)\\];/;
  const match=content.match(regex);
  if(!match)throw Error(color+' has no additional catalog');
  const extension=imports.map(v=>v.identifier).join(',');
  content=content.replace(regex,(_,body)=>'export const additional:readonly Card[]=['+body+(body.trim()?',':'')+extension+'];');
  writeFileSync(target,content);
  added+=missing.length;
  process.stdout.write(color+': registered '+missing.join(', ')+' as additional cards\\n');
 }
 return added;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const count=syncCatalog({checkOnly:check});
 process.stdout.write(check?'Catalog complete\\n':'Catalog synced: '+count+' new cards\\n');
}
