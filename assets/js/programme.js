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
function fixtures(){
 if(!data)return [];
 const slots=scheduleDraws(data.divisions);
 return slots.map(base=>{const m=data.matches.find(m=>m.division===base.division&&m.id===base.id);return m?{...base,...m}:null;}).filter(Boolean).filter(m=>m.division===division);
}
function chrono(){
 const matches=fixtures(),completed=matches.filter(m=>m.result),latest=completed.sort((a,b)=>Date.parse(b.result.validated_at)-Date.parse(a.result.validated_at))[0];
 const anchor=latest?Date.parse(latest.result.validated_at):Date.parse('2026-11-06T21:00:00Z');let pending=0;
 return matches.map(m=>({...m,planned:Date.parse('2026-11-06T21:00:00Z')+m.slot*30*60000,live:!m.result?(latest?anchor+pending++*30*60000:Date.parse('2026-11-06T21:00:00Z')+m.slot*30*60000):null,adjusted:!!latest}));
}
function card(m,index){
 const c=el('article','','programme-match '+COURTS[m.court||division].className);
 if(m.result)c.classList.add('match-finished');
 c.append(el('small',(index+1)+'. '+m.stage),el('strong',name(m.a)+' / '+name(m.b)));
 if(m.result)c.append(el('b',scoreText(m.result),'match-score'),el('small','Validé à '+clock(m.result.validated_at,true)+' · Guyane'));
 else c.append(el('span',(m.adjusted?'Horaire actualisé : ':'Horaire initial : ')+clock(m.live??m.planned),'match-time'));
 c.append(el('small',COURTS[m.court||division].name));
 return c;
}
function note(title,text){const b=el('section','','match-info-card');b.append(el('h2',title),el('p',text));return b;}
function table(rows,title='Classement de la poule',offset=0){
 const section=el('section','','pool-standings');section.append(el('h3',title));const wrap=el('div','','standings-scroll'),t=el('table');const head=el('thead'),tr=el('tr');
 for(const h of ['Rg','Équipe','J','V','Pts','Δ sets','Δ jeux'])tr.append(el('th',h));head.append(tr);t.append(head);const body=el('tbody');
 for(const r of rows){const row=el('tr');for(const v of [(Number(r.position)+offset)+(r.tied?' =':''),name(r.id),r.played,r.wins,r.points,r.sw-r.sl,r.gw-r.gl])row.append(el('td',String(v)));body.append(row);}
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
function resultForm(m,index){
 const section=card(m,index),form=el('form');form.dataset.resultForm=m.id;form.noValidate=false;
 const grid=el('div','','score-grid');grid.append(el('span',''),el('strong','Set 1'),el('strong','Set 2'),el('strong','Super TB'));
 const inputs=[[],[]];
 for(let p=0;p<2;p++){
 grid.append(el('span',name(p?m.b:m.a)));
 for(let s=0;s<3;s++){const input=document.createElement('input');input.type='number';input.inputMode='numeric';input.min='0';input.max=s===2?'999':m.format===4?'7':'5';input.step='1';input.setAttribute('aria-label',name(p?m.b:m.a)+' · '+(s===2?'Super tie-break':'Set '+(s+1)));input.value=s<2?(m.result?.score.sets[s]?.[p]??''):(m.result?.score.super?.[p]??'');if(s<2)input.required=true;inputs[p][s]=input;grid.append(input);}
 }
 function superState(){const a1=inputs[0][0].value,b1=inputs[1][0].value,a2=inputs[0][1].value,b2=inputs[1][1].value;const split=[a1,b1,a2,b2].every(x=>x!=='')&&((+a1>+b1)!==(+a2>+b2));for(const row of inputs){row[2].disabled=!split;row[2].required=split;if(!split)row[2].value='';}}
 grid.addEventListener('input',superState);superState();
 const b=el('button',m.result?'Corriger et valider':'Valider le résultat'),status=el('p');b.type='submit';b.className='signup-submit';status.setAttribute('role','status');
 const depsDone=m.deps.every(id=>fixtures().some(x=>x.id===id&&x.result));
 const ready=/^[0-9a-f-]{36}$/i.test(m.a)&&/^[0-9a-f-]{36}$/i.test(m.b)&&depsDone&&(data.simulation||data.registration_closed&&current().validated_at);
 b.disabled=!ready;
 form.append(grid,el('small',m.format===4?'Deux sets à 6 jeux, tie-break à 6–6. Super tie-break à un set partout.':'Deux sets à 4 jeux, tie-break à 4–4. Super tie-break à un set partout.'),b,status);
 if(!ready)form.append(el('small','En attente de validation du format ou des matchs précédents.'));
 form.onsubmit=async event=>{
 event.preventDefault();if(m.result&&!confirm('Remplacer ce résultat et recalculer le classement et le chrono ?'))return;
 const score={sets:[[Number(inputs[0][0].value),Number(inputs[1][0].value)],[Number(inputs[0][1].value),Number(inputs[1][1].value)]]};
 if(!inputs[0][2].disabled)score.super=[Number(inputs[0][2].value),Number(inputs[1][2].value)];
 b.disabled=true;form.dataset.submitting='true';status.textContent='Validation…';
 try{const {data:next,error}=await withDeadline(client.rpc('suzini_e3_validate_result',{p_simulation:!!data.simulation,p_division:division,p_match:m.id,p_score:score,p_revision:m.result?.revision||0}));if(error)throw error;
 document.dispatchEvent(new CustomEvent('suzini:form-saved',{detail:{form}}));data=next;render();
 }catch(e){status.textContent=e.message;b.disabled=false;}finally{delete form.dataset.submitting;}
 };
 section.append(form);return section;
}
function render(){
 panel.replaceChildren();const d=current();
 if(error){panel.append(note('Chargement impossible',error));return;}if(!d){panel.append(el('p','Chargement des matchs…'));return;}
 document.body.dataset.matchSimulation=String(!!data.simulation);
 panel.append(el('div',COURTS[division].name,'programme-court '+COURTS[division].className));
 if(data.simulation)panel.append(el('p','SIMULATION PRIVÉE · Équipes et résultats fictifs','simulation-notice'));
 const matches=chrono(),count=matches.filter(m=>m.result).length;
 if(selected==='tirage'){
 panel.append(note(d.no_draw?'Poule unique · sans tirage au sort':'Tirage au sort',d.no_draw?'Avec 4 équipes, toutes les paires se rencontrent dans une poule unique. Aucun tirage au sort n’est nécessaire. Les deux têtes de série se rencontrent au dernier match.':data.simulation?'Tirage de test disponible immédiatement.':'Le 5 novembre à 14 h, heure de Guyane.'));
 drawControls(d);return;
 }
 if(!formatFor(d.count)){panel.append(note('Tableau en préparation',d.count+' équipe(s) inscrite(s). Il faut au moins 4 équipes pour maintenir ce tableau.'));return;}
 if(selected==='chrono'){
 panel.append(el('h2','Chrono'),el('p',count+'/'+matches.length+' résultats validés · horaires de Guyane','programme-eyebrow'));
 panel.append(el('p','Prévision initiale : 25 min de jeu et 5 min de rotation. Après validation d’un résultat, le prochain match non joué prend cette heure de départ. Horaires indicatifs, ajustables par le juge-arbitre selon les repos.','match-caption'));
 if(!matches.length)panel.append(note('Programme à venir','Les rencontres apparaîtront après le tirage.'));
 matches.forEach((m,i)=>panel.append(card(m,i)));return;
 }
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
 pools.forEach((pool,i)=>{const box=el('section','','programme-pool');box.append(el('h2',pools.length===1?'Poule unique':'Poule '+String.fromCharCode(65+i)));const list=el('ol');pool.forEach(id=>list.append(el('li',name(id))));box.append(list);panel.append(box,table(i?d.standings_b:d.standings_a,'Classement provisoire'));matches.filter(m=>m.phase==='poules'&&pool.includes(m.a)&&pool.includes(m.b)).forEach(m=>panel.append(card(m,matches.findIndex(x=>x.id===m.id))));});
 }else{panel.append(note('Format sans poules préliminaires','Consultez Finales pour les quarts et les matchs de classement.'));matches.filter(m=>m.phase==='classement').forEach((m,i)=>panel.append(card(m,i)));}
 return;
 }
 if(selected==='finales'){
 if(d.count<=5){panel.append(note('Pas de phase finale','Le classement de la poule unique constitue le classement final du tableau.'));return;}
 matches.filter(m=>m.phase!=='poules').forEach(m=>panel.append(card(m,matches.findIndex(x=>x.id===m.id))));return;
 }
 if(selected==='classement'){
 panel.append(el('h2',count===matches.length&&matches.length?'Classement final':'Classement provisoire'));
 if(d.count<=5)panel.append(table(d.standings_a,'Poule unique'));
 else{
 const positions=[];
 for(const [id,rank] of [['F',1],['P3',3],['P5',5],['P7',7]]){const r=matches.find(m=>m.id===id)?.result;if(r){positions.push([rank,r.winner],[rank+1,r.winner===r.team_a?r.team_b:r.team_a]);}}
 if(positions.length){const list=el('ol');positions.sort((a,b)=>a[0]-b[0]).forEach(([rank,id])=>{const li=el('li',name(id));li.value=rank;list.append(li);});panel.append(list);}
 if(d.count===7&&d.standings_c?.length)panel.append(table(d.standings_c,'Places 5 à 7',4));
 if(d.count===6){panel.append(table(d.standings_a,'Poule A'),table(d.standings_b,'Poule B'));}
 if(!positions.length&&d.count>=7)panel.append(el('p','Le classement des places sera complété après les matchs décisifs.'));
 }
 panel.append(el('small','Les égalités non départagées restent à trancher par le juge-arbitre.'));return;
 }
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
 async function ready(){const r=await client.rpc('suzini_e3_club');clubReady=!r.error;if(clubReady){try{mode=localStorage.getItem('suzini_e3_match_mode')||'simulation';}catch{mode='simulation';}toolbar();await load();}}
 document.addEventListener('club:ready',ready);ready();
}else{
 try{
 const access=await withDeadline(client.rpc('suzini_e3_preview_role'));
 if(!access.error&&(access.data?.admin||access.data?.manager)){
   if(preview)mode='simulation';
   else try{mode=localStorage.getItem('suzini_e3_match_mode')||'simulation';}catch{mode='simulation';}
   toolbar();
 }
 }catch{}
}
document.querySelector('.club-switch')?.addEventListener('click',event=>{const a=event.currentTarget,u=new URL(a.href);if(data?.simulation)u.searchParams.set('simulation','1');else u.searchParams.delete('simulation');a.href=u.href;});
const requested=tabs.find(t=>t.dataset.programme===params.get('matchtab'));if(requested)select(requested);
await load();
setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('[data-result-form][data-dirty=true],[data-result-form][data-submitting=true]'))load();},10000);
