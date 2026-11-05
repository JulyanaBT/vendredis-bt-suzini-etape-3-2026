
import {courtTimeline} from '../assets/js/court-timeline.js';
const assert=(ok,msg)=>{if(!ok)throw Error(msg);},base=Date.parse('2026-11-06T21:00:00Z'),min=60000;
const rows=[
 {id:'M1',division:'DM',court:'DM',live:base,end:base+25*min},
 {id:'D1',division:'DD',court:'DD',live:base,end:base+40*min},
 {id:'M2',division:'DM',court:'DM',live:base+30*min,end:base+55*min},
 {id:'D2',division:'DD',court:'DM',live:base+65*min,end:base+105*min}
];
const plan=courtTimeline(rows),get=id=>plan.events.find(e=>e.match?.id===id);
assert(get('M1').top===get('D1').top,'Simultaneous starts must align');
assert(get('D1').height>get('M1').height,'Longer match must be taller');
assert(plan.events.some(e=>e.kind==='pause'&&e.minutes===5),'Five-minute interval');
assert(plan.events.some(e=>e.kind==='changeover'&&e.minutes===10&&e.from==='DM'&&e.to==='DD'),'Ten-minute changeover');
for(const c of ['DM','DD']){const lane=plan.events.filter(e=>e.court===c);for(let i=1;i<lane.length;i++)assert(lane[i-1].top+lane[i-1].height<=lane[i].top+.01,'Lane events must never overlap');}
const short=courtTimeline([{division:'DM',court:'DM',live:base,end:base+min},{division:'DM',court:'DM',live:base+6*min,end:base+31*min}]);
assert(short.events[0].height>=126,'Quickly validated result must remain readable');
assert(courtTimeline([]).height===0,'Empty schedule');
const recovery=courtTimeline([{division:'DM',court:'DM',live:base,end:base+25*min},{division:'DM',court:'DM',live:base+55*min,end:base+80*min,restUntil:base+55*min}]);
assert(recovery.events.some(e=>e.kind==='recovery'&&e.minutes===30),'Recovery shown explicitly');
console.log('PASS: duration scale, aligned lanes, pause/changeover/recovery, no overlap, short results and empty programme');

const longWait=courtTimeline([
{division:'DM',court:'DM',live:base,end:base+25*min},
{division:'DM',court:'DM',live:base+225*min,end:base+250*min,restUntil:base+225*min}
]);
const breaks=longWait.events.filter(e=>e.kind!=='match');
assert(breaks.length===2&&breaks[0].kind==='waiting'&&breaks[0].minutes===170,'Wait for other court is not recovery');
assert(breaks[1].kind==='recovery'&&breaks[1].minutes===30,'Recovery capped at exactly thirty minutes');
assert(longWait.events.filter(e=>e.kind==='recovery').every(e=>e.minutes<=30),'No recovery longer than thirty minutes');
console.log('PASS: long cross-court wait split from 30-minute recovery');
