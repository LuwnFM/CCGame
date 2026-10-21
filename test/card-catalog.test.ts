import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {ARCHETYPES,EXTRA_DOMAINS,testDeck} from '../src/decks.ts';
import {CARD_CATALOG,STARTER} from '../src/cards/catalog.ts';
import {readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';

test('all 70 positions per starter come from independently indexed color cards',()=>{
 assert.equal(ARCHETYPES.length,6);
 assert.equal(EXTRA_DOMAINS.length,50);
 assert.equal(CARD_CATALOG.length,272);
 const allIds=new Set(CARD_CATALOG.map(card=>card.id));
 assert.equal(allIds.size,CARD_CATALOG.length);
 for(const {id:color} of ARCHETYPES){
  const manifest=STARTER[color];
  assert.equal(manifest.length,37,color+' catalog identities');
  assert.equal(manifest.reduce((sum,e)=>sum+e.copies,0),70,color+' physical cards');
  const deck=testDeck(color);
  assert.equal(deck.length,70);
  assert.equal(deck.filter(card=>card.kind==='domain').length,26);
  assert.equal(deck.filter(card=>card.kind==='legend').length,2);
  assert.equal(deck.filter(card=>card.kind==='artifact').length,1);
  // There is one file per definition (including extra Domains).
  const base=join(process.cwd(),'src','cards',color);
  const count=['domains','creatures','techniques','legends','artifacts']
    .reduce((sum,dir)=>sum+readdirSync(join(base,dir)).filter(x=>x.endsWith('.ts')&&statSync(join(base,dir,x)).isFile()).length,0);
  assert.equal(count,manifest.length+(color==='neutral'?0:10));
  // A caller may safely mutate a physical copy without changing the catalog or another copy.
  const sample=manifest.find(e=>e.copies===2)!;
  const copies=deck.filter(card=>card.id===sample.card.id);
  assert.equal(copies.length,2);
  copies[0].name='Temporary test alteration';
  assert.equal(copies[1].name,sample.card.name);
  assert.equal(sample.card.name,STARTER[color].find(e=>e.card.id===sample.card.id)!.card.name);
 }
});
test('catalog retains signature token data and distinct violet summoning units',()=>{
 const violet=testDeck('violet');
 const apprentice=violet.find(card=>card.name==='Ученик Некроманта');
 assert.ok(apprentice);
 assert.equal(apprentice.onEntry?.kind,'summon');
 if(apprentice.onEntry?.kind!=='summon')throw Error('Expected data-driven summon');
 assert.deepEqual(apprentice.onEntry.cards.map(c=>[c.attack,c.health,c.sacrifice]),[[2,1,true],[1,2,true]]);
 for(const color of ARCHETYPES){
  const legend=testDeck(color.id).find(card=>card.kind==='legend'&&card.loyaltyAbilities?.[0].kind==='summon');
  assert.ok(legend,color.id);
 }
});
