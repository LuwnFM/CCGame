import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {STARTER} from '../src/cards/catalog.ts';
test('gold and green defensive buffs are limited to intended named cards',()=>{
 const cards=[...STARTER.gold,...STARTER.green].map(x=>x.card);
 const byId=(id:string)=>cards.find(c=>c.id===id)!;
 assert.equal(byId('gold-дворцовый-страж').health,4);
 assert.equal(byId('gold-рыцарь-щита').shield,2);
 assert.equal(byId('gold-королевская-гвардия').shield,2);
 assert.equal(byId('green-защитник-чащи').health,4);
 assert.equal(byId('green-корневой-бастион').health,6);
 assert.equal(byId('gold-дворцовый-страж').guard,true);
 assert.equal(byId('green-защитник-чащи').guard,true);
});
