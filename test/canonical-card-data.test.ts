import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {CARD_CATALOG} from '../src/cards/catalog.ts';
import {SKELETON,BONE_BLADE,BONE_GUARD,CERA_SERVANT,SIGNATURE_TOKENS} from '../src/cards/tokens.ts';
import ECHO from '../src/cards/rewards/vt-echo.ts';
import MECHANISM from '../src/cards/rewards/vt-mechanism.ts';
import GUARDIAN from '../src/cards/rewards/vt-guardian.ts';
import SPECTER from '../src/cards/rewards/vt-specter.ts';
import SPARK from '../src/cards/rewards/vt-spark.ts';
const canon=new Map([...Object.values(SIGNATURE_TOKENS),SKELETON,BONE_BLADE,BONE_GUARD,CERA_SERVANT].map(c=>[c.id,c]));
function walk(dir){
 return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>
  entry.isDirectory()?walk(join(dir,entry.name)):[join(dir,entry.name)]);
}
test('all summoned token data are canonical module references, not embedded copies',()=>{
 let found=0;
 for(const card of CARD_CATALOG){
  const effects=[card.onEntry,card.secondChance,...(card.loyaltyAbilities??[])];
  for(const eff of effects)if(eff&&'cards' in eff){
   for(const token of eff.cards){
    const expected=canon.get(token.id);
    if(token.createdToken){
     assert.ok(expected,'missing standalone token for '+card.id+' / '+token.id);
     assert.equal(token,expected,'duplicate token definition in '+card.id);
     found++;
    }
   }
  }
 }
 assert.ok(found>=8,'test should exercise both legends and entry/revival summoning');
});
test('ritual reward identities are separate source modules and preserve all five offerings',()=>{
 const card=CARD_CATALOG.find(c=>c.id==='vt-ritual');
 assert.ok(card?.ritual);
 assert.deepEqual(card.ritual.rewardPool,[ECHO,MECHANISM,GUARDIAN,SPECTER,SPARK]);
 for(let i=0;i<5;i++)assert.equal(card.ritual.rewardPool[i],[ECHO,MECHANISM,GUARDIAN,SPECTER,SPARK][i]);
});
test('card source modules do not inline token stat definitions',()=>{
 for(const path of walk(join(process.cwd(),'src/cards'))){
  if(!path.endsWith('.ts'))continue;
  if(path.includes('/tokens/')||path.includes('\\tokens\\')||path.includes('/rewards/')||path.includes('\\rewards\\'))continue;
  if(path.endsWith('index.ts')||path.endsWith('catalog.ts')||path.endsWith('tokens.ts'))continue;
  const content=readFileSync(path,'utf8');
  assert.equal(/["']createdToken["']\s*:\s*true/.test(content),false,
    'embedded token data in '+path);
 }
});
test('core remains card-agnostic and never imports concrete card or effect implementations',()=>{
 const s=readFileSync(join(process.cwd(),'src/core.ts'),'utf8');
 assert.equal(/from\s+['"][^'"]*\/cards\//.test(s),false);
 assert.equal(/from\s+['"][^'"]*\/effects\//.test(s),false);
 assert.equal(/SKELETON|CERA_SERVANT|SIGNATURE_TOKENS|summonBonePair|summonSkeleton/.test(s),false);
});
