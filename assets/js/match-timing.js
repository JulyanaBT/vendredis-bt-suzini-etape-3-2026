export const MATCH_DURATION={DM:25,DD:40};
export const GAP_MINUTES=5,COURT_CHANGE_MINUTES=10,CONSECUTIVE_REST_MINUTES=30;
const MINUTE=60000,BASE=Date.parse('2026-11-06T21:00:00Z');
const same=(a,b)=>a.division===b.division&&[a.a,a.b].some(id=>id&&[b.a,b.b].includes(id));
const depends=(a,b)=>a.division===b.division&&(a.deps||[]).includes(b.id)&&[a.a,a.b].some(v=>v===('Vainqueur '+b.id)||v===('Perdant '+b.id));
export function buildTimeline(matches,{now=Date.now(),start=BASE}={}){
 const courtEnd={},courtLast={},divisionLast={},ends={},rows=[],teamLast={};
 for(const m of [...matches].sort((a,b)=>a.slot-b.slot)){
 const court=m.court||m.division,duration=MATCH_DURATION[m.division]||25,key=m.division+':'+m.id;
 const prior=divisionLast[m.division],courtPrior=courtLast[court],restMatch=prior&&(same(m,prior)||depends(m,prior))?prior:courtPrior&&(same(m,courtPrior)||depends(m,courtPrior))?courtPrior:null;
 const courtChanged=!!courtPrior&&courtPrior.division!==m.division,transition=courtChanged?COURT_CHANGE_MINUTES:GAP_MINUTES;
 let earliest=courtEnd[court]===undefined?start:courtEnd[court]+transition*MINUTE;
 for(const dep of m.deps||[])if(ends[m.division+':'+dep]!==undefined)earliest=Math.max(earliest,ends[m.division+':'+dep]+GAP_MINUTES*MINUTE);
 let restUntil=null;
 if(restMatch){restUntil=ends[restMatch.division+':'+restMatch.id]+CONSECUTIVE_REST_MINUTES*MINUTE;earliest=Math.max(earliest,restUntil);}
 for(const id of [m.a,m.b])if(teamLast[id])earliest=Math.max(earliest,teamLast[id].end+CONSECUTIVE_REST_MINUTES*MINUTE);
 if(m.forced_at)earliest=Math.max(earliest,Date.parse(m.forced_at));
 const actualStart=m.started_at?Date.parse(m.started_at):null;
 const began=actualStart??earliest;
 const actualEnd=m.result?Date.parse(m.result.validated_at):null;
 const end=actualEnd??(actualStart!==null?Math.max(began+duration*MINUTE,now):began+duration*MINUTE);
 const row={...m,court,duration,planned:earliest,live:began,end,restUntil,courtChanged,changeoverStart:courtChanged?courtEnd[court]:null,changeoverEnd:courtChanged?courtEnd[court]+COURT_CHANGE_MINUTES*MINUTE:null,adjusted:!!m.forced_at||actualStart!==null,running:actualStart!==null&&!m.result};
 rows.push(row);ends[key]=end;courtEnd[court]=end;courtLast[court]=row;divisionLast[m.division]=row;
 for(const id of [m.a,m.b])teamLast[id]={end,match:row};
 }
 return rows;
}
export function launchReadiness(match,matches,{now=Date.now()}={}){
 const court=match.court||match.division;
 const active=matches.find(m=>m.started_at&&!m.result&&((m.court||m.division)===court||same(m,match)));
 if(active)return {allowed:false,reason:'Un match est déjà en cours sur ce terrain ou pour cette équipe.'};
 if(!/^[0-9a-f-]{36}$/i.test(match.a)||!/^[0-9a-f-]{36}$/i.test(match.b))return {allowed:false,reason:'Les équipes ne sont pas encore déterminées.'};
 if((match.deps||[]).some(id=>!matches.some(m=>m.division===match.division&&m.id===id&&m.result)))return {allowed:false,reason:'Les matchs précédents ne sont pas tous validés.'};
 const sorted=[...matches].sort((a,b)=>a.slot-b.slot),index=sorted.findIndex(m=>m.id===match.id&&m.division===match.division);
 const before=sorted.slice(0,index);
 const prior=[...before].reverse().find(m=>m.division===match.division);
 const courtPrior=[...before].reverse().find(m=>(m.court||m.division)===court);
 let until=0,recoveryUntil=0;
 const courtChanged=!!courtPrior&&courtPrior.division!==match.division;
 if(courtPrior?.result)until=Date.parse(courtPrior.result.validated_at)+(courtChanged?COURT_CHANGE_MINUTES:GAP_MINUTES)*MINUTE;
 const rest=prior&&(same(prior,match)||depends(match,prior))?prior:courtPrior&&(same(courtPrior,match)||depends(match,courtPrior))?courtPrior:null;
 if(rest?.result)until=Math.max(until,Date.parse(rest.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE);
 for(const previous of matches.filter(m=>m.result&&same(m,match)))recoveryUntil=Math.max(recoveryUntil,Date.parse(previous.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE);
 until=Math.max(until,recoveryUntil);
 if(until>now)return {allowed:false,canConfirm:true,until,recoveryUntil:recoveryUntil||null,reason:matches.some(m=>m.result&&same(m,match)&&Date.parse(m.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE>now)?'Pause de trente minutes pour l’équipe qui enchaîne.':courtChanged?'Reconfiguration du terrain : dix minutes pour passer de '+courtPrior.division+' à '+match.division+'.':'Battement de cinq minutes entre les matchs.'};
 return {allowed:true,recoveryUntil:recoveryUntil||null};
}
