import {rpc} from './supabase-site.js?v=94';
import {client,withDeadline} from './private-client.js?v=94';
import {COURTS,formatFor,scheduleDraws} from './tournament-format.js?v=102';
import {buildTimeline,launchReadiness} from './match-timing.js?v=115';
const panel=document.getElementById('programme-panel'),tabs=[...document.querySelectorAll('[data-programme]')],isClub=document.body.dataset.space==='club';
const el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
let scoreHistoryExpanded=false,upcomingExpanded=false;
let bracketView='final';try{bracketView=sessionStorage.getItem('suzini_e3_bracket')||'final';}catch{}
let division='DM',selected='chrono',data=null,error='',clubReady=false,mode='real',generation=0;
try{division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{}
if(!COURTS[division])division='DM';
const params=new URLSearchParams(location.search);
const preview=params.get('simulation')==='1';
function courtName(id,compact=false){
 const emoji=id==='DM'?'🐝':'🌶️',label=id==='DM'?'Manon Queen Bee':'Lisa de los pimentos',icons=emoji.repeat(compact?1:3);
 return icons+' '+label+' '+icons;
}
function current(){return data?.divisions.find(d=>d.division===division);}
function name(id){return data?.teams.find(t=>t.id===id)?.team_name||id||'À déterminer';}
const clock=(value,seconds=false)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Cayenne',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(new Date(value));
function scoreText(r){return r?r.score.sets.map(s=>s.join('–')).join(' / ')+(r.score.super?' · STB '+r.score.super.join('–'):''):'';}
function fixtures(all=false){
 if(!data)return [];
 const slots=scheduleDraws(data.divisions.filter(d=>d.count<=5||d.drawn_at)).map(m=>({...m,...(data.planning||[]).find(p=>p.id===m.id&&p.division===m.division)})).sort((a,b)=>a.slot-b.slot);
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
function chronoBoard(){
 const all=chrono(true),editable=isClub&&clubReady,board=el('section','','rose-chrono'+(editable?' chrono-editable':'')),head=el('div','','rose-chrono-head');
 head.append(el('span','Tour'),el('strong',courtName('DM',true),COURTS.DM.className));
 if(editable)head.append(el('span','','exchange-spacer'));head.append(el('strong',courtName('DD',true),COURTS.DD.className));board.append(head);
 const slots=[...new Set(all.map(m=>m.slot))].sort((a,b)=>a-b);
 for(let si=0;si<slots.length;si++){
 const slot=slots[si],ms=all.filter(m=>m.slot===slot),row=el('section','','rose-chrono-row'),tour=el('div','','rose-tour');
 const left=ms.find(m=>(m.court||m.division)==='DM'),right=ms.find(m=>(m.court||m.division)==='DD');
 tour.append(el('b',String(slot+1)),el('small',ms.every(m=>m.result)?'Terminé':ms.some(m=>m.started_at&&!m.result)?'En cours':'À venir'));row.append(tour);
 for(const court of ['DM','DD']){
 if(court==='DD'&&editable)row.append(exchangeButton(left||right,'court',null,left?right:null));
 const m=court==='DM'?left:right,cell=el('article','','rose-match '+COURTS[court].className);
 if(!m){cell.append(el('small','Terrain disponible','rose-empty'));row.append(cell);continue;}
 if(!(m.phase==='poules'&&data.divisions.find(d=>d.division===m.division)?.count<=5))cell.append(el('small',m.stage,'rose-stage'));
 cell.append(el('b',clock(m.started_at||(m.result?m.result.validated_at:m.live||m.planned)),'rose-hour'));
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
 if(editable&&si<slots.length-1){
 const next=slots[si+1],separator=el('div','','chrono-between');separator.append(el('span',''));
 for(const court of ['DM','DD']){
 if(court==='DD')separator.append(el('span',''));
 const top=all.find(m=>m.slot===slot&&(m.court||m.division)===court),bottom=all.find(m=>m.slot===next&&(m.court||m.division)===court);
 separator.append(exchangeButton(top||bottom,top?'down':'up',top?next:slot,top?bottom:null));
 }board.append(separator);
 }
 }
 if(!slots.length)board.append(note('Programme à venir','Les rencontres apparaîtront une fois les tableaux préparés.'));return board;
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
 const box=el('section','','programme-club'),status=el('p');status.setAttribute('role','status');
 const validate=el('button',d.validated_at?'Format validé':'Valider le format');
 validate.type='button';validate.disabled=!!d.validated_at||!formatFor(d.count)||(!data.simulation&&!data.registration_closed);
 async function act(action,b){b.disabled=true;status.textContent='Enregistrement…';try{const {error}=await client.rpc(data.simulation?'suzini_e3_match_simulation':'suzini_e3_programme_manage',{p_action:action,p_division:division});if(error)throw error;await load();}catch(e){status.textContent=e.message;b.disabled=false;}}
 validate.onclick=()=>act('validate',validate);
 if(!d.no_draw){const draw=el('button',d.drawn_at?'Tirage effectué':'Effectuer le tirage');draw.type='button';draw.disabled=!d.validated_at||!!d.drawn_at||(!data.simulation&&Date.now()<Date.parse(data.draw_at));draw.onclick=()=>act('draw',draw);box.append(draw);}
 box.append(status);panel.append(box);
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
function launchCard(m){
 const card=el('section','','launch-card '+COURTS[m.court||division].className),readiness=launchReadiness(m,fixtures(true));
 card.append(el('small','PROCHAIN MATCH','launch-kicker'),el('h2',name(m.a)+' contre '+name(m.b)),el('p',courtName(m.court||division),'launch-court'));
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
 const fresh=await withDeadline(client.rpc('suzini_e3_match_state',{p_simulation:!!data.simulation}));if(fresh.error)throw fresh.error;data=fresh.data;
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
 section.append(el('small',(index+1)+'. '+(m.phase==='poules'&&current().count<=5?'Poule unique':m.stage),'score-caption'));
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
 minus.type=plus.type='button';input.type='number';input.min='0';input.step='1';input.inputMode='numeric';input.value=String(saved[active]?.[p?'b':'a']??0);
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
 panel.replaceChildren();document.body.dataset.matchView=selected;const d=current();
 if(error){panel.append(note('Chargement impossible',error));return;}if(!d){panel.append(el('p','Chargement des matchs…'));return;}
 document.body.dataset.matchSimulation=String(!!data.simulation);
 if(!['tirage','chrono','poules','finales','classement'].includes(selected)){const focus=chrono().find(m=>m.started_at&&!m.result)||chrono().find(m=>!m.result),court=focus?.court||division;panel.append(el('div',courtName(court),'programme-court '+COURTS[court].className));}

 const matches=chrono(),count=matches.filter(m=>m.result).length;
 if(selected==='tirage'){
 panel.append(d.no_draw?drawInfo(d):note(d.drawn_at?'Tirage effectué ✅':'Tirage au sort',d.drawn_at?'Les équipes sont réparties. Consultez les poules ou le tableau final.':data.simulation?'Effectuez le tirage dans l’espace Club pour former les poules et préparer les rencontres.':'Le 5 novembre à 14 h, heure de Guyane.'));
 if(!d.no_draw)drawControls(d);
 return;
 }
 if(!formatFor(d.count)){panel.append(note('Tableau en préparation',d.count+' équipe(s) inscrite(s). Il faut au moins 4 équipes pour maintenir ce tableau.'));return;}
 if(d.count>=6&&!d.drawn_at){panel.append(note('🎲 Tirage à effectuer','Aucune poule ni programmation avant le tirage. Rendez-vous dans Tirage'+(isClub?' pour répartir les équipes.':' : les rencontres seront ensuite publiées.')));return;}
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
 }else{panel.append(note('Format sans poules préliminaires','Consultez Finales pour les quarts et les matchs de classement.'));matches.filter(m=>m.phase==='classement').forEach((m,i)=>panel.append(card(m,i)));}
 return;
 }
 if(selected==='finales'){
 if(d.count<=5){panel.append(noFinalsInfo(d));return;}
 if(d.count===8){tennisBracket(matches);return;}
 matches.filter(m=>m.phase!=='poules').forEach(m=>panel.append(card(m,matches.findIndex(x=>x.id===m.id))));return;
 }
 if(selected==='classement'){rankingList(d,matches);return; }
}

function tennisBracket(matches){
 const nav=el('nav','','tennis-bracket-tabs');nav.setAttribute('aria-label','Choix du tableau');
 for(const [value,label] of [['final','Tableau final'],['5-8','Tableau 5–8']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(bracketView===value));b.onclick=()=>{bracketView=value;try{sessionStorage.setItem('suzini_e3_bracket',value);}catch{}render();};nav.append(b);}panel.append(nav);
 const consolation=bracketView==='5-8',scroll=el('div','','tennis-bracket-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',consolation?'Tableau de tennis des places 5 à 8':'Tableau de tennis final');
 const rounds=consolation?[['Demi-finales 5–8',['DC1','DC2']],['5e place',['P5']]]:[['Quarts de finale',['QF1','QF2','QF3','QF4']],['Demi-finales',['DF1','DF2']],['Finale',['F']]];
 const wrap=el('div','','tennis-bracket '+(consolation?'two-rounds':'three-rounds')),heads=el('div','','tennis-bracket-heads'),grid=el('div','','tennis-bracket-grid');
 rounds.forEach(([label])=>heads.append(el('strong',label)));
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1000 800');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-hidden','true');svg.classList.add('tennis-bracket-lines');
 const paths=consolation?['M480 200 H500 V600 H480','M500 400 H520']:['M312 100 H328 V300 H312','M328 200 H344','M312 500 H328 V700 H312','M328 600 H344','M656 200 H672 V600 H656','M672 400 H688'];
 paths.forEach(line=>{const path=document.createElementNS(ns,'path');path.setAttribute('d',line);svg.append(path);});grid.append(svg);
 rounds.forEach(([,ids],col)=>ids.forEach((id,i)=>{const m=matches.find(x=>x.id===id);if(!m)return;const node=el('article','','tennis-bracket-match');node.style.gridColumn=String(col+1);node.style.gridRow=(ids.length===4?1+i*2:ids.length===2?2+i*4:4)+' / span 2';
 node.append(el('small',id==='F'?'🏆 Finale':id==='P5'?'5e place':id));
 for(const [team,side] of [[m.a,0],[m.b,1]]){const row=el('div','','tennis-bracket-team');if(m.result?.winner===team)row.classList.add('bracket-winner');row.append(teamLabel(team));const scores=m.result?.score;if(scores){const score=el('b',scores.sets.map(set=>set[side]).join(' · ')+(scores.super?' ('+scores.super[side]+')':''));row.append(score);}node.append(row);}if(m.result)node.append(el('small','✓ Terminé','bracket-result'));grid.append(node);
 }));
 wrap.append(heads,grid);scroll.append(wrap);panel.append(scroll);
 const placement=matches.find(m=>m.id===(consolation?'P7':'P3'));if(placement){const box=el('section','','bracket-placement');box.append(el('h3',consolation?'Match pour la 7e place':'🥉 Match pour la 3e place'),card(placement,matches.indexOf(placement)));panel.append(box);}
}

function select(tab){selected=tab.dataset.programme;try{const url=new URL(location.href);url.searchParams.set('matchtab',selected);history.replaceState(null,'',url);sessionStorage.setItem('suzini_e3_match_tab_'+document.body.dataset.space,selected);}catch{}tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});panel.setAttribute('aria-labelledby',tab.id);render();}
tabs.forEach((tab,i)=>{tab.onclick=()=>select(tab);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();select(tabs[n]);tabs[n].focus();};});
document.addEventListener('publicZoneChange',e=>{division=e.detail.epreuve;render();});
function toolbar(){
 if(document.getElementById('match-data-mode'))return;
 const box=el('section','','match-data-mode');box.id='match-data-mode';
 const buttons=el('div','','match-mode-buttons');
 for(const [value,label] of [['real','Données réelles'],['simulation','Simulation privée']]){const b=el('button',label);b.type='button';b.dataset.matchMode=value;b.onclick=()=>{mode=value;try{localStorage.setItem('suzini_e3_match_mode',mode);}catch{}sync();load();};buttons.append(b);}
 const reset=el('button','Réinitialiser les essais');reset.type='button';reset.dataset.resetSimulation='';reset.onclick=async()=>{if(!confirm('Effacer uniquement les résultats et tirages fictifs ? Les équipes et résultats réels restent inchangés.'))return;reset.disabled=true;try{const {error}=await client.rpc('suzini_e3_match_simulation',{p_action:'reset'});if(error)throw error;await load();}catch(e){error=e.message;render();}finally{reset.disabled=false;}};
 box.append(buttons);if(isClub)box.append(reset);document.querySelector('main').prepend(box);sync();
}
function sync(){document.querySelectorAll('[data-match-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.matchMode===mode)));const reset=document.querySelector('[data-reset-simulation]');if(reset)reset.hidden=mode!=='simulation';}
async function load(){
 const version=++generation,wanted=mode;
 try{
 let next;
 if(wanted==='simulation'){const r=await withDeadline(client.rpc('suzini_e3_match_state',{p_simulation:true}));if(r.error)throw r.error;next=r.data;}
 else next=await rpc('suzini_e3_match_state',{p_simulation:false});
 if(version!==generation||wanted!==mode)return;data=next;error='';render();
 }catch(e){if(version!==generation)return;if(!isClub&&wanted==='simulation'){mode='real';sync();await load();return;}error=e.message||'Vérifiez votre connexion.';render();}
}
if(isClub){
 async function ready(){const r=await client.rpc('suzini_e3_club');clubReady=!r.error;if(clubReady){try{mode=localStorage.getItem('suzini_e3_match_mode')||'simulation';}catch{mode='simulation';}await load();}}
 document.addEventListener('club:ready',ready);ready();
}else{
 try{
 const access=await withDeadline(client.rpc('suzini_e3_preview_role'));
 if(!access.error&&(access.data?.admin||access.data?.manager)){
   if(preview)mode='simulation';
   else try{mode=localStorage.getItem('suzini_e3_match_mode')||'simulation';}catch{mode='simulation';}

 }
 }catch{}
}
document.querySelector('.club-switch')?.addEventListener('click',event=>{const a=event.currentTarget,u=new URL(a.href);if(data?.simulation)u.searchParams.set('simulation','1');else u.searchParams.delete('simulation');a.href=u.href;});
let rememberedTab='';try{rememberedTab=sessionStorage.getItem('suzini_e3_match_tab_'+document.body.dataset.space)||'';}catch{}
const requested=tabs.find(t=>t.dataset.programme===(params.has('matchtab')?params.get('matchtab'):rememberedTab));select(requested||tabs[0]);
await load();
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]')&&!document.querySelector('[data-result-form][data-dirty=true],[data-result-form][data-submitting=true]'))load();},10000);
