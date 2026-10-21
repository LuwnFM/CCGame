import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {STARTER} from '../src/cards/catalog.ts';
test('red starter has explicit balanced Haste, Zeal and Extra Attacks profiles',()=>{
 const cards=STARTER.red.map(x=>x.card).filter(c=>c.kind==='creature');
 const haste=cards.filter(c=>c.haste); const zeal=cards.filter(c=>c.zeal); const double=cards.filter(c=>(c.extraAttacks??0)>0);
 assert.deepEqual(haste.map(c=>[c.id,c.attack]),[
  ['red-разведчик-с-перевала',1],['red-пламенный-авангард',3]
 ]);
 assert.deepEqual(zeal.map(c=>[c.id,c.health]),[
  ['red-таранный-всадник',1],['red-молотобоец-королевства',2]
 ]);
 assert.equal(double.length,1);
 const heavy=double[0];
 assert.equal(heavy.id,'red-двукратный-натиск');
 assert.deepEqual([heavy.attack,heavy.health,heavy.cost?.colored.red,heavy.cost?.generic,heavy.extraAttacks],[4,7,1,7,1]);
 assert.ok((heavy.health??0)>(heavy.attack??0));
});
