import {rpc} from './supabase-site.js?v=94';
import {client,withDeadline} from './private-client.js?v=94';
import {COURTS,formatFor,scheduleDraws} from './tournament-format.js?v=102';
const panel=document.getElementById('programme-panel'),tabs=[...document.querySelectorAll('[data-programme]')],isClub=document.body.dataset.space==='club';
const el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
let division='DM',selected='chrono',data=null,error='',clubReady=false,mode='real',generation=0;
try{division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{}
if(!COURTS[division])division='DM';
const params=new URLSearchParams(location.search);
const preview=params.get('simulation')==='1';
function current(){return data?.divisions.find(d=>d.division===division);}
function name(id){return data?.teams.find(t=>t.id===id)?.team_name||id||'À déterminer';}
const clock=(value,seconds=false)=>new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Cayenne',hour:'2-digit',minute:'2-digit',...(seconds?{second:'2-digit'}:{})}).format(new Date(value));
function scoreText(r){return r?r.score.sets.map(s=>s.join('–')).join(' / ')+(r.score.super?' · STB '+r.score.super.join('–'):''):'';}
function fixtures(all=false){
 if(!data)return [];
 const slots=scheduleDraws(data.divisions).map(m=>({...m,...(data.planning||[]).find(p=>p.id===m.id&&p.division===m.division)})).sort((a,b)=>a.slot-b.slot);
 return slots.map(base=>{const m=data.matches.find(m=>m.division===base.division&&m.id===base.id);return m?{...base,...m}:null;}).filter(Boolean).filter(m=>all||m.division===division);
}
function chrono(all=false){
 const matches=fixtures(true),anchors={};
 const rows=matches.map(m=>{
 const court=m.court||m.division,planned=Date.parse('2026-11-06T21:00:00Z')+m.slot*30*60000;
 let live=anchors[court]??planned;
 if(m.forced_at)live=Date.parse(m.forced_at);
 const adjusted=anchors[court]!==undefined||!!m.forced_at;
 if(m.result)anchors[court]=Date.parse(m.result.validated_at);
 else anchors[court]=live+30*60000;
 return {...m,planned,live:m.result?null:live,adjusted};
 });
 return rows.filter(m=>all||m.division===division);
}
async function savePlan(plan){
 const {data:next,error}=await withDeadline(client.rpc('suzini_e3_save_planning',{p_simulation:!!data.simulation,p_plan:plan,p_revision:data.planning_revision||0}));
 if(error)throw error;data=next;render();
}
function planningControls(m){
 const box=el('div','','match-plan-controls');
 const label='Match '+name(m.a)+' contre '+name(m.b);
 async function move(direction){
 const plan=fixtures(true).map(x=>({id:x.id,division:x.division,slot:x.slot,court:x.court||x.division,...(x.forced_at?{forced_at:x.forced_at}:{})}));
 const item=plan.find(x=>x.id===m.id&&x.division===m.division),old={slot:item.slot,court:item.court};
 if(direction==='up'||direction==='down')item.slot+=direction==='up'?-1:1;
 else item.court=item.court==='DM'?'DD':'DM';
 if(item.slot<0)return;
 const other=plan.find(x=>x!==item&&x.slot===item.slot&&x.court===item.court);
 if(other){if(fixtures(true).find(x=>x.id===other.id&&x.division===other.division)?.result)throw Error('Ce créneau contient un résultat déjà validé.');other.slot=old.slot;other.court=old.court;}
 await savePlan(plan);
 }
 for(const [dir,icon,title] of [['up','↑','Avancer le match'],['down','↓','Retarder le match'],['left','←','Changer de terrain'],['right','→','Changer de terrain']]){
 const b=el('button',icon);b.type='button';b.title=title;b.setAttribute('aria-label',title+' · '+label);
 b.disabled=!!m.result||(dir==='up'&&m.slot===0)||(dir==='left'&&m.court==='DM')||(dir==='right'&&m.court==='DD');
 b.onclick=async()=>{b.disabled=true;try{await move(dir);}catch(e){alert(e.message);b.disabled=false;}};box.append(b);
 }
 const time=el('button','🕒');time.type='button';time.title='Forcer une heure';time.setAttribute('aria-label','Forcer une heure · '+label);time.disabled=!!m.result;
 time.onclick=()=>{
 const dialog=el('dialog','','match-time-dialog'),form=el('form');form.method='dialog';
 const input=el('input');input.type='datetime-local';input.required=true;input.value=new Date((m.live??m.planned)-3*3600000).toISOString().slice(0,16);
 const lab=el('label','Heure de Guyane');lab.append(input);const status=el('p');status.setAttribute('role','status');
 const save=el('button','Appliquer'),cancel=el('button','Annuler'),reset=el('button','Revenir à l’heure calculée');save.type='submit';cancel.type=reset.type='button';cancel.onclick=()=>dialog.close();
 async function persist(value){save.disabled=true;try{const plan=fixtures(true).map(x=>({id:x.id,division:x.division,slot:x.slot,court:x.court||x.division,...(x.forced_at?{forced_at:x.forced_at}:{})}));const item=plan.find(x=>x.id===m.id&&x.division===m.division);delete item.forced_at;if(value)item.forced_at=value;await savePlan(plan);dialog.close();}catch(e){status.textContent=e.message;save.disabled=false;}}
 form.onsubmit=e=>{e.preventDefault();persist(new Date(input.value+'-03:00').toISOString());};reset.onclick=()=>persist(null);
 form.append(el('h2','Heure du match'),lab,el('small','Les matchs suivants du terrain seront décalés à partir de cette heure.'),status,save,reset,cancel);dialog.append(form);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
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
 const all=chrono(true),board=el('section','','rose-chrono'),head=el('div','','rose-chrono-head');
 head.append(el('span','Tour'));
 for(const court of ['DM','DD'])head.append(el('strong',COURTS[court].name,COURTS[court].className));
 board.append(head);
 const slots=[...new Set(all.map(m=>m.slot))].sort((a,b)=>a-b);
 for(const slot of slots){
 const ms=all.filter(m=>m.slot===slot),row=el('section','','rose-chrono-row'),tour=el('div','','rose-tour');
 tour.append(el('b',String(slot+1)),el('small',ms.every(m=>m.result)?'Terminé':'À venir'));row.append(tour);
 for(const court of ['DM','DD']){
 const m=ms.find(m=>(m.court||m.division)===court),cell=el('article','','rose-match '+COURTS[court].className);
 if(!m){cell.append(el('small','Terrain disponible','rose-empty'));row.append(cell);continue;}
 if(!(m.phase==='poules'&&data.divisions.find(d=>d.division===m.division)?.count<=5))cell.append(el('small',m.stage,'rose-stage'));
 cell.append(el('b',clock(m.result?m.result.validated_at:m.live??m.planned),'rose-hour'));
 if(m.result)cell.lastChild.title='Heure de validation · Guyane';
 const a=el('div','','rose-team'),b=el('div','','rose-team');
 for(const [id,target] of [[m.a,a],[m.b,b]]){target.append(el('span',name(id)));if(m.result?.winner===id)target.classList.add('rose-winner');}
 const versus=el('div','','rose-versus');versus.append(el(m.result?'strong':'small',m.result?scoreText(m.result):'vs'));
 cell.append(a,versus,b);
 if(m.result)cell.append(el('small','✓ Résultat validé','rose-status'));

 if(isClub&&clubReady)cell.append(planningControls(m));
 row.append(cell);
 }
 board.append(row);
 }
 if(!slots.length)board.append(note('Programme à venir','Les rencontres apparaîtront une fois les tableaux préparés.'));
 return board;
}

function card(m,index){
 const c=el('article','','programme-match '+COURTS[m.court||division].className);
 if(m.result)c.classList.add('match-finished');
 c.append(el('small',(index+1)+'. '+m.stage),el('strong',name(m.a)+' / '+name(m.b)));
 if(m.result)c.append(el('b',scoreText(m.result),'match-score'),el('small','Validé à '+clock(m.result.validated_at,true)+' · Guyane'));
 else c.append(el('span',(m.adjusted?'Horaire actualisé : ':'Horaire initial : ')+clock(m.live??m.planned),'match-time'));
 if(selected!=='poules')c.append(el('small',COURTS[m.court||division].name));
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
 validate.onclick=()=>act('validate',validate);box.append(validate);
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
function resultForm(m,index){
 const section=el('article','','score-card '+COURTS[division].className),form=el('form');form.dataset.resultForm=m.id;
 section.append(el('small',(index+1)+'. '+(m.phase==='poules'&&current().count<=5?'Poule unique':m.stage),'score-caption'));
 const inputs=[[],[]],grid=el('div','','score-grid-stepper');
 grid.append(el('span',''),el('strong','Set 1'),el('strong','Set 2'),el('strong','Super TB'));
 for(let p=0;p<2;p++){
 grid.append(teamLabel(p?m.b:m.a));
 for(let s=0;s<3;s++){
 const wrap=el('div','','score-stepper'),minus=el('button','−'),input=el('input'),plus=el('button','+');
 minus.type=plus.type='button';input.type='number';input.min='0';input.step='1';input.inputMode='numeric';
 input.value=String(s<2?(m.result?.score.sets[s]?.[p]??0):(m.result?.score.super?.[p]??0));
 const label=name(p?m.b:m.a)+' · '+(s===2?'Super tie-break':'Set '+(s+1));input.setAttribute('aria-label',label);minus.setAttribute('aria-label','Retirer un point · '+label);plus.setAttribute('aria-label','Ajouter un point · '+label);
 function change(delta){input.value=String(Math.max(0,Number(input.value||0)+delta));input.dispatchEvent(new Event('input',{bubbles:true}));}
 minus.onclick=()=>change(-1);plus.onclick=()=>change(1);wrap.append(minus,input,plus);inputs[p][s]=input;grid.append(wrap);
 }
 }
 const winner=el('select');winner.setAttribute('aria-label','Équipe gagnante');
 for(const [value,label] of [['','Gagnant à préciser'],['a',name(m.a)],['b',name(m.b)]]){const o=el('option',label);o.value=value;winner.append(o);}
 function scoreValue(){const score={sets:[[+inputs[0][0].value,+inputs[1][0].value],[+inputs[0][1].value,+inputs[1][1].value]]};if(+inputs[0][2].value||+inputs[1][2].value)score.super=[+inputs[0][2].value,+inputs[1][2].value];return score;}
 function derive(){const s=scoreValue();let a=0,b=0;for(const [x,y] of [...s.sets,...(s.super?[s.super]:[])]){if(x>y)a++;if(y>x)b++;}winner.value=a>b?'a':b>a?'b':'';winner.disabled=expectedScore(s,m.format);}
 grid.addEventListener('input',derive);derive();
 const b=el('button',m.result?'Corriger et valider':'Valider'),status=el('p');b.type='submit';b.className='signup-submit';status.setAttribute('role','status');
 const ready=/^[0-9a-f-]{36}$/i.test(m.a)&&/^[0-9a-f-]{36}$/i.test(m.b)&&m.deps.every(id=>fixtures().some(x=>x.id===id&&x.result))&&(data.simulation||data.registration_closed);
 b.disabled=!ready;form.append(grid,winner,b,status);if(!ready)form.append(el('small','En attente des matchs précédents ou de la clôture des inscriptions.'));
 form.onsubmit=async e=>{
 e.preventDefault();const score=scoreValue();
 if(!winner.value){status.textContent='Précisez l’équipe gagnante.';winner.focus();return;}
 if(!expectedScore(score,m.format)){
 if(!confirm('Ce score ne correspond pas au format attendu ('+(m.format===4?'deux sets à 6 jeux':'deux sets à 4 jeux')+', super tie-break à un set partout). Valider quand même avec '+name(winner.value==='a'?m.a:m.b)+' gagnante ?'))return;
 score.override=true;score.winner=winner.value;
 }else if(m.result&&!confirm('Remplacer le résultat validé ?'))return;
 b.disabled=true;form.dataset.submitting='true';status.textContent='Validation…';
 try{const r=await withDeadline(client.rpc('suzini_e3_validate_result',{p_simulation:!!data.simulation,p_division:division,p_match:m.id,p_score:score,p_revision:m.result?.revision||0}));if(r.error)throw r.error;document.dispatchEvent(new CustomEvent('suzini:form-saved',{detail:{form}}));data=r.data;render();}
 catch(error){status.textContent=error.message;b.disabled=false;}finally{delete form.dataset.submitting;}
 };
 section.append(form);return section;
}
function render(){
 panel.replaceChildren();document.body.dataset.matchView=selected;const d=current();
 if(error){panel.append(note('Chargement impossible',error));return;}if(!d){panel.append(el('p','Chargement des matchs…'));return;}
 document.body.dataset.matchSimulation=String(!!data.simulation);
 if(!['tirage','chrono','poules','finales','classement'].includes(selected))panel.append(el('div',COURTS[division].name,'programme-court '+COURTS[division].className));

 const matches=chrono(),count=matches.filter(m=>m.result).length;
 if(selected==='tirage'){
 panel.append(d.no_draw?drawInfo(d):note('Tirage au sort',data.simulation?'Tirage de test disponible immédiatement.':'Le 5 novembre à 14 h, heure de Guyane.'));
 return;
 }
 if(!formatFor(d.count)){panel.append(note('Tableau en préparation',d.count+' équipe(s) inscrite(s). Il faut au moins 4 équipes pour maintenir ce tableau.'));return;}
 if(selected==='chrono'){panel.append(chronoBoard());return; }
 if(selected==='resultats'){
 if(!isClub||!clubReady){panel.append(note('Résultats','Consultez les scores validés dans Chrono, Poules et Finales.'));return;}
 panel.append(el('h2','Saisir les résultats'));
 if(!matches.length)panel.append(note('Rencontres en attente','Effectuez le tirage pour déterminer les matchs.'));
 matches.forEach((m,i)=>panel.append(resultForm(m,i)));return;
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
 matches.filter(m=>m.phase!=='poules').forEach(m=>panel.append(card(m,matches.findIndex(x=>x.id===m.id))));return;
 }
 if(selected==='classement'){rankingList(d,matches);return; }
}
function select(tab){selected=tab.dataset.programme;tabs.forEach(b=>{const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;});panel.setAttribute('aria-labelledby',tab.id);render();}
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
const requested=tabs.find(t=>t.dataset.programme===params.get('matchtab'));if(requested)select(requested);
await load();
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('[data-result-form][data-dirty=true],[data-result-form][data-submitting=true]'))load();},10000);
