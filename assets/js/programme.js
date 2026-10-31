import {rpc} from './supabase-site.js?v=29';
import {formatFor,COURTS,poolFixtures,finalFixtures} from './tournament-format.js?v=29';
const tabs=[...document.querySelectorAll('[data-programme]')],panel=document.getElementById('programme-panel');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let division='DM',selected='chrono',data=null,teams=[],error='',clubClient=null,clubReady=false;
try{division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{}
if(!COURTS[division])division='DM';
const isClub=document.body.dataset.space==='club';
function current(){return data?.divisions?.find(d=>d.division===division);}
function teamName(id){return teams.find(t=>t.id===id)?.team_name||'Équipe à confirmer';}
function groups(d,f){return d.drawn_at?[d.pool_a,...(f.sizes.length>1?[d.pool_b]:[])]:f.sizes.map((size,i)=>Array.from({length:size},(_,n)=>`${String.fromCharCode(65+i)}${n+1}`));}
function matchCard(m,index,drawn=false){const c=el('article','','programme-match '+COURTS[division].className);c.append(el('small',`${index+1}. ${m.id?m.id+' · ':''}${m.stage}`),el('strong',`${drawn?teamName(m.a):m.a}  contre  ${drawn?teamName(m.b):m.b}`));return c;}
function render(){
 panel.replaceChildren();panel.classList.remove('programme-placeholder');const d=current(),f=d?formatFor(d.count):null,court=COURTS[division];
 panel.append(el('p',division==='DD'?'Double dames':'Double hommes','programme-eyebrow'),el('div',court.name,'programme-court '+court.className));
 if(error){panel.append(el('p',error,'programme-notice'));return;}
 if(!d){panel.append(el('p','Chargement du programme…'));return;}
 const overview=el('div','','programme-overview');overview.append(el('strong',`${d.count} / 8 équipes`),el('span',d.validated_at?'Format validé par le Club':'Format à valider à la clôture'));panel.append(overview);
 panel.append(el('p','Tirage au sort : jeudi 5 novembre à 14 h (Guyane, UTC−3).','programme-draw-date'));
 if(f){const box=el('section','','programme-format');box.append(el('h2',f.title),el('p',f.description),el('small',`${f.totalMatches} rencontres · 1 terrain dédié à ce tableau`));panel.append(box);}else{panel.append(el('p','Le format pourra être validé avec 3 à 8 équipes.','programme-notice'));}
 const guide=el('details','','programme-guide');guide.append(el('summary','Formats selon le nombre d’équipes'));
 for(const n of [3,4,5,6,7,8]){const plan=formatFor(n);guide.append(el('h3',n+' équipes · '+plan.title),el('p',plan.description));}panel.append(guide);
 if(isClub&&clubReady)renderClub(d,f);
 if(!f)return;
 const g=groups(d,f);
 if(selected==='poules'){
  panel.append(el('p',d.drawn_at?'Tirage effectué.':'Répartition en attente du tirage. Les repères A1, A2… ne désignent pas encore des équipes.','programme-notice'));
  g.forEach((pool,i)=>{const box=el('section','','programme-pool');box.append(el('h3',f.sizes.length===1?'Poule unique':'Poule '+String.fromCharCode(65+i)));const list=el('ol');pool.forEach(id=>list.append(el('li',d.drawn_at?teamName(id):id+' · équipe à tirer')));box.append(list);panel.append(box);});
 }else if(selected==='finales'){
  const matches=finalFixtures(d.count);if(!matches.length)panel.append(el('p','Pas de phase finale : le classement de la poule unique donne le classement final.','programme-notice'));
  else{panel.append(el('p','Les équipes seront connues après le classement des poules.','programme-notice'));matches.forEach((m,i)=>panel.append(matchCard(m,i)));}
 }else if(selected==='resultats'){
  panel.append(el('p','Aucun résultat pour le moment. Les classements des poules et les résultats des phases finales seront affichés pendant le tournoi.','programme-notice'));
 }else{
  panel.append(el('h2','Ordre prévisionnel des rencontres'));
  panel.append(el('p','Début vendredi 6 novembre à 18 h. Horaires détaillés à confirmer ; les rencontres s’enchaînent sur le terrain de ce tableau.','programme-notice'));
  const pool=poolFixtures(g);pool.forEach((m,i)=>panel.append(matchCard(m,i,!!d.drawn_at)));
  finalFixtures(d.count).forEach((m,i)=>panel.append(matchCard(m,pool.length+i)));
 }
}
function renderClub(d,f){
 const box=el('section','','programme-club'),msg=el('p','');msg.setAttribute('role','status');box.append(el('h3','Gestion du tableau'));
 box.append(el('p',data.registration_closed?'Inscriptions closes : validez le format avant le tirage.':'La validation sera possible à la fermeture des inscriptions.'));
 const validate=el('button',d.validated_at?'Format validé':'Valider le format'),draw=el('button',d.drawn_at?'Tirage effectué':'Effectuer le tirage');validate.type=draw.type='button';validate.disabled=!data.registration_closed||!f||!!d.validated_at;draw.disabled=!data.registration_closed||!d.validated_at||!!d.drawn_at||Date.now()<Date.parse(data.draw_at);
 async function act(action,b){b.disabled=true;msg.textContent='Enregistrement…';try{const {data:next,error}=await clubClient.rpc('suzini_e3_programme_manage',{p_action:action,p_division:division});if(error)throw error;data=next;render();}catch(e){msg.textContent=e.message;b.disabled=false;}}
 validate.onclick=()=>act('validate',validate);draw.onclick=()=>act('draw',draw);box.append(validate,draw,msg);panel.append(box);
}
function select(tab){selected=tab.dataset.programme;for(const b of tabs){const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}panel.setAttribute('aria-labelledby',tab.id);render();}
for(const tab of tabs){tab.onclick=()=>select(tab);tab.onkeydown=event=>{let next=tabs.indexOf(tab);if(event.key==='ArrowRight')next=(next+1)%tabs.length;else if(event.key==='ArrowLeft')next=(next+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(tabs[next]);tabs[next].focus();};}
document.addEventListener('publicZoneChange',event=>{division=event.detail.epreuve;render();});
async function load(){try{[data,teams]=await Promise.all([rpc('suzini_e3_programme'),rpc('suzini_e3_teams')]);error='';render();}catch{error='Programme indisponible. Vérifiez votre connexion puis actualisez.';render();}}
if(isClub){const {client}=await import('./private-client.js');clubClient=client;async function ready(){const {error}=await client.rpc('suzini_e3_club');clubReady=!error;render();}document.addEventListener('club:ready',ready);ready();}
load();setInterval(()=>{if(document.visibilityState==='visible')load();},30000);
