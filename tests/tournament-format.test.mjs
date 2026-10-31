import assert from 'node:assert/strict';
import {formatFor,roundRobin,poolFixtures,finalFixtures} from '../assets/js/tournament-format.js';
for(let count=3;count<=8;count++){
 const f=formatFor(count);assert.equal(f.sizes.reduce((a,b)=>a+b,0),count);
 const groups=f.sizes.map((size,i)=>Array.from({length:size},(_,n)=>`${i}-${n}`));
 const matches=poolFixtures(groups);assert.equal(matches.length,f.poolMatches);
 assert.equal(matches.length+finalFixtures(count).length,f.totalMatches);
 for(const group of groups){const seen=new Set();for(const round of roundRobin(group)){const active=new Set();for(const m of round){assert.notEqual(m.a,m.b);assert(!active.has(m.a));assert(!active.has(m.b));active.add(m.a);active.add(m.b);const key=[m.a,m.b].sort().join('/');assert(!seen.has(key));seen.add(key);}}assert.equal(seen.size,group.length*(group.length-1)/2);}
}
for(const n of [0,1,2,9,3.5])assert.equal(formatFor(n),null);
assert.deepEqual(formatFor(7).sizes,[3,4]);assert.equal(finalFixtures(7).filter(m=>m.stage.includes('5–7')).length,3);
assert.equal(finalFixtures(8).filter(m=>m.stage.includes('5–8')).length,2);
console.log('All formats 3–8: round-robin uniqueness, pool sizes, complete classification and match counts passed');
