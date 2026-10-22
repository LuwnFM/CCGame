import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

function sourceFiles(directory) {
  return readdirSync(directory,{withFileTypes:true}).flatMap(entry => {
    const path=join(directory,entry.name);
    return entry.isDirectory()?sourceFiles(path):path.endsWith('.ts')?[path]:[];
  });
}

test('model and mechanics stay independent from the game kernel',()=>{
  const modelFiles=sourceFiles('src/model');
  for(const path of modelFiles) {
    const source=readFileSync(path,'utf8');
    assert.doesNotMatch(source,/from\s+['"][^'"]*mechanics\//,path+' imports mechanics');
    assert.doesNotMatch(source,/from\s+['"][^'"]*ritual\.ts/,path+' imports ritual runtime');
  }

  const mechanicsFiles=sourceFiles('src/mechanics');
  for(const path of mechanicsFiles) {
    const source=readFileSync(path,'utf8');
    assert.doesNotMatch(source,/from\s+['"][^'"]*core\.ts/,path+' imports the kernel');
  }

  for(const path of sourceFiles('src')) {
    const source=readFileSync(path,'utf8');
    assert.doesNotMatch(source,/declare\s+module\s+['"][^'"]*core\.ts/,path+' augments the kernel');
  }
});
