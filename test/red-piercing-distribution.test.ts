import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {STARTER} from '../src/cards/catalog.ts';
test('red Zeal and Piercing do not overlap; Piercing is assigned to two formerly vanilla cards',()=>{
 const creatures=STARTER.red.filter(x=>x.card.kind==='creature');
 const zeal=creatures.filter(x=>x.card.zeal);
 const piercing=creatures.filter(x=>x.card.piercing);
 assert.deepEqual(zeal.map(x=>x.card.id),['red-таранный-всадник','red-молотобоец-королевства']);
 assert.deepEqual(piercing.map(x=>x.card.id),['red-кузнец-заставы','red-тяжёлый-пехотинец']);
 assert.ok(zeal.every(x=>!x.card.piercing));
 assert.ok(piercing.every(x=>!x.card.zeal));
 assert.equal(zeal.reduce((n,x)=>n+x.copies,0),4);
 assert.equal(piercing.reduce((n,x)=>n+x.copies,0),4);
});
