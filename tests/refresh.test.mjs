import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {freshPageUrl,createResumeGuard} from '../assets/js/refresh.js';
import {createPullGesture} from '../assets/js/pull-refresh.js';

test('refresh URL preserves the page, filters and anchor, replacing its timestamp',()=>{
 const result=new URL(freshPageUrl('https://example.test/tournoi/public/equipes.html?division=DD&_refresh=old#tableau',123));
 assert.equal(result.pathname,'/tournoi/public/equipes.html');assert.equal(result.searchParams.get('division'),'DD');assert.equal(result.searchParams.get('_refresh'),'123');assert.equal(result.searchParams.getAll('_refresh').length,1);assert.equal(result.hash,'#tableau');
});
test('resuming requires a preceding hide and is consumed once',()=>{
 const guard=createResumeGuard();assert.equal(guard.resume(),false);guard.hide();assert.equal(guard.resume(),true);assert.equal(guard.resume(),false);
});
test('pull gesture refreshes only beyond threshold and resets after release',()=>{
 const g=createPullGesture();g.start(20,40);assert.equal(g.move(20,100).ready,false);assert.equal(g.end(),false);g.start(20,40);assert.equal(g.move(20,130).ready,true);assert.equal(g.end(),true);assert.equal(g.end(),false);
});
test('normal upward scroll, horizontal swipe and excluded areas never refresh',()=>{
 const g=createPullGesture();g.start(20,100);assert.equal(g.move(20,30).capture,false);assert.equal(g.end(),false);g.start(20,30);assert.equal(g.move(100,40).capture,false);assert.equal(g.end(),false);g.start(20,30,false);assert.equal(g.move(20,160).capture,false);
});
test('worker fetches fresh pages/scripts/styles only inside its own site',async()=>{
 const handlers={},requests=[];const self={registration:{scope:'https://example.test/tournoi/'},addEventListener:(name,handler)=>handlers[name]=handler,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 vm.runInNewContext(await readFile(new URL('../refresh-worker.js',import.meta.url),'utf8'),{self,URL,Request,Date,fetch:async req=>{requests.push(req);return {ok:true};}});
 const event=(url,mode='navigate',destination='',method='GET')=>{let response;const e={request:{url,mode,destination,method,headers:new Headers(),credentials:'same-origin'},respondWith:r=>response=r};handlers.fetch(e);return response;};
 await event('https://example.test/tournoi/public/equipes.html?division=DD');assert.equal(requests[0].cache,'no-store');const url=new URL(requests[0].url);assert.equal(url.searchParams.get('division'),'DD');assert.ok(url.searchParams.get('_network'));
 await event('https://example.test/tournoi/assets/site.css','cors','style');assert.equal(requests.length,2);
 for(const args of [['https://example.test/autre-tournoi/'],['https://database.test/rest/v1/rpc/status'],['https://example.test/tournoi/assets/icon.png','cors','image'],['https://example.test/tournoi/register','cors','', 'POST']])assert.equal(event(...args),undefined);
 assert.equal(requests.length,2);
});
