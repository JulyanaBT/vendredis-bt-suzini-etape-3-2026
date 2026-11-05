import {exchangeMatchSlots} from '../assets/js/match-plan-edit.js';
const assert=(v,m)=>{if(!v)throw Error(m);};
const plan=[{id:'A',division:'DM',slot:0,court:'DM',forced_at:'2026-11-06T22:00:00Z'},{id:'B',division:'DM',slot:1,court:'DM'},{id:'TS-FINAL',division:'DM',slot:2,court:'DM'},{id:'C',division:'DD',slot:0,court:'DD'}];
const matches=plan.map(p=>({...p,result:null}));
const swapped=exchangeMatchSlots(plan,plan[0],plan[1],matches);
assert(swapped[0].slot===1&&swapped[1].slot===0,'Slots exchange');
assert(!swapped[0].forced_at&&swapped[1].forced_at===plan[0].forced_at,'Forced hour stays with its slot');
assert(plan[0].slot===0,'Input unchanged');
for(const [a,b,rows] of [[plan[0],plan[2],matches],[plan[0],plan[3],matches],[plan[0],plan[1],matches.map(m=>m.id==='B'?{...m,started_at:'2026-11-06T21:00:00Z'}:m)]]){
let blocked=false;try{exchangeMatchSlots(plan,a,b,rows);}catch{blocked=true;}assert(blocked,'Forbidden swap must be blocked');}
console.log('PASS: arbitrary non-final swap, final protection, same draw, active matches and forced-hour positions');
