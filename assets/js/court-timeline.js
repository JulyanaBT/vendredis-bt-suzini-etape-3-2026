const MINUTE=60000;
export function courtTimeline(matches,{pixelsPerMinute=5,minMatchHeight=140}={}){
 const rows=matches.map(match=>({...match,start:match.started_at?Date.parse(match.started_at):Number(match.live??match.planned),finish:Number(match.end)})).filter(m=>Number.isFinite(m.start)&&Number.isFinite(m.finish));
 if(!rows.length)return {events:[],ticks:[],height:0,start:null,end:null,position:()=>0};
 const start=Math.floor(Math.min(...rows.map(m=>m.start))/(15*MINUTE))*15*MINUTE,end=Math.max(...rows.map(m=>Math.max(m.start+MINUTE,m.finish)));
 const events=[];
 for(const court of ['DM','DD']){
 let previous=null;
 const lane=rows.filter(m=>(m.court||m.division)===court).sort((a,b)=>a.start-b.start);
 for(const m of lane){
 const previousEnd=previous?Math.max(previous.start+MINUTE,previous.finish):start;
 if(m.start>previousEnd){
 let gapStart=previousEnd;
 if(previous&&previous.division!==m.division){
 const changeEnd=Math.min(m.start,previousEnd+10*MINUTE);
 events.push({kind:'changeover',court,start:previousEnd,end:changeEnd,from:previous.division,to:m.division,before:m,minutes:(changeEnd-previousEnd)/MINUTE});gapStart=changeEnd;
 }
 if(m.start>gapStart)events.push({kind:m.restUntil&&m.restUntil>gapStart?'recovery':'pause',court,start:gapStart,end:m.start,before:m,minutes:(m.start-gapStart)/MINUTE});
 }
 events.push({kind:'match',court,start:m.start,end:Math.max(m.start+MINUTE,m.finish),match:m});
 previous=m;
 }
 }
 const times=new Set([start,end]);
 for(const e of events){times.add(e.start);times.add(e.end);}
 const ticks=[];for(let time=start;time<=end;time+=30*MINUTE){times.add(time);ticks.push(time);}
 const bounds=[...times].sort((a,b)=>a-b),heights=bounds.slice(1).map((time,i)=>(time-bounds[i])/MINUTE*pixelsPerMinute);
 // Preserve readable cards even for a result validated a few minutes after launch.
 // Shared segment heights keep both courts aligned without overlapping their events.
 for(const e of events.filter(e=>e.kind==='match')){
 const a=bounds.indexOf(e.start),b=bounds.indexOf(e.end),sum=heights.slice(a,b).reduce((n,h)=>n+h,0),extra=Math.max(0,minMatchHeight-sum);
 if(extra)for(let i=a;i<b;i++)heights[i]+=extra*(bounds[i+1]-bounds[i])/(e.end-e.start);
 }
 const offsets=[0];for(const h of heights)offsets.push(offsets.at(-1)+h);
 const position=time=>{if(time<=start)return 0;if(time>=end)return offsets.at(-1);let i=0;while(bounds[i+1]<time)i++;return offsets[i]+(time-bounds[i])/(bounds[i+1]-bounds[i])*heights[i];};
 return {events:events.map(e=>({...e,top:position(e.start),height:position(e.end)-position(e.start)})),ticks:ticks.map(time=>({time,top:position(time)})),height:offsets.at(-1),start,end,position};
}
