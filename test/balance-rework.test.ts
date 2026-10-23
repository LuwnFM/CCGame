import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {apply,initialGame,player,type Card,type Game} from '../src/core.ts';
import {CARD_CATALOG} from '../src/cards/catalog.ts';
import {invokeEffect} from '../src/mechanics/effects-registry.ts';
import {neutralAffinityActive} from '../src/mechanics/rules/neutral-affinity.ts';
import {placePermanent} from '../src/mechanics/zones.ts';
import {emitGameEvent} from '../src/mechanics/events.ts';
import {healFromLifesteal} from '../src/mechanics/traits/lifesteal.ts';
const body:Card={id:'test-body',name:'Body',kind:'creature',attack:2,health:6};
const color:Card={...body,id:'colored',aspects:['red']};
const domain:Card={id:'domain',name:'Domain',kind:'domain',produces:'red'};
const source:Card={id:'source',name:'Source',kind:'technique'};
function game(){const g=initialGame(player(Array(20).fill(body)),player());g.turn=1;return g;}
function effect(g:Game,kind:string,amount:number,card=source,extra={}){invokeEffect('technique',kind,{game:g,actor:0,source:card,amount,...extra});}
test('healing and lifesteal cap at 40, never reduce existing HP, and use actual damage',()=>{
 for(const hp of [25,30,39,40,45]){const g=game();g.players[0].hp=hp;effect(g,'healRuler',4);assert.equal(g.players[0].hp,Math.max(hp,Math.min(40,hp+4)));
 const unit=placePermanent(g,0,'main',{...body,lifesteal:true});g.players[0].hp=hp;healFromLifesteal(g.players[0],unit,3);assert.equal(g.players[0].hp,Math.max(hp,Math.min(40,hp+3)));unit.silenced=true;g.players[0].hp=hp;healFromLifesteal(g.players[0],unit,3);assert.equal(g.players[0].hp,hp);}
});
test('original-deck condition survives drawing/discarding colored cards; domains are exempt; legacy games have no speculative bonus',()=>{
 const card={...source,neutralAffinity:{zone:'deck' as const,bonus:1}};
 const p=player([color,domain]);assert.equal(neutralAffinityActive(p,card),false);p.deck=[];assert.equal(neutralAffinityActive(p,card),false);
 assert.equal(neutralAffinityActive(player([body,domain]),card),true);delete p.startingDeckHasColored;assert.equal(neutralAffinityActive(p,card),false);
});
test('hand condition uses hand after payment, battlefield condition sees colored tokens and silenced units',()=>{
 const g=game(),p=g.players[0],card={...source,neutralAffinity:{zone:'hand' as const,bonus:1}};
 p.hand=[domain];assert.equal(neutralAffinityActive(p,card),true);p.hand.push(color);assert.equal(neutralAffinityActive(p,card),false);
 const board={...card,neutralAffinity:{zone:'battlefield' as const,bonus:1}};
 p.domains=[placePermanent(g,0,'domains',domain)];assert.equal(neutralAffinityActive(p,board),true);
 const u=placePermanent(g,0,'auxiliary',{...color,createdToken:true});u.silenced=true;assert.equal(neutralAffinityActive(p,board),false);
 p.auxiliary=[];assert.equal(neutralAffinityActive(p,board),true);
});
test('neutral Stasis technique changes duration with hand condition, excludes Majestic and rolls back invalid payment',()=>{
 const card=CARD_CATALOG.find(c=>c.id==='neutral-указ-хранителей')!;
 for(const colored of [false,true]){const g=game();g.players[0].hand=[card,...(colored?[color]:[])];g.players[0].energy.neutral=4;const target=placePermanent(g,1,'main',body);
 const next=apply(g,{type:'playTechnique',actor:0,handIndex:0,targetId:target.objectId,key:'play',expectedRevision:0});assert.equal(next.players[1].main[0].stasis,colored?1:2);assert.equal(next.players[0].energy.neutral,0);
 target.card={...body,majestic:true};assert.throws(()=>apply(g,{type:'playTechnique',actor:0,handIndex:0,targetId:target.objectId,key:'bad',expectedRevision:0}));assert.equal(g.players[0].energy.neutral,4);assert.equal(g.players[0].hand[0],card);}
});
test('team shield is a floor, does not stack, includes Majestic; mending heals damage rather than max health',()=>{
 const g=game(),a=placePermanent(g,0,'main',{...body,majestic:true}),b=placePermanent(g,0,'auxiliary',{...body,createdToken:true});a.damage=4;b.shield=5;
 effect(g,'shieldTeam',2);effect(g,'shieldTeam',2);assert.equal(a.shield,2);assert.equal(b.shield,5);effect(g,'mendTeam',2);assert.equal(a.damage,2);assert.equal(a.card.health,6);assert.equal(b.damage,0);
});
test('item engines trigger only on controller turn, stop under silence/stasis, and distinguish all six items',()=>{
 const items=CARD_CATALOG.filter(c=>c.kind==='artifact');assert.equal(new Set(items.map(c=>JSON.stringify([c.auraAttack,c.turnStartEffect,c.neutralAffinity]))).size,6);
 const card=items.find(c=>c.aspects?.[0]==='violet')!;
 for(const state of ['active','silenced','stasis','enemy'] as const){const g=game();const u=placePermanent(g,0,'auxiliary',card);g.players[0].hp=10;u.silenced=state==='silenced';u.stasis=state==='stasis'?1:undefined;
 emitGameEvent(g,{type:'turnStart',owner:state==='enemy'?1:0});assert.equal(g.players[0].hand.length,state==='active'?2:0);assert.equal(g.players[0].hp,state==='active'?8:10);}
 const g=game();placePermanent(g,0,'auxiliary',card);g.players[0].hp=2;emitGameEvent(g,{type:'turnStart',owner:0});assert.equal(g.players[0].hp,2);assert.equal(g.players[0].hand.length,0);
});
test('colored removal damages creatures, not rulers; Majestic rejects manual removal',()=>{
 const g=game(),u=placePermanent(g,1,'main',body);effect(g,'damageCreature',4,source,{targetId:u.objectId});assert.equal(u.damage,4);assert.equal(g.players[1].hp,40);u.card={...body,majestic:true};assert.throws(()=>effect(g,'damageCreature',4,source,{targetId:u.objectId}));
});
test('neutral catalog has no direct damage or haste/piercing pressure, five distinct Majestic bodies and no cheaper unconditional draw-two',()=>{
 const cards=CARD_CATALOG.filter(c=>c.kind!=='domain'&&!c.aspects?.length);
 for(const c of cards){assert.ok(!c.haste&&!c.piercing,c.name);for(const e of [c.onEntry,c.onDeath,c.techniqueEffect,...(c.loyaltyAbilities??[])])assert.ok(!e||!['damageOpponent','damageCreature','damageAllCreatures'].includes(e.kind),c.name);}
 assert.equal(cards.filter(c=>c.kind==='creature'&&c.majestic).length,5);
 const draw=cards.find(c=>c.id==='neutral-полевое-снабжение')!;assert.deepEqual(draw.techniqueEffect,{kind:'draw',amount:1});assert.equal(draw.neutralAffinity?.zone,'deck');
});
