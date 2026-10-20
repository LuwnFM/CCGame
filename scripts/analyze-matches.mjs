import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { analyzeArchive } from '../src/history.ts';
const input=process.argv[2]||'./match-archives';
if(!existsSync(input)){console.error('Archive not found: '+input);process.exitCode=1}
else {
 const paths=input.endsWith('.gz')?[input]:readdirSync(input).filter(f=>f.endsWith('.json.gz')).map(f=>join(input,f));
 for(const path of paths){
  try{console.log(JSON.stringify({file:path,...analyzeArchive(path)}))}
  catch(error){console.error(path,error);process.exitCode=1}
 }
}
