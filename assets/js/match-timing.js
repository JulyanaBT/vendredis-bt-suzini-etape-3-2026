export const MATCH_DURATION={DM:30,DD:30};
export const GAP_MINUTES=5,COURT_CHANGE_MINUTES=10,CONSECUTIVE_REST_MINUTES=30;
const MINUTE=60000,BASE=Date.parse('2026-11-06T21:00:00Z');
const same=(a,b)=>a.division===b.division&&[a.a,a.b].some(id=>id&&[b.a,b.b].includes(id));
const depends=(a,b)=>a.division===b.division&&(a.deps||[]).includes(b.id)&&[a.a,a.b].some(v=>v===('Vainqueur '+b.id)||v===('Perdant '+b.id));
export function recoveryPreapproved(match,previous){
 const a=match.recovery_agreement,shared=previous&&[match.a,match.b].filter(id=>[previous.a,previous.b].includes(id));
 if(!a||a.both_teams_agreed!==true||previous?.division!==match.division||!shared?.length||!shared.every(id=>(a.team_ids||[]).includes(id)))return false;
 if(a.kind==='preapproved_slots')return Number.isInteger(match.slot)&&Number.isInteger(previous.slot)&&match.slot>=0&&previous.slot>=0&&match.slot<3&&previous.slot<3;
 return a.kind==='preapproved'&&a.previous_match_id===previous.id;
}
export function buildTimeline(matches,{now=Date.now(),start=BASE}={}){
 const courtEnd={},courtLast={},ends={},rows=[],teamLast={},remaining={DM:0,DD:0},totals={DM:0,DD:0};
 const ordered=[...matches].sort((a,b)=>a.slot-b.slot);
 for(const m of ordered){remaining[m.division]++;totals[m.division]++;}
 for(const m of ordered){
 const duration=MATCH_DURATION[m.division]||25,key=m.division+':'+m.id,primary=m.division,secondary=primary==='DM'?'DD':'DM';
 function forecast(court){
 const prior=courtLast[court],courtChanged=!!prior&&prior.division!==m.division;
 let earliest=courtEnd[court]===undefined?start:courtEnd[court]+(courtChanged?COURT_CHANGE_MINUTES:GAP_MINUTES)*MINUTE,restUntil=null;
 for(const dep of m.deps||[])if(ends[m.division+':'+dep]!==undefined){
 const end=ends[m.division+':'+dep];earliest=Math.max(earliest,end+GAP_MINUTES*MINUTE);
 const parent=rows.find(r=>r.division===m.division&&r.id===dep);
 if(parent&&depends(m,parent)&&!recoveryPreapproved(m,parent))restUntil=Math.max(restUntil||0,end+CONSECUTIVE_REST_MINUTES*MINUTE);
 }
 for(const id of [m.a,m.b])if(teamLast[id]&&!recoveryPreapproved(m,teamLast[id].match))restUntil=Math.max(restUntil||0,teamLast[id].end+CONSECUTIVE_REST_MINUTES*MINUTE);
 if(restUntil)earliest=Math.max(earliest,restUntil);
 if(m.forced_at)earliest=Math.max(earliest,Date.parse(m.forced_at));
 return {earliest,restUntil,courtChanged,changeoverStart:courtChanged?courtEnd[court]:null,changeoverEnd:courtChanged?courtEnd[court]+COURT_CHANGE_MINUTES*MINUTE:null};
 }
 let court=primary,timing=forecast(primary);
 if(m.started_at||m.result){court=m.court||primary;timing=forecast(court);}
 else if(totals[secondary]>0&&remaining[secondary]===0){
 const principal=courtLast[primary],borrow=forecast(secondary);
 // The freed court helps only if it really overlaps a same-draw match
 // on the principal court, after the other draw's final estimated finish.
 if(principal&&principal.division===primary&&!principal.result&&!same(m,principal)){
 const proposed=Math.max(borrow.earliest,principal.live);
 if(proposed<principal.end&&proposed<timing.earliest){court=secondary;timing={...borrow,earliest:proposed};}
 }
 }
 const actualStart=m.started_at?Date.parse(m.started_at):null,began=actualStart??timing.earliest;
 const actualEnd=m.result?Date.parse(m.result.validated_at):null;
 const end=actualEnd??(actualStart!==null?Math.max(began+duration*MINUTE,now):began+duration*MINUTE);
 const row={...m,court,duration,planned:timing.earliest,live:began,end,restUntil:timing.restUntil,courtChanged:timing.courtChanged,changeoverStart:timing.changeoverStart,changeoverEnd:timing.changeoverEnd,adjusted:!!m.forced_at||actualStart!==null,running:actualStart!==null&&!m.result};
 rows.push(row);ends[key]=end;courtEnd[court]=end;courtLast[court]=row;remaining[m.division]--;
 for(const id of [m.a,m.b])teamLast[id]={end,match:row};
 }
 return rows;
}
export function launchReadiness(match,matches,{now=Date.now()}={}){
 const court=match.court||match.division;
 if(court!==match.division){
 const other=matches.filter(m=>m.division!==match.division);
 if(!other.length||other.some(m=>!m.result))return {allowed:false,reason:'Le second terrain est utilisable seulement après la fin complète de l’autre épreuve.'};
 if(!matches.some(m=>m.division===match.division&&(m.court||m.division)===match.division&&m.started_at&&!m.result))return {allowed:false,reason:'Le second terrain sert uniquement à jouer en parallèle d’un match sur le terrain principal.'};
 }
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
 if(rest?.result&&!recoveryPreapproved(match,rest))until=Math.max(until,Date.parse(rest.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE);
 for(const previous of matches.filter(m=>m.result&&same(m,match)&&!recoveryPreapproved(match,m)))recoveryUntil=Math.max(recoveryUntil,Date.parse(previous.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE);
 until=Math.max(until,recoveryUntil);
 if(until>now)return {allowed:false,canConfirm:true,until,recoveryUntil:recoveryUntil||null,reason:matches.some(m=>m.result&&same(m,match)&&Date.parse(m.result.validated_at)+CONSECUTIVE_REST_MINUTES*MINUTE>now)?'Pause de trente minutes pour l’équipe qui enchaîne.':courtChanged?'Reconfiguration du terrain : dix minutes pour passer de '+courtPrior.division+' à '+match.division+'.':'Battement de cinq minutes entre les matchs.'};
 return {allowed:true,recoveryUntil:recoveryUntil||null,recoveryPreapproved:recoveryPreapproved(match,courtPrior)};
}
