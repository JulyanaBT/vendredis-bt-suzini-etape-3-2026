import {rpc} from './supabase-site.js?v=94';
import {client,withDeadline} from './private-client.js?v=94';
import {COURTS,formatFor,scheduleDraws} from './tournament-format.js?v=102';
import {buildTimeline,launchReadiness} from './match-timing.js?v=137';
import {courtTimeline} from './court-timeline.js?v=137';
const panel=document.getElementById('programme-panel'),tabs=[...document.querySelectorAll('[data-programme]')],isClub=document.body.dataset.space==='club';
const el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
let scoreHistoryExpanded=false,upcomingExpanded=false;
let drawReplay=null,serverOffset=0,drawRefreshBusy=false;
const drawRevealSeen=new Map();let drawFlight=null,drawFlightToken=0;
let bracketView='final';try{bracketView=sessionStorage.getItem('suzini_e3_bracket')||'final';}catch{}
let division='DM',selected='chrono',data=null,error='',clubReady=false,mode='real',generation=0;
try{division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{}
if(!COURTS[division])division='DM';
const params=new URLSearchParams(location.search);
try{localStorage.setItem('suzini_e3_match_mode','real');const clean=new URL(location.href);clean.searchParams.delete('simulation');history.replaceState(null,'',clean);}catch{}
let chronoFilter=params.get('chronofilter');try{chronoFilter=chronoFilter||sessionStorage.getItem('suzini_e3_chrono_filter');}catch{}if(!['DM','DD','both'].includes(chronoFilter))chronoFilter='both';
function syncChronoFilter(){document.querySelectorAll('[data-public-epreuve]').forEach(b=>b.setAttribute('aria-pressed',String(selected==='chrono'?(chronoFilter==='both'||chronoFilter===b.dataset.publicEpreuve):division===b.dataset.publicEpreuve)));}
document.addEventListener('click',e=>{const button=e.target.closest('[data-public-epreuve]');if(!button||selected!=='chrono')return;e.preventDefault();e.stopImmediatePropagation();const value=button.dataset.publicEpreuve;chronoFilter=chronoFilter===value?'both':value;division=value;try{sessionStorage.setItem('suzini_e3_chrono_filter',chronoFilter);localStorage.setItem('suzini_etape3_public_epreuve',division);const url=new URL(location.href);url.searchParams.set('chronofilter',chronoFilter);history.replaceState(null,'',url);}catch{}render();},true);
function courtName(id,compact=false){
 const emoji=id==='DM'?'🐝':'🌶️',label=id==='DM'?'Manon Queen Bee':'Lisa de los pimentos',icons=emoji.repeat(compact?1:3);
 return icons+' '+label+' '+icons;
}
function current(){return data?.divisions.find(d=>d.division===division);}
function name(id){return data?.teams.find(t=>t.id===id)?.team_name||id||'À déterminer';}
const clock=(value,seconds=false)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Cayenne',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(new Date(value));
function scoreText(r){return r?r.score.sets.map(s=>s.join('–')).join(' / ')+(r.score.super?' · STB '+r.score.super.join('–'):''):'';}
function matchesPublished(d){return !!data?.registration_closed&&(d.matches_ready===true||(d.matches_ready===undefined&&(d.count===4||d.count===5||!!d.drawn_at&&d.draw_public_complete===true)));}
function fixtures(all=false){
 if(!data)return [];
 const slots=scheduleDraws(data.divisions.filter(matchesPublished)).map(m=>({...m,...(data.planning||[]).find(p=>p.id===m.id&&p.division===m.division)})).sort((a,b)=>a.slot-b.slot);
 return slots.map(base=>{const m=data.matches.find(m=>m.division===base.division&&m.id===base.id);return m?{...base,...m}:null;}).filter(Boolean).filter(m=>all||m.division===division);
}
function chrono(all=false){return buildTimeline(fixtures(true)).filter(m=>all||m.division===division);}

function planRows(){return fixtures(true).map(x=>({id:x.id,division:x.division,slot:x.slot,court:x.court||x.division,...(x.forced_at?{forced_at:x.forced_at}:{}),...(x.progress?{progress:x.progress}:{}),...(x.started_at?{started_at:x.started_at}:{}),...(x.recovery_agreement?{recovery_agreement:x.recovery_agreement}:{})}));}
async function moveMatch(m,direction,targetSlot){
 const plan=planRows(),item=plan.find(x=>x.id===m.id&&x.division===m.division),old={slot:item.slot,court:item.court};
 if(direction==='up'||direction==='down')item.slot=targetSlot??item.slot+(direction==='up'?-1:1);
 else item.court=item.court==='DM'?'DD':'DM';
 if(item.slot<0)return;
 const other=plan.find(x=>x!==item&&x.slot===item.slot&&x.court===item.court);
 if(other){if(fixtures(true).find(x=>x.id===other.id&&x.division===other.division)?.result||fixtures(true).find(x=>x.id===other.id&&x.division===other.division)?.started_at)throw Error('Ce créneau contient un match en cours ou déjà validé.');other.slot=old.slot;other.court=old.court;}
 await savePlan(plan);
}
function exchangeButton(m,dir,targetSlot,other){
 const b=el('button',dir==='court'?'⇄':'⇅','chrono-exchange');b.type='button';b.title=dir==='court'?'Échanger les terrains':'Échanger les horaires';b.setAttribute('aria-label',b.title+(m?' · '+name(m.a)+' contre '+name(m.b):''));b.disabled=!m||!!m.result||!!m.started_at||!!other?.result||!!other?.started_at;
 b.onclick=async()=>{b.disabled=true;try{await moveMatch(m,dir,targetSlot);}catch(e){alert(e.message);b.disabled=false;}};return b;
}
async function savePlan(plan){
 const {data:next,error}=await withDeadline(client.rpc('suzini_e3_save_planning',{p_simulation:!!data.simulation,p_plan:plan,p_revision:data.planning_revision||0}));
 if(error)throw error;data=next;render();
}
function planningControls(m){
 const box=el('div','','match-plan-controls');
 const label='Match '+name(m.a)+' contre '+name(m.b);
 const time=el('button','🕒');time.type='button';time.title='Forcer une heure';time.setAttribute('aria-label','Forcer une heure · '+label);time.disabled=!!m.result||!!m.started_at;
 time.onclick=()=>{
 const dialog=el('dialog','','match-time-dialog'),form=el('form');form.method='dialog';
 const local=new Date((m.live??m.planned)-3*3600000).toISOString(),date=local.slice(0,10);
 const wheels=el('div','','time-wheels'),hour=el('select'),minute=el('select');
 hour.size=minute.size=5;hour.setAttribute('aria-label','Heures');minute.setAttribute('aria-label','Minutes');
 for(const [select,max,value] of [[hour,24,local.slice(11,13)],[minute,60,local.slice(14,16)]])for(let i=0;i<max;i++){const v=String(i).padStart(2,'0'),o=el('option',v);o.value=v;select.append(o);select.value=value;}
 wheels.append(hour,el('strong',':'),minute);
 const lab=el('label','Heure de Guyane');const status=el('p');status.setAttribute('role','status');
 const save=el('button','Appliquer'),cancel=el('button','Annuler'),reset=el('button','Revenir à l’heure calculée');save.type='submit';cancel.type=reset.type='button';cancel.onclick=()=>dialog.close();
 async function persist(value){save.disabled=true;try{const plan=planRows();const item=plan.find(x=>x.id===m.id&&x.division===m.division);delete item.forced_at;if(value)item.forced_at=value;await savePlan(plan);dialog.close();}catch(e){status.textContent=e.message;save.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();persist(new Date(date+'T'+hour.value+':'+minute.value+':00-03:00').toISOString());};reset.onclick=()=>persist(null);
 form.append(el('h2','Heure du match'),lab,wheels,el('small','Les matchs suivants du terrain seront décalés à partir de cette heure.'),status,save,reset,cancel);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();requestAnimationFrame(()=>{for(const select of [hour,minute])select.scrollTop=Math.max(0,(select.selectedIndex+.5)*(select.scrollHeight/select.options.length)-select.clientHeight/2);});
 };
 box.append(time);return box;
}

function teamLabel(id){
 const label=el('span',name(id),'team-with-seed'),index=(current()?.seeds||[]).indexOf(id);
 if(index===0||index===1)label.append(el('small','TS'+(index+1),'seed-pill'));
 return label;
}
function noFinalsInfo(d){
 const box=note('Pas de finales · '+d.count+' équipes','');box.classList.add('draw-friendly');box.lastChild.remove();
 const picture=el('div','🏖️ 🤝 🏆','draw-picture');picture.setAttribute('aria-hidden','true');box.prepend(picture);
 const list=el('ul');
 for(const [icon,title,detail] of [
 ['🤝','Tout se joue dans la poule','Chaque paire rencontre toutes les autres.'],
 ['🏆','Le podium se gagne au fil des matchs','Le classement de la poule donne le classement final.'],
 ['😎','La finale ? Pas besoin d’en rajouter !','TS1 et TS2 se retrouvent au dernier match.']
 ]){const li=el('li'),symbol=el('span',icon),copy=el('div');symbol.setAttribute('aria-hidden','true');copy.append(el('strong',title),el('small',detail));li.append(symbol,copy);list.append(li);}
 box.append(list);return box;
}
function rankingList(d,matches){
 const complete=matches.length>0&&matches.every(m=>m.result),played=matches.filter(m=>m.result).length;
 const box=el('section','','ranking-showcase'),header=el('header','','ranking-showcase-head');
 const trophy=el('span','🏆','ranking-trophy');trophy.setAttribute('aria-hidden','true');
 const heading=el('div');heading.append(el('small',division==='DM'?'DOUBLE MESSIEURS':'DOUBLE DAMES','ranking-division'),el('h2',complete?'Classement final':'Classement provisoire'));
 header.append(trophy,heading,el('span',complete?'Terminé':'En cours','ranking-state'));box.append(header);panel.append(box);
 if(!complete){const progress=el('div','','ranking-progress-card');progress.append(el('strong',played+' / '+matches.length),el('span','matchs joués'),el('small',(matches.length-played)+' match'+(matches.length-played>1?'s':'')+' restant'+(matches.length-played>1?'s':'')));const bar=el('div','','ranking-progress-track'),fill=el('span');fill.style.width=(matches.length?played/matches.length*100:0)+'%';bar.append(fill);progress.append(bar);box.append(progress);}
 let rows=[];
 if(d.count<=5)rows=(d.standings_a||[]).map(r=>({id:r.id,position:Number(r.position),tied:r.tied}));
 else{
 for(const [id,rank] of [['F',1],['P3',3],['P5',5],['P7',7]]){
 const r=matches.find(m=>m.id===id)?.result;
 if(r)rows.push({id:r.winner,position:rank},{id:r.winner===r.team_a?r.team_b:r.team_a,position:rank+1});
 }
 if(d.count===7&&d.standings_c?.length)rows.push(...d.standings_c.map(r=>({id:r.id,position:Number(r.position)+4,tied:r.tied})));
 const placed=new Set(rows.map(r=>r.id));
 const pending=data.teams.filter(t=>t.division===division&&!placed.has(t.id)).sort((a,b)=>name(a.id).localeCompare(name(b.id),'fr'));
 rows.push(...pending.map(t=>({id:t.id,position:null})));
 }
 rows.sort((a,b)=>(a.position??99)-(b.position??99)||name(a.id).localeCompare(name(b.id),'fr'));
 const podium=el('div','','ranking-podium');
 for(const place of [2,1,3]){
 const r=rows.find(r=>r.position===place&&!r.tied),step=el('article','','ranking-podium-step step-'+place+(r?'':' podium-pending'));
 step.append(el('span',['🥇','🥈','🥉'][place-1],'podium-medal'),el('strong',r?name(r.id):'À départager','podium-name'),el('span',place===1?'1re place':place+'e place','podium-rank'));
 podium.append(step);
 }
 box.append(podium);
 const list=el('ol','','ranking-simple');
 for(const r of rows){
 const top=r.position&&r.position<=3&&!r.tied,li=el('li','','ranking-place'+(top?' podium-place podium-'+r.position:''));
 const rank=el('span',r.position?(top?['🥇','🥈','🥉'][r.position-1]+' ':'')+r.position+(r.tied?' =':''):'—','ranking-number');
 li.append(rank,el('span',name(r.id),'ranking-team'));list.append(li);
 }
 box.append(list);
 if(rows.some(r=>r.tied))box.append(el('small','Équipes ex æquo : places encore à départager.','ranking-tie-note'));
}

function drawInfo(d){
 const box=note('Poule unique · '+d.count+' équipes','');
 box.classList.add('draw-friendly');box.lastChild.remove();
 const picture=el('div','🎩 🏖️ 🎾','draw-picture');picture.setAttribute('aria-hidden','true');
 box.prepend(picture);
 const list=el('ul');
 for(const [icon,title,detail] of [
 ['🤝','Tout le monde rencontre tout le monde',d.count+' équipes · '+(d.count*(d.count-1)/2)+' matchs dans une seule poule.'],
 ['🎩','Le chapeau reste au vestiaire','Pas de tirage au sort : personne à tirer du chapeau !'],
 ['🏆','TS1 contre TS2 : le bouquet final','Les deux têtes de série se retrouvent au dernier match.']
 ]){const li=el('li'),symbol=el('span',icon),copy=el('div');symbol.setAttribute('aria-hidden','true');copy.append(el('strong',title),el('small',detail));li.append(symbol,copy);list.append(li);}
 box.append(list);return box;
}
function timelineMilestone(time,title,detail,kind){
 const row=el('section','','timeline-milestone '+kind),stamp=el('time',time==null?'À suivre':clock(time),'timeline-stamp');
 if(time!=null)stamp.dateTime=new Date(time).toISOString();
 const text=el('div','','timeline-event');text.append(el('strong',title));if(detail)text.append(el('small',detail));row.append(stamp,text);return row;
}
function publicChronoBoard(){
 const full=chrono(true),wanted=m=>chronoFilter==='both'||m.division===chronoFilter,shown=full.filter(wanted),board=el('section','','public-court-timeline');
 board.append(timelineMilestone(Date.parse('2026-11-06T20:45:00Z'),'👋 Accueil des joueurs','Contrôle des licences · heure de Guyane','timeline-welcome'));
 if(!shown.length){board.append(note('Programme à venir','Les rencontres apparaîtront à la fin de la diffusion du tirage.'));return board;}
 const layout=courtTimeline(full),events=layout.events.filter(e=>wanted(e.match||e.before)),courts=['DM','DD'].filter(c=>shown.some(m=>(m.court||m.division)===c)),head=el('div','','court-timeline-head');
 head.append(el('span','Heure'));
 for(const c of courts)head.append(el('strong',courtName(c,true),COURTS[c].className));
 head.style.setProperty('--court-count',courts.length);board.append(head);
 const grid=el('div','','court-time-grid');grid.style.setProperty('--court-count',courts.length);
 const finish=Math.max(...events.map(e=>e.end)),height=layout.position(finish);grid.style.height=(height+12)+'px';
 const ruler=el('div','','court-time-ruler');grid.append(ruler);
 for(const tick of layout.ticks.filter(t=>t.time<=finish)){
 const line=el('div','','court-time-rule'),stamp=el('time',clock(tick.time));stamp.dateTime=new Date(tick.time).toISOString();line.style.top=tick.top+'px';line.append(stamp);grid.append(line);
 }
 for(const court of courts){
 const track=el('div','','court-time-track '+COURTS[court].className);track.setAttribute('aria-label',courtName(court));
 for(const event of events.filter(e=>e.court===court)){
 const cell=el('article','','court-time-event '+(event.kind==='match'?'court-time-match':'court-time-break break-'+event.kind)+' '+COURTS[court].className);
 cell.style.top=event.top+'px';cell.style.height=Math.max(1,event.height-3)+'px';
 if(event.kind==='match'){
 const m=event.match,status=m.result?'Terminé':m.started_at?'En cours':'À venir',top=el('div','','court-match-top');
 cell.classList.add(m.result?'is-finished':m.started_at?'is-live':'is-upcoming');
 const badge=el('span',m.division,'chrono-division-pill '+(m.division==='DD'?'division-dd':'division-dm'));
 badge.title=m.division==='DD'?'Double dames':'Double messieurs';
 top.append(el('small',(m.started_at&&!m.result?'● ':'')+status),badge);cell.append(top);
 const hour=el('time',clock(event.start)+' – '+clock(event.end),'court-match-hours');hour.dateTime=new Date(event.start).toISOString();cell.append(hour);
 if(!(m.phase==='poules'&&data.divisions.find(d=>d.division===m.division)?.count<=5))cell.append(el('small',m.stage,'court-match-stage'));
 const matchup=el('div','','court-match-matchup');
 for(const [index,id] of [m.a,m.b].entries()){
 const team=el('strong',name(id),'court-match-team'+(m.result?.winner===id?' is-winner':''));team.title=name(id);matchup.append(team);
 if(index===0)matchup.append(el(m.result?'b':'span',m.result?scoreText(m.result):'vs',m.result?'court-match-score':'court-match-vs'));
 }
 cell.append(matchup);
 cell.setAttribute('aria-label',status+' · '+clock(event.start)+' à '+clock(event.end)+' · '+name(m.a)+' contre '+name(m.b));
 }else{
 const title=event.kind==='changeover'?'🛠️ Reconfiguration':event.kind==='recovery'?'☕ Récupération':'Pause';
 cell.title=title+' · '+clock(event.start)+' – '+clock(event.end);
 cell.append(el('strong',title));
 if(event.height>=42)cell.append(el('small',event.kind==='changeover'?event.from+' → '+event.to+' · '+Math.round(event.minutes)+' min':clock(event.start)+' – '+clock(event.end)));
 cell.setAttribute('aria-label',cell.title);
 }
 track.append(cell);
 }
 grid.append(track);
 }
 const now=Date.now()+serverOffset;
 if(full.some(m=>m.started_at&&!m.result)&&now>=layout.start&&now<finish){
 const line=el('div','','court-time-now');line.style.top=layout.position(now)+'px';line.append(el('span','Maintenant'));grid.append(line);
 }
 board.append(grid);
 const end=full.length?Math.max(...full.map(m=>Number(m.end))):null,done=full.length&&full.every(m=>m.result);
 board.append(timelineMilestone(end,'🏆 Remise des prix',done?'Tous les matchs sont terminés':'Horaire estimé · après le dernier match','timeline-prizes'));
 return board;
}

function chronoBoard(){
 if(!isClub)return publicChronoBoard();
 const full=chrono(true),all=full.filter(m=>chronoFilter==='both'||m.division===chronoFilter),courts=chronoFilter==='both'?['DM','DD']:['DM','DD'].filter(c=>all.some(m=>(m.court||m.division)===c)),editable=isClub&&clubReady,board=el('section','','rose-chrono hourly-timeline'+(editable?' chrono-editable':'')),head=el('div','','rose-chrono-head');
 if(!courts.length)courts.push(chronoFilter==='DD'?'DD':'DM');
 if(courts.length===1)board.classList.add('chrono-single-court');
 head.append(el('span','Heure'));courts.forEach((court,i)=>{if(i&&editable)head.append(el('span','','exchange-spacer'));head.append(el('strong',courtName(court,true),COURTS[court].className));});board.append(head);
 const matchTime=m=>m.started_at?Date.parse(m.started_at):Number(m.live??m.planned);
 const slots=[...new Set(all.map(m=>Math.floor(matchTime(m)/60000)*60000))].sort((a,b)=>a-b);
 const milestone=(time,title,detail,kind)=>{
  const row=el('section','','timeline-milestone '+kind),stamp=el('time',typeof time==='number'?clock(time):time,'timeline-stamp');
  if(typeof time==='number')stamp.dateTime=new Date(time).toISOString();
  const text=el('div','','timeline-event');text.append(el('strong',title));if(detail)text.append(el('small',detail));
  row.append(stamp,text);return row;
 };
 board.append(milestone(Date.parse('2026-11-06T20:45:00Z'),'👋 Accueil des joueurs','Contrôle des licences · heure de Guyane','timeline-welcome'));
 for(let si=0;si<slots.length;si++){
 const slot=slots[si],ms=all.filter(m=>Math.floor(matchTime(m)/60000)*60000===slot),row=el('section','','rose-chrono-row'),tour=el('div','','rose-tour');
 const left=ms.find(m=>(m.court||m.division)==='DM'),right=ms.find(m=>(m.court||m.division)==='DD');
 const stamp=el('time',clock(slot));stamp.dateTime=new Date(slot).toISOString();tour.append(stamp);row.append(tour);
 for(const court of courts){
 if(court===courts[1]&&editable)row.append(exchangeButton(left||right,'court',null,left?right:null));
 const m=court==='DM'?left:right,cell=el('article','','rose-match '+COURTS[court].className);
 if(!m){cell.append(el('small',full.some(x=>Math.floor(matchTime(x)/60000)*60000===slot&&(x.court||x.division)===court)?'Autre épreuve masquée':all.some(x=>(x.court||x.division)===court&&matchTime(x)<slot&&Number(x.end)>slot)?'Match précédent en cours':'—','rose-empty'));row.append(cell);continue;}
 const badge=el('span',m.division,'chrono-division-pill '+(m.division==='DD'?'division-dd':'division-dm'));badge.title=m.division==='DD'?'Double dames':'Double messieurs';badge.setAttribute('aria-label',badge.title);cell.append(badge);
 if(!(m.phase==='poules'&&data.divisions.find(d=>d.division===m.division)?.count<=5))cell.append(el('small',m.stage,'rose-stage'));

 const a=el('div','','rose-team'),b=el('div','','rose-team');
 for(const [id,target] of [[m.a,a],[m.b,b]]){target.append(el('span',name(id)));if(m.result?.winner===id)target.classList.add('rose-winner');}
 const versus=el('div','','rose-versus'),partial=!m.result&&m.progress?.sets?.length?m.progress.sets.map(s=>s.a+'–'+s.b).join(' / '):null;
 versus.append(el(m.result||partial?'strong':'small',m.result?scoreText(m.result):partial||'vs'));cell.append(a,versus,b);
 if(m.result)cell.append(el('small','✓ Terminé à '+clock(m.result.validated_at),'rose-status'));
 else if(m.started_at)cell.append(el('small','● En cours · lancé à '+clock(m.started_at),'rose-status'));
 else if(m.restUntil)cell.append(el('small','Pause équipe · 30 min','rose-rest'));
 if(editable)cell.append(planningControls(m));row.append(cell);
 }
 board.append(row);
 if(editable){
 const separator=el('div','','chrono-between');separator.append(el('span',''));let hasNext=false;
 for(const court of courts){
 if(court===courts[1])separator.append(el('span',''));
 const top=ms.find(m=>(m.court||m.division)===court);
 const bottom=top&&all.filter(m=>(m.court||m.division)===court&&m.slot>top.slot).sort((a,b)=>a.slot-b.slot)[0];
 if(top&&bottom){hasNext=true;separator.append(exchangeButton(top,'down',bottom.slot,bottom));}
 else separator.append(el('span',''));
 }if(hasNext)board.append(separator);
 }
 }
 if(!slots.length)board.append(note('Programme à venir','Les rencontres de '+(chronoFilter==='DM'?'double messieurs':chronoFilter==='DD'?'double dames':'chaque épreuve')+' apparaîtront à la fin de la diffusion de leur tirage.'));
 const finish=full.length?Math.max(...full.map(m=>Number(m.end))):null;
 const final=full.length>0&&full.every(m=>m.result)&&data.divisions.every(d=>d.count<6||d.draw_public_complete!==false&&!!d.drawn_at);
 board.append(milestone(finish===null?'À suivre':finish,'🏆 Remise des prix',finish===null?'Après le dernier match':final?'Tous les matchs sont terminés':'Horaire estimé · après le dernier match','timeline-prizes'));
 return board;
}

function card(m,index){
 const c=el('article','','programme-match '+COURTS[m.court||division].className);
 if(m.result)c.classList.add('match-finished');
 c.append(el('small',(index+1)+'. '+m.stage),el('strong',name(m.a)+' / '+name(m.b)));
 if(!m.result&&m.progress?.sets?.length)c.append(el('b',m.progress.sets.map(s=>s.a+'–'+s.b).join(' / ')+' · en cours','match-score'));
 if(m.result)c.append(el('b',scoreText(m.result),'match-score'),el('small','Validé à '+clock(m.result.validated_at,true)+' · Guyane'));
 else c.append(el('span',(m.adjusted?'Horaire actualisé : ':'Horaire initial : ')+clock(m.live??m.planned),'match-time'));
 if(selected!=='poules')c.append(el('small',courtName(m.court||division)));
 return c;
}
function note(title,text){const b=el('section','','match-info-card');b.append(el('h2',title),el('p',text));return b;}
function table(rows,title='Classement de la poule',offset=0){
 const section=el('section','','pool-standings');section.append(el('h3',title));const wrap=el('div','','standings-scroll'),t=el('table');const head=el('thead'),tr=el('tr');
 for(const h of ['Rg','Équipe','J','V','Pts','Δ sets','Δ jeux'])tr.append(el('th',h));head.append(tr);t.append(head);const body=el('tbody');
 for(const r of rows){const row=el('tr');for(const v of [(Number(r.position)+offset)+(r.tied?' =':''),name(r.id),r.played,r.wins,r.points,r.sw-r.sl,r.gw-r.gl])row.append(el('td',String(v)));const labelCell=row.children[1];labelCell.replaceChildren(teamLabel(r.id));body.append(row);}
 t.append(body);wrap.append(t);section.append(wrap);section.append(el('small','2 pts victoire · 1 pt défaite jouée. Départage : différence de sets, puis de jeux, puis mêmes critères entre ex æquo.'));return section;
}
function drawControls(d){
 if(!isClub||!clubReady)return;
 const box=el('section','','programme-club draw-management'),status=el('p');status.setAttribute('role','status');
 box.append(el('h2','Gestion du tirage'),el('p',d.draw_published_at?(d.draw_public_complete?'Diffusion terminée · les rencontres sont publiées.':'Diffusion publique en cours · les rencontres restent masquées jusqu’à la fin.'):d.draw_prepared?'Tirage préparé en privé. Le public attend la diffusion.':'Préparez le tirage, puis lancez sa diffusion publique.','draw-management-status'));
 async function act(action,b){
 if(action==='publish'&&!confirm('Diffuser ce tirage en public maintenant ? Une équipe sera révélée chaque minute. Les autres onglets seront ouverts à la fin.'))return;
 b.disabled=true;status.textContent=action==='prepare'?'Préparation privée…':'Lancement de la diffusion…';
 try{const r=await withDeadline(client.rpc('suzini_e3_draw_manage',{p_action:action,p_division:division,p_simulation:!!data.simulation}));if(r.error)throw r.error;data=r.data;render();}catch(e){status.textContent=e.message;b.disabled=false;}
 }
 const actions=el('div','','draw-management-actions'),prepare=el('button',d.draw_prepared?'✓ Tirage préparé':'1 · Préparer le tirage'),publish=el('button',d.draw_published_at?'✓ Diffusion lancée':'2 · Diffuser le tirage');
 prepare.type=publish.type='button';prepare.disabled=!!d.draw_prepared||(!data.simulation&&!data.registration_closed);publish.disabled=!d.draw_prepared||!!d.draw_published_at||(!data.simulation&&Date.now()<Date.parse(data.draw_at));prepare.onclick=()=>act('prepare',prepare);publish.onclick=()=>act('publish',publish);actions.append(prepare,publish);box.append(actions,status);panel.append(box);
}
function expectedScore(score,format){
 const target=format===4?6:4;
 if(score.sets.some(([a,b])=>!((Math.max(a,b)===target&&Math.min(a,b)<=target-2)||(Math.max(a,b)===target+1&&[target-1,target].includes(Math.min(a,b))))))return false;
 const wins=score.sets.map(([a,b])=>a>b?'a':'b');
 if(wins[0]===wins[1])return !score.super;
 if(!score.super)return false;
 const [a,b]=score.super;return Math.max(a,b)===10&&Math.min(a,b)<=8||Math.max(a,b)>10&&Math.abs(a-b)===2;
}
function decisionDialog({title,content,confirmText,cancelText='Corriger',agreement=false}){
 return new Promise(resolve=>{
 const dialog=el('dialog','','match-confirm-dialog'),form=el('form');form.method='dialog';
 const heading=el('h2',title),actions=el('div','','match-confirm-actions'),cancel=el('button',cancelText),accept=el('button',confirmText);
 cancel.type='button';accept.type='submit';accept.className='confirm-primary';
 form.append(heading,content);
 if(agreement){const label=el('label','','recovery-consent'),box=el('input');box.type='checkbox';box.required=true;label.append(box,el('span','Je confirme que les deux équipes sont d’accord pour réduire ce délai.'));form.append(label);accept.disabled=true;box.onchange=()=>accept.disabled=!box.checked;}
 actions.append(cancel,accept);form.append(actions);dialog.append(form);document.body.append(dialog);
 let accepted=false;cancel.onclick=()=>dialog.close();form.onsubmit=e=>{e.preventDefault();accepted=true;dialog.close();};
 dialog.addEventListener('close',()=>{dialog.remove();resolve(accepted);},{once:true});dialog.showModal();
 });
}
function confirmMatchResult(m,sets){
 const totals=['a','b'].map(p=>sets.filter(s=>s.winner===p).length),winning=totals[0]>totals[1]?m.a:m.b;
 const content=el('div','','match-result-recap');content.append(el('span','🏆','result-trophy'),el('small','ÉQUIPE GAGNANTE'),el('strong',name(winning),'confirmed-winner'));
 const table=el('table'),head=el('tr');head.append(el('th','Équipe'));sets.forEach((s,i)=>head.append(el('th',i===2?'Super TB':'Set '+(i+1))));table.append(head);
 for(const [id,key] of [[m.a,'a'],[m.b,'b']]){const row=el('tr','','');if(id===winning)row.className='winning-score-row';row.append(el('td',name(id)));sets.forEach(s=>row.append(el('td',String(s[key]))));table.append(row);}
 content.append(table,el('p','Vérifie le gagnant et le score avant de confirmer la fin du match.'));
 return decisionDialog({title:'Confirmer le résultat',content,confirmText:'Valider le résultat',cancelText:'Corriger le score'});
}
function confirmEarlyStart(m,check){
 const content=el('div','','recovery-warning');content.append(el('span','⏱️','result-trophy'),el('strong','Le délai entre deux matchs n’est pas respecté.'),el('p',check.reason),el('p','Le prochain lancement est normalement possible à '+clock(check.until)+', heure de Guyane.'),el('p',name(m.a)+' contre '+name(m.b)));
 return decisionDialog({title:'Confirmer le lancement anticipé',content,confirmText:'Lancer avec l’accord des deux équipes',cancelText:'Attendre',agreement:true});
}
function matchStage(m){if(m.id==='P3')return 'Match pour la 3e place';if(m.id==='P5')return 'Match pour la 5e place';if(m.id==='P7')return 'Match pour la 7e place';if(m.id==='F')return 'Finale';return m.phase==='poules'&&current()?.count<=5?'Poule unique':m.stage;}
function launchCard(m){
 const card=el('section','','launch-card '+COURTS[m.court||division].className),readiness=launchReadiness(m,fixtures(true));
 const badge=el('span',m.division,'chrono-division-pill launch-division-pill '+(m.division==='DD'?'division-dd':'division-dm'));badge.setAttribute('aria-label',m.division==='DD'?'Double dames':'Double messieurs');card.append(badge);
 card.append(el('small','PROCHAIN MATCH','launch-kicker'),el('strong',matchStage(m),'launch-stage'),el('h2',name(m.a)+' contre '+name(m.b)),el('p',courtName(m.court||division),'launch-court'));
 const b=el('button','▶ Lancer le match'),status=el('p');b.type='button';b.className='signup-submit';status.setAttribute('role','status');
 b.disabled=(!readiness.allowed&&!readiness.canConfirm)||(!data.simulation&&!data.registration_closed);
 if(readiness.recoveryUntil)status.textContent='Heure réglementaire : '+clock(readiness.recoveryUntil)+', heure de Guyane. Tout lancement avant cette heure nécessite le consentement des deux équipes.';
 else if(!readiness.allowed&&!readiness.canConfirm)status.textContent=readiness.reason;
 else if(!data.simulation&&!data.registration_closed)status.textContent='Clôturez les inscriptions avant de lancer les matchs réels.';
 b.onclick=async()=>{
 b.disabled=true;status.textContent='Vérification du lancement…';
 try{
 let agreedUntil=0;
 for(let attempt=0;attempt<4;attempt++){
 const fresh=await withDeadline(client.rpc('suzini_e3_match_manager_state',{p_simulation:!!data.simulation}));if(fresh.error)throw fresh.error;data=fresh.data;
 const current=fixtures(true).find(x=>x.id===m.id&&x.division===m.division);if(!current||current.result||current.started_at)throw Error('Ce match a déjà changé. Actualisez la page.');
 const check=launchReadiness(current,fixtures(true));if(!check.allowed&&!check.canConfirm)throw Error(check.reason);
 if(check.canConfirm&&check.until>agreedUntil){
 if(!await confirmEarlyStart(current,check)){status.textContent='Lancement annulé : le délai de récupération est conservé.';return;}
 agreedUntil=check.until;continue;
 }
 const plan=planRows(),entry=plan.find(x=>x.id===m.id&&x.division===m.division);entry.started_at=data.server_now||new Date().toISOString();
 if(agreedUntil)entry.recovery_agreement={confirmed_at:entry.started_at,scheduled_not_before:new Date(agreedUntil).toISOString(),both_teams_agreed:true};
 await savePlan(plan);return;
 }
 throw Error('Le programme a changé plusieurs fois. Réessayez le lancement.');
 }catch(e){status.textContent=e.message;}finally{b.disabled=false;}
 };
 card.append(b,status);return card;
}
function recordedSets(m){
 if(m.progress&&(!m.result||m.progress.result_revision===m.result.revision))return m.progress.sets||[];
 if(!m.result)return [];
 const pairs=[...m.result.score.sets,...(m.result.score.super?[m.result.score.super]:[])];
 return pairs.map(([a,b])=>({a,b,winner:a>b?'a':'b',override:!!m.result.score.override}));
}
function expectedSet(a,b,index,format){
 const high=Math.max(a,b),low=Math.min(a,b),target=format===4?6:4;
 return index===2?(high===10&&low<=8||high>10&&high-low===2):(high===target&&low<=target-2||high===target+1&&[target-1,target].includes(low));
}
function resultForm(m,index){
 const section=el('article','','score-card '+COURTS[m.court||division].className),form=el('form');form.dataset.resultForm=m.id;
 const saved=recordedSets(m),wins=()=>['a','b'].map(p=>saved.filter(s=>s.winner===p).length);
 const finished=Math.max(...wins())>=2,committed=!!m.result&&(!m.progress||m.progress.result_revision!==m.result.revision);
 section.append(el('small',(index+1)+'. '+matchStage(m),'score-caption'));
 const teams=el('div','','set-match-teams');teams.append(teamLabel(m.a),el('small','vs'),teamLabel(m.b));section.append(teams);
 const ready=/^[0-9a-f-]{36}$/i.test(m.a)&&/^[0-9a-f-]{36}$/i.test(m.b)&&m.deps.every(id=>fixtures().some(x=>x.id===id&&x.result))&&(data.simulation||data.registration_closed)&&!!(m.started_at||m.result);
 async function finalize(sets,confirmed=false){
 if(!confirmed&&!await confirmMatchResult(m,sets))return null;
 const score={sets:sets.slice(0,2).map(s=>[s.a,s.b])};if(sets.length===3)score.super=[sets[2].a,sets[2].b];
 if(sets.some(s=>s.override)){score.override=true;score.winner=sets.filter(s=>s.winner==='a').length>sets.filter(s=>s.winner==='b').length?'a':'b';}
 const r=await withDeadline(client.rpc('suzini_e3_validate_result',{p_simulation:!!data.simulation,p_division:division,p_match:m.id,p_score:score,p_revision:m.result?.revision||0}));if(r.error)throw r.error;return r.data;
 }
 function editor(active){
 form.replaceChildren();
 const history=el('div','','set-history');
 saved.forEach((s,i)=>{const row=el('div','','set-validated');row.append(el('small',i===2?'Super TB':'Set '+(i+1)),el('strong',s.a+' – '+s.b),el('span','✓'));
 const edit=el('button','Modifier');edit.type='button';edit.disabled=!ready;edit.onclick=()=>{form.dataset.dirty='true';editor(i);};row.append(edit);history.append(row);});form.append(history);
 if(active===null){form.append(el('p',committed?'✓ Match validé':'Tous les sets sont validés.','set-complete'));
 if(!committed){const retry=el('button','Valider le match');retry.type='button';retry.className='signup-submit';retry.onclick=async()=>{retry.disabled=true;try{const next=await finalize(saved);if(next){data=next;render();}else retry.disabled=false;}catch(e){alert(e.message);retry.disabled=false;}};form.append(retry);}return;}
 const title=el('h3',active===2?'Super tie-break':'Set '+(active+1),'set-active-title'),grid=el('div','','set-entry-grid'),values=[];
 for(let p=0;p<2;p++){
 grid.append(teamLabel(p?m.b:m.a));
 const wrap=el('div','','score-stepper'),minus=el('button','−'),input=el('input'),plus=el('button','+');
 minus.type=plus.type='button';minus.className='score-minus';plus.className='score-plus';minus.textContent=plus.textContent='';wrap.addEventListener('dblclick',event=>event.preventDefault());input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.value=String(saved[active]?.[p?'b':'a']??0);
 const label=name(p?m.b:m.a)+' · '+title.textContent;input.setAttribute('aria-label',label);minus.setAttribute('aria-label','Retirer un point · '+label);plus.setAttribute('aria-label','Ajouter un point · '+label);
 function change(delta){input.value=String(Math.max(0,+input.value+delta));input.dispatchEvent(new Event('input',{bubbles:true}));}
 minus.onclick=()=>change(-1);plus.onclick=()=>change(1);wrap.append(minus,input,plus);grid.append(wrap);values.push(input);
 }
 const winner=el('select');winner.setAttribute('aria-label','Gagnant du set en cas d’égalité');
 for(const [v,label] of [['','Gagnant du set à préciser'],['a',name(m.a)],['b',name(m.b)]]){const o=el('option',label);o.value=v;winner.append(o);}
 winner.hidden=+values[0].value!==+values[1].value||+values[0].value+ +values[1].value===0;grid.addEventListener('input',()=>{winner.hidden=+values[0].value!==+values[1].value;});
 const button=el('button','Valider '+(active===2?'le super tie-break':'le set '+(active+1))),status=el('p');button.type='submit';button.className='signup-submit';button.disabled=!ready;status.setAttribute('role','status');
 form.append(title,grid,winner,button,status);if(!ready)form.append(el('small','En attente des matchs précédents ou de la clôture des inscriptions.'));
 form.onsubmit=async event=>{
 event.preventDefault();const a=+values[0].value,b=+values[1].value,normal=expectedSet(a,b,active,m.format);
 const side=a>b?'a':b>a?'b':winner.value;
 if(!side||a+b===0){status.textContent='Renseignez le score et le gagnant du set.';return;}
 if(!normal&&!confirm('Ce score ne correspond pas au format attendu pour '+title.textContent.toLowerCase()+'. Valider ce set quand même ?'))return;
 if(active<saved.length&&!confirm('Corriger ce set ? Les sets suivants devront être revalidés.'))return;
 button.disabled=true;form.dataset.submitting='true';status.textContent='Enregistrement du set…';
 try{
 const sets=[...saved.slice(0,active),{a,b,winner:side,override:!normal}];
 const totals=['a','b'].map(p=>sets.filter(s=>s.winner===p).length);
 if(Math.max(...totals)>=2&&!await confirmMatchResult(m,sets)){button.disabled=false;status.textContent='Tu peux corriger le score avant de valider.';return;}
 const plan=planRows(),entry=plan.find(x=>x.id===m.id&&x.division===m.division);
 entry.progress={sets,result_revision:m.result?.revision||0};
 const r=await withDeadline(client.rpc('suzini_e3_save_planning',{p_simulation:!!data.simulation,p_plan:plan,p_revision:data.planning_revision||0}));if(r.error)throw r.error;data=r.data;
 if(Math.max(...totals)>=2)data=await finalize(sets,true);
 document.dispatchEvent(new CustomEvent('suzini:form-saved',{detail:{form}}));render();
 }catch(e){status.textContent=e.message;button.disabled=false;}finally{delete form.dataset.submitting;}
 };
 }
 editor(finished?null:saved.length);section.append(form);return section;
}
function render(){
 panel.replaceChildren();document.body.dataset.matchView=selected;syncChronoFilter();const d=current();
 if(error){panel.append(note('Chargement impossible',error));return;}if(!d){panel.append(el('p','Chargement des matchs…'));return;}
 document.body.dataset.matchSimulation=String(!!data.simulation);
 if(!data.simulation&&!data.registration_closed){
 const suspended=data.registration_state==='suspended';
 panel.append(note(suspended?'⏸️ Inscriptions suspendues':'📝 Inscriptions en cours',
 'Le format sera fixé à la clôture définitive des inscriptions. '+(suspended?'La suspension ne déclenche ni les poules ni la programmation. ':'')+'Les rencontres seront publiées après la diffusion du tirage ; à 4 ou 5 équipes, la poule unique sera établie à la clôture, sans tirage.'));
 return;
 }
 if(!['tirage','chrono','poules','finales','classement'].includes(selected)){const focus=chrono().find(m=>m.started_at&&!m.result)||chrono().find(m=>!m.result),court=focus?.court||division;panel.append(el('div',courtName(court),'programme-court '+COURTS[court].className));}

 const matches=chrono(),count=matches.filter(m=>m.result).length;
 if(selected==='tirage'){
 if(d.no_draw){panel.append(drawInfo(d));return;}
 drawControls(d);drawRoulette(d);return;
 }
 if(!formatFor(d.count)){panel.append(note('Tableau en préparation',d.count+' équipe(s) inscrite(s). Il faut au moins 4 équipes pour maintenir ce tableau.'));return;}
 if(selected!=='chrono'&&!matchesPublished(d)){panel.append(note(d.draw_published_at?'🎡 Tirage en cours':'🎲 Tirage à venir','Les équipes et les rencontres seront affichées à la fin de la diffusion du tirage. Consultez « Tirage » pour suivre les révélations.'));return;}
 if(selected==='poules'&&d.count>=7){panel.append(note('🐔 Les poules sont au repos !','À 7 ou 8 équipes, on entre directement dans le tableau. Direction « Finales » pour les rencontres et les matchs de classement ! 🎾'));return;}
 if(selected==='chrono'){panel.append(chronoBoard());return; }
 if(selected==='resultats'){
 if(!isClub||!clubReady){panel.append(note('Résultats','Consultez les scores validés dans Chrono, Poules et Finales.'));return;}
 const running=matches.filter(m=>m.started_at&&!m.result);
 if(running.length){panel.append(el('h2','Match en cours'));for(const m of running){panel.append(el('p','Lancé à '+clock(m.started_at),'live-match-status'),resultForm(m,matches.findIndex(x=>x.id===m.id)));}}
 else{
 const next=matches.find(m=>!m.result);
 if(next)panel.append(launchCard(next));
 else panel.append(note(matches.length?'Tableau terminé 🏆':'Rencontres en attente',matches.length?'Tous les résultats sont validés.':'Les rencontres apparaîtront une fois les tableaux préparés.'));
 }
 const upcoming=matches.filter(m=>!m.result&&!m.started_at).slice(running.length?0:1);
 const details=el('details','','score-history upcoming-history'),summary=el('summary','Matchs à venir · '+upcoming.length);
 details.open=upcomingExpanded;summary.onclick=()=>{upcomingExpanded=!details.open;};details.append(summary);
 for(const m of upcoming){const item=el('article','','upcoming-match '+COURTS[m.court||division].className);item.append(el('small',clock(m.live??m.planned)+' · '+courtName(m.court||division,true)),el('strong',name(m.a)+' contre '+name(m.b)));details.append(item);}
 if(!upcoming.length)details.append(el('p','Aucun match à venir.','match-history-empty'));
 panel.append(details);
 const finished=matches.filter(m=>m.result);
 const history=el('details','','score-history finished-history'),finishedSummary=el('summary','Matchs terminés · '+finished.length);history.open=scoreHistoryExpanded;finishedSummary.onclick=()=>{scoreHistoryExpanded=!history.open;};history.append(finishedSummary);finished.forEach(m=>history.append(resultForm(m,matches.findIndex(x=>x.id===m.id))));if(!finished.length)history.append(el('p','Aucun match terminé.','match-history-empty'));panel.append(history);
 return;
 }
 if(selected==='poules'){
 if(d.count<=6){
 const pools=[d.pool_a,...(d.count===6?[d.pool_b]:[])];
 if(!pools[0]?.length){panel.append(note('Poules à venir','La composition des poules sera affichée après le tirage.'));return;}
 pools.forEach((pool,i)=>{const box=el('section','','programme-pool');box.append(el('h2',pools.length===1?'Poule unique':'Poule '+String.fromCharCode(65+i)));const list=el('ol');pool.forEach(id=>{const li=el('li');li.append(teamLabel(id));list.append(li);});box.append(list);panel.append(box,table(i?d.standings_b:d.standings_a,'Classement provisoire'));matches.filter(m=>m.phase==='poules'&&pool.includes(m.a)&&pool.includes(m.b)).forEach(m=>panel.append(card(m,matches.findIndex(x=>x.id===m.id))));});
 }
 return;
 }
 if(selected==='finales'){
 if(d.count<=5){panel.append(noFinalsInfo(d));return;}
 tennisBracket(matches);return;
 }
 if(selected==='classement'){rankingList(d,matches);return; }
}


function tennisBracket(matches,{host=panel,drawing=false}={}){
 const n=current()?.count||8,consolation=!drawing&&bracketView==='5-8';
 if(!drawing){
 const nav=el('nav','','tennis-bracket-tabs');nav.setAttribute('aria-label','Choix du tableau');
 for(const [value,label] of [['final','Tableau final'],['5-8',n===6?'Places 5–6':n===7?'Places 5–7':'Tableau 5–8']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(bracketView===value));b.onclick=()=>{bracketView=value;try{sessionStorage.setItem('suzini_e3_bracket',value);}catch{}render();};nav.append(b);}host.append(nav);
 }
 const chartMatches=[...matches];
 if(n===7&&!chartMatches.some(m=>m.id==='QF4'))chartMatches.push({id:'QF4',a:'Position 7 · libre',b:current()?.seeds?.[0]});
 let rounds;
 if(consolation)rounds=n===6?[['Match pour la 5e place',['P5']]]:n===7?[['Poule de classement · places 5–7',['C1','C2','C3']]]:[['Demi-finales 5–8',['DC1','DC2']],['5e place',['P5']]];
 else rounds=n===6?[['Demi-finales',['DF1','DF2']],['Finale',['F']]]:[['Quarts de finale',['QF1','QF2','QF3','QF4']],['Demi-finales',['DF1','DF2']],['Finale',['F']]];
 function chart(rounds,label){
 const scroll=el('div','','tennis-bracket-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',label);
 const columns=rounds.length,wrap=el('div','','tennis-bracket '+(columns===1?'one-round':columns===2?'two-rounds':'three-rounds')),heads=el('div','','tennis-bracket-heads'),grid=el('div','','tennis-bracket-grid');
 rounds.forEach(([title])=>heads.append(el('strong',title)));
 if(columns>1){
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 800');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('tennis-bracket-lines');
 const paths=columns===2?['M480 200 H500 V600 H480','M500 400 H520']:['M312 100 H328 V300 H312','M328 200 H344','M312 500 H328 V700 H312','M328 600 H344','M656 200 H672 V600 H656','M672 400 H688'];
 paths.forEach(line=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',line);svg.append(path);});grid.append(svg);
 }
 rounds.forEach(([,ids],col)=>ids.forEach((id,i)=>{const m=chartMatches.find(x=>x.id===id);if(!m)return;
 const node=el('article','','tennis-bracket-match');node.style.gridColumn=String(col+1);if(columns>1)node.style.gridRow=(ids.length===4?1+i*2:ids.length===2?2+i*4:4)+' / span 2';
 node.append(el('small',n===7&&id==='QF4'?'TS1 exemptée de quart':id==='F'?'🏆 Finale':id==='P3'?'🥉 3e place':id==='P5'?'5e place':id==='P7'?'7e place':id));
 for(const [team,side] of [[m.a,0],[m.b,1]]){const row=el('div','','tennis-bracket-team');if(drawing&&team)row.dataset.drawTeam=team;if(m.result?.winner===team)row.classList.add('bracket-winner');row.append(teamLabel(team));const scores=m.result?.score;if(scores)row.append(el('b',scores.sets.map(set=>set[side]).join(' · ')+(scores.super?' ('+scores.super[side]+')':'')));node.append(row);}if(m.result)node.append(el('small','✓ Terminé','bracket-result'));grid.append(node);
 }));
 wrap.append(heads,grid);scroll.append(wrap);return scroll;
 }
 host.append(chart(rounds,consolation?'Tableau des places 5 à '+n:'Tableau de tennis final'));
 if(consolation&&n===7&&current()?.standings_c?.length)host.append(table(current().standings_c,'Classement des places 5–7',4));
 const placement=!drawing&&chartMatches.find(m=>m.id===(consolation?'P7':'P3'));
 if(placement){const box=el('section','','bracket-placement');box.append(chart([[consolation?'Match pour la 7e place':'🥉 Match pour la 3e place',[placement.id]]],matchStage(placement)));host.append(box);}
}

function drawKey(d){return [data.simulation,division,d.draw_started_at||d.drawn_at||'pending'].join(':');}
function drawRoulette(d){
 const box=el('section','','draw-roulette-card'),started=!!d.draw_started_at,complete=!!d.draw_complete||!!d.drawn_at;
 const key=drawKey(d),replaying=drawReplay?.key===key,steps=d.draw_reveals||[],shown=replaying?steps.slice(0,drawReplay.index):steps;
 box.append(el('h2',replaying?'⏪ Replay du tirage':isClub&&d.draw_prepared&&!d.draw_published_at?'🔒 Tirage préparé en privé':started&&!complete?'🔴 Tirage en direct':'🎡 Tirage au sort'));
 box.append(el('p',replaying?'Même tirage, sans l’attente d’une minute.':!started?(data.simulation?'Le gestionnaire peut lancer ce tirage de test depuis l’espace Club.':'Lancement prévu le 5 novembre à 14 h, heure de Guyane.'):isClub?(d.draw_published_at?'Résultat visible en Club · diffusion publique à une équipe par minute.':'Le résultat reste privé jusqu’au clic sur « Diffuser le tirage ».'):'Une équipe révélée par minute · heure de Guyane.','draw-roulette-caption'));

 if(d.count===6){
 const seedIds=d.seeds?.length?d.seeds:data.teams.filter(t=>t.division===division).sort((a,b)=>(a.p1_rank+a.p2_rank)-(b.p1_rank+b.p2_rank)).slice(0,2).map(t=>t.id);
 const pools=el('div','','roulette-pools');pools.setAttribute('aria-label','Constitution des poules');
 for(const [pool,seedIndex] of [['A',1],['B',0]]){
 const card=el('section','','roulette-pool'),heading=el('h3','Poule '+pool),list=el('ol');card.append(heading);
 const first=el('li','','roulette-pool-seed');first.append(el('small','TS'+(seedIndex+1)),el('strong',seedIds[seedIndex]?name(seedIds[seedIndex]):'Tête de série'));list.append(first);
 for(let slot=0;slot<2;slot++){const index=slot*2+(pool==='A'?0:1),step=shown[index],row=el('li','',step?'is-revealed':'is-pending');if(step)row.dataset.drawTeam=step.team_id;row.append(el('small','Tirage '+(index+1)),el('strong',step?name(step.team_id):'Équipe à révéler'));list.append(row);}
 card.append(list);pools.append(card);
 }box.append(pools);
 }else{
 const seeds=el('div','','roulette-seeds');
 for(const [i,label] of [[1,'TS2 · en haut'],[0,'TS1 · en bas']]){const id=d.seeds?.[i];const seed=el('div');seed.append(el('small',label),el('strong',id?name(id):'Placement réservé'));seeds.append(seed);}
 box.append(seeds);
 }
 if(d.count===7)box.append(el('p','Position 1 : TS2 · positions 2 à 6 : tirage · position 7 libre · position 8 : TS1, exemptée de quart.','draw-roulette-caption'));

 const spinning=started&&(!complete||replaying&&drawReplay.index<steps.length);
 const stage=el('div','','roulette-stage'+(spinning?' is-spinning':''));
 const wheel=el('div','','roulette-wheel');wheel.setAttribute('aria-hidden','true');wheel.append(el('span','🎾'));stage.append(wheel);
 const display=el('div','','roulette-display'),title=el('small',!started?'Prêts pour le grand tour ?':spinning?'La roulette tourne…':'Tirage terminé 🏆'),team=el('strong',!started?'En attente du lancement':spinning?'🎾 🎾 🎾':steps.length?name(steps.at(-1).team_id):'Tirage enregistré');team.dataset.rouletteName='';display.append(title,team);stage.append(display);box.append(stage);
 const status=el('p','','roulette-countdown');status.dataset.rouletteCountdown='';status.setAttribute('aria-live','polite');box.append(status);
 if(complete&&!replaying){const replay=el('button','▶ Revoir le tirage · version rapide','roulette-replay');replay.type='button';replay.onclick=()=>{drawReplay={key,index:0,started:Date.now()};render();};box.append(replay);}
 if(replaying){const exit=el('button','Voir le résultat complet','roulette-replay');exit.type='button';exit.onclick=()=>{drawReplay=null;render();};box.append(exit);}
 const total=d.draw_total||d.count-2;
 if(d.count>=7){
 const seeds=d.seeds?.length?d.seeds:data.teams.filter(t=>t.division===division).sort((a,b)=>(a.p1_rank+a.p2_rank)-(b.p1_rank+b.p2_rank)).slice(0,2).map(t=>t.id);
 const positions=Array(8).fill(null);positions[0]=seeds[1];positions[7]=seeds[0];if(d.count===7)positions[6]='Position 7 · libre';
 shown.forEach((step,i)=>{positions[i+1]=step.team_id;});
 const fixtures=[];
 for(let i=0;i<4;i++)fixtures.push({id:'QF'+(i+1),a:positions[i*2]||'Position '+(i*2+1)+' · à tirer',b:positions[i*2+1]||'Position '+(i*2+2)+' · à tirer'});
 fixtures.push({id:'DF1',a:'Vainqueur QF1',b:'Vainqueur QF2'},{id:'DF2',a:'Vainqueur QF3',b:d.count===7?seeds[0]:'Vainqueur QF4'},{id:'F',a:'Vainqueur DF1',b:'Vainqueur DF2'});
 tennisBracket(fixtures,{host:box,drawing:true});
 }else if(d.count!==6){
 const list=el('ol','','roulette-reveals');list.setAttribute('aria-label','Équipes tirées');
 for(let i=0;i<total;i++){const step=shown[i],row=el('li','',step?'is-revealed':'');row.append(el('span',String(i+1),'roulette-number'),el('strong',step?name(step.team_id):'Équipe à révéler'),el('small',step?step.label:i%2===0?'Poule A':'Poule B'));list.append(row);}box.append(list);
 }

 if(started&&!complete)box.append(el('p','La programmation sera disponible à la dernière révélation.','draw-roulette-caption'));
 panel.append(box);updateRoulette();
 const revealKey=key+(replaying?':replay:'+drawReplay.started:':live'),previous=drawRevealSeen.get(revealKey);drawRevealSeen.set(revealKey,shown.length);
 if(previous!==undefined&&shown.length>previous)requestAnimationFrame(()=>flyDrawPlaque(box,shown.at(-1),key));
}

async function flyDrawPlaque(box,step,key){
 if(!step||!box.isConnected)return;
 const target=[...box.querySelectorAll('[data-draw-team]')].find(row=>row.dataset.drawTeam===step.team_id),stage=box.querySelector('.roulette-stage'),display=box.querySelector('.roulette-display');
 if(!target||!stage||!display)return;
 const token=++drawFlightToken;if(drawFlight){drawFlight.plaque?.remove();drawFlight.target?.classList.remove('draw-awaiting');}
 const title=display.querySelector('small'),label=display.querySelector('strong'),previousTitle=title?.textContent;
 if(title)title.textContent='🎉 Équipe tirée !';if(label)label.textContent=name(step.team_id);
 if(matchMedia('(prefers-reduced-motion: reduce)').matches){target.classList.add('draw-landed');return;}
 const plaque=el('div','','draw-flying-plaque '+(division==='DD'?'flying-dd':'flying-dm'));plaque.setAttribute('aria-hidden','true');plaque.append(el('small','🎾 '+step.label),el('strong',name(step.team_id)));
 drawFlight={token,plaque,target,key};target.classList.add('draw-awaiting');stage.classList.add('is-announcing');
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 const valid=()=>drawFlightToken===token&&box.isConnected&&selected==='tirage';
 try{
 stage.scrollIntoView({behavior:'smooth',block:'nearest'});await pause(260);if(!valid())return;
 const start=display.getBoundingClientRect(),width=Math.min(260,innerWidth-36),x=Math.max(width/2+12,Math.min(innerWidth-width/2-12,start.left+start.width/2)),y=start.top+start.height/2;
 Object.assign(plaque.style,{width:width+'px',left:x+'px',top:y+'px'});document.body.append(plaque);
 await plaque.animate([{opacity:0,transform:'translate(-50%,-50%) scale(.82) rotate(-4deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1.03) rotate(1deg)'},{opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(0deg)'}],{duration:280,fill:'forwards',easing:'ease-out'}).finished;
 if(!valid())return;
 target.scrollIntoView({behavior:'smooth',block:'nearest',inline:'nearest'});await pause(300);if(!valid())return;
 const end=target.getBoundingClientRect(),endX=end.left+end.width/2,endY=end.top+end.height/2;
 await plaque.animate([{left:x+'px',top:y+'px',opacity:1,transform:'translate(-50%,-50%) scale(1) rotate(0deg)'},{left:(x+(endX-x)*.48)+'px',top:(Math.min(y,endY)-42)+'px',opacity:1,transform:'translate(-50%,-50%) scale(1.04) rotate(-3deg)',offset:.48},{left:endX+'px',top:endY+'px',opacity:.15,transform:'translate(-50%,-50%) scale('+Math.min(1,end.width/width)+') rotate(0deg)'}],{duration:800,fill:'forwards',easing:'cubic-bezier(.35,0,.2,1)'}).finished;
 if(valid()){target.classList.remove('draw-awaiting');target.classList.add('draw-landed');}
 }catch{}finally{
 plaque.remove();target.classList.remove('draw-awaiting');stage.classList.remove('is-announcing');
 if(drawFlight?.token===token){drawFlight=null;if(title&&title.isConnected)title.textContent=previousTitle;}
 }
}

function updateRoulette(){
 if(selected!=='tirage'||!data)return;
 const d=current();if(!d||d.no_draw)return;
 const key=drawKey(d),replaying=drawReplay?.key===key,total=d.draw_total||d.count-2;
 if(replaying){const index=Math.min((d.draw_reveals||[]).length,Math.floor((Date.now()-drawReplay.started)/2200));if(index!==drawReplay.index){drawReplay.index=index;render();return;}}
 const complete=!!d.draw_complete||!!d.drawn_at,spinning=d.draw_started_at&&(!complete||replaying&&drawReplay.index<(d.draw_reveals||[]).length);
 const count=replaying?drawReplay.index:d.draw_reveal_count||0;
 const displayed=document.querySelector('[data-roulette-name]'),status=document.querySelector('[data-roulette-countdown]');
 if(!status)return;
 if(!d.draw_started_at){status.textContent='En attente de la diffusion publique du tirage.';return;}
 if(!spinning){status.textContent=total+' équipes tirées · '+(replaying?'replay terminé':'tirage terminé');return;}
 const revealed=(d.draw_reveals||[]).slice(0,count).map(x=>x.team_id),candidates=data.teams.filter(t=>t.division===division&&!(d.seeds||[]).includes(t.id)&&!revealed.includes(t.id));
 if(displayed&&candidates.length&&!drawFlight)displayed.textContent=candidates[Math.floor(Date.now()/140)%candidates.length].team_name;
 if(replaying){status.textContent='Replay rapide · '+count+' / '+total+' équipes révélées';return;}
 const now=Date.now()+serverOffset,next=Date.parse(d.draw_started_at)+(count+1)*60000,seconds=Math.max(0,Math.ceil((next-now)/1000));
 status.textContent=count+' / '+total+' équipes révélées · prochaine dans '+Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');
 if(seconds===0&&!drawRefreshBusy){drawRefreshBusy=true;load().finally(()=>drawRefreshBusy=false);}
}
setInterval(updateRoulette,160);

function select(tab){selected=tab.dataset.programme;try{const url=new URL(location.href);url.searchParams.set('matchtab',selected);history.replaceState(null,'',url);sessionStorage.setItem('suzini_e3_match_tab_'+document.body.dataset.space,selected);}catch{}tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});panel.setAttribute('aria-labelledby',tab.id);render();}
tabs.forEach((tab,i)=>{tab.onclick=()=>select(tab);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();select(tabs[n]);tabs[n].focus();};});
document.addEventListener('publicZoneChange',e=>{division=e.detail.epreuve;render();});
async function load(){
 const version=++generation,wanted=mode;
 try{
 let next;
 if(isClub){const r=await withDeadline(client.rpc('suzini_e3_match_manager_state',{p_simulation:false}));if(r.error)throw r.error;next=r.data;}
 else next=await rpc('suzini_e3_match_state',{p_simulation:false});
 if(version!==generation||wanted!==mode)return;data=next;serverOffset=Date.parse(next.server_now||new Date().toISOString())-Date.now();error='';render();
 }catch(e){if(version!==generation)return;error=e.message||'Vérifiez votre connexion.';render();}
}
if(isClub){
 async function ready(){const r=await client.rpc('suzini_e3_club');clubReady=!r.error;if(clubReady){mode='real';await load();}}
 document.addEventListener('club:ready',ready);ready();
}

document.querySelector('.club-switch')?.addEventListener('click',event=>{const a=event.currentTarget,u=new URL(a.href);u.searchParams.delete('simulation');if(selected==='chrono')u.searchParams.set('chronofilter',chronoFilter);a.href=u.href;});
let rememberedTab='';try{rememberedTab=sessionStorage.getItem('suzini_e3_match_tab_'+document.body.dataset.space)||'';}catch{}
const requested=tabs.find(t=>t.dataset.programme===(params.has('matchtab')?params.get('matchtab'):rememberedTab));select(requested||tabs[0]);
await load();
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]')&&!document.querySelector('[data-result-form][data-dirty=true],[data-result-form][data-submitting=true]'))load();},10000);
