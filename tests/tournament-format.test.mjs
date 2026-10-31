import assert from 'node:assert/strict';
import {formatFor,roundRobin,fixturesFor,scheduleDraws,slotFor} from '../assets/js/tournament-format.js';
for(let n=3;n<=8;n++){
 const f=formatFor(n),jobs=fixturesFor({count:n});assert.equal(jobs.length,f.totalMatches);assert.equal(new Set(jobs.map(m=>m.id)).size,jobs.length);
 const done=new Set();for(const m of jobs){assert(m.deps.every(id=>done.has(id)));done.add(m.id);assert.notEqual(m.a,m.b);}
 if(n<=6)assert.equal(f.sizes.reduce((a,b)=>a+b,0),n);else assert.deepEqual(f.sizes,[]);
}
for(let n=3;n<=5;n++){const seen=new Set();for(const round of roundRobin(Array.from({length:n},(_,i)=>i))){const active=new Set();for(const m of round){assert(!active.has(m.a));assert(!active.has(m.b));active.add(m.a);active.add(m.b);const key=[m.a,m.b].sort().join('/');assert(!seen.has(key));seen.add(key);}}assert.equal(seen.size,n*(n-1)/2);}
// Check guaranteed match counts for every possible sequence of winners.
for(const n of [7,8]){const jobs=fixturesFor({count:n});for(let mask=0;mask<2**jobs.length;mask++){const outcomes=new Map(),counts=new Map();const resolve=t=>t.startsWith('Vainqueur ')?outcomes.get(t.slice(10)).winner:t.startsWith('Perdant ')?outcomes.get(t.slice(8)).loser:t;
 jobs.forEach((m,i)=>{const a=resolve(m.a),b=resolve(m.b);assert(a&&b&&a!==b);counts.set(a,(counts.get(a)||0)+1);counts.set(b,(counts.get(b)||0)+1);outcomes.set(m.id,mask&(1<<i)?{winner:b,loser:a}:{winner:a,loser:b});});assert.equal(counts.size,n);for(const [team,count] of counts)assert.equal(count,n===7&&team==='TS1'?2:3);}}
for(let a=3;a<=8;a++)for(let b=3;b<=8;b++){
 const schedule=scheduleDraws([{division:'DM',count:a},{division:'DD',count:b}]);assert.equal(schedule.length,formatFor(a).totalMatches+formatFor(b).totalMatches);
 const assignments=new Set(),byDivision={DM:new Map(),DD:new Map()};
 for(const m of schedule){const key=m.slot+'/'+m.court;assert(!assignments.has(key));assignments.add(key);assert(m.deps.every(id=>byDivision[m.division].get(id)?.slot<m.slot));byDivision[m.division].set(m.id,m);}
 for(const m of schedule){if(m.court!==m.division){const other=m.division==='DM'?'DD':'DM';assert([...byDivision[other].values()].every(x=>x.slot<m.slot));}for(const other of schedule.filter(x=>x.division===m.division&&x.slot===m.slot&&x.id!==m.id))assert(![m.a,m.b].some(t=>[other.a,other.b].includes(t)));}
}
const finish=(a,b)=>slotFor(Math.max(...scheduleDraws([{division:'DM',count:a},{division:'DD',count:b}]).map(m=>m.slot))).end;
assert.equal(finish(6,6),'23 h 25');assert.equal(finish(7,7),'22 h 55');assert.equal(finish(8,8),'23 h 55');assert.equal(finish(7,8),'23 h 25');assert.equal(finish(3,8),'21 h 55');assert.equal(finish(4,7),'21 h 55');
const drawn=fixturesFor({count:7,drawn_at:'2026-11-05',draw_order:['a','b','c','d','e','f','g']});assert.equal(drawn.find(m=>m.id==='DF2').b,'g');assert.equal(drawn.filter(m=>m.phase==='quarts').length,3);
for(const n of [0,1,2,9,3.5])assert.equal(formatFor(n),null);
assert.equal(slotFor(0).start,'18 h 00');assert.equal(slotFor(1).start,'18 h 30');assert.equal(slotFor(12).date,'sam. 7 nov.');
console.log('Formats 3–8, all 7/8-team outcomes, 36 shared-court schedules, dependencies, no overlaps and finish times passed');

for(const n of [3,4,5]){for(const other of [3,4,5,6,7,8]){const schedule=scheduleDraws([{division:'DM',count:n},{division:'DD',count:other}]).filter(m=>m.division==='DM');const final=schedule.find(m=>m.id==='TS-FINAL');assert.deepEqual(new Set([final.a,final.b]),new Set(['TS1','TS2']));assert(schedule.filter(m=>m.id!=='TS-FINAL').every(m=>m.slot<final.slot));}}
for(const n of [7,8]){const jobs=fixturesFor({count:n});assert.equal(jobs.find(m=>m.id==='QF1').a,'TS2');assert.equal(n===7?jobs.find(m=>m.id==='DF2').b:jobs.find(m=>m.id==='QF4').b,'TS1');}
console.log('Seed placement and last TS1/TS2 match passed');
