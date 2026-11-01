import {rpc} from './supabase-site.js?v=54';
import {formatFor,COURTS,groupsFor,scheduleDraws,slotFor} from './tournament-format.js?v=54';
const tabs=[...document.querySelectorAll('[data-programme]')],panel=document.getElementById('programme-panel');
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let division='DM',selected='chrono',data=null,teams=[],error='',clubClient=null,clubReady=false;
try{division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{}
if(!COURTS[division])division='DM';
const isClub=document.body.dataset.space==='club';
function current(){return data?.divisions?.find(d=>d.division===division);}
function teamName(id){const name=teams.find(t=>t.id===id)?.team_name||(/^[0-9a-f]{8}-/i.test(id||'')?'Équipe à confirmer':id),seed=current()?.seeds?.indexOf(id);return seed>=0?name+' · TS'+(seed+1):name;}
function matchCard(m,index){const court=COURTS[m.court],c=el('article','','programme-match '+court.className),slot=slotFor(m.slot);c.append(el('small','Horaire à confirmer · Guyane','programme-slot'),el('small',court.name),el('small',m.format===4?'Format 4 · deux sets à 6 jeux':'Format 3 · deux sets à 4 jeux'),el('small',`${index+1}. ${m.id} · ${m.stage}`),el('strong',`${teamName(m.a)}  contre  ${teamName(m.b)}`));return c;}
function render(){
 panel.replaceChildren();panel.classList.remove('programme-placeholder');const d=current(),f=d?formatFor(d.count):null,court=COURTS[division],schedule=data?scheduleDraws(data.divisions).filter(m=>m.division===division):[],last=schedule.at(-1),finish=last?slotFor(last.slot):null;
 panel.append(el('p',division==='DD'?'Double dames':'Double hommes','programme-eyebrow'),el('div',court.name,'programme-court '+court.className));
 if(error){panel.append(el('p',error,'programme-notice'));return;}
 if(!d){panel.append(el('p','Chargement du programme…'));return;}
 const overview=el('div','','programme-overview');overview.append(el('strong',`${d.count} / 8 équipes`),el('span',d.validated_at?'Format validé par le Club':'Format à valider à la clôture'));panel.append(overview);
 panel.append(el('p','Format 3 hors finales, format 4 pour les finales. Repos FFT à intégrer au chrono : les anciennes simulations à 25 + 5 min ne sont pas des convocations.','rules-review-note'));
 panel.append(el('p','Tirage au sort : jeudi 5 novembre à 14 h (Guyane, UTC−3).','programme-draw-date'));
 if(f){const box=el('section','','programme-format');box.append(el('h2',f.title),el('p',f.description),el('small',`${f.totalMatches} rencontres prévues · horaires en révision FFT`));panel.append(box);}else{panel.append(el('p','Minimum 4 équipes pour maintenir ce tableau. Avec moins de 4 équipes à la clôture, il sera annulé.','programme-notice'));}
 const guide=el('details','','programme-guide');guide.append(el('summary','Formats selon le nombre d’équipes'));
 for(const n of [4,5,6,7,8]){const plan=formatFor(n);guide.append(el('h3',n+' équipes · '+plan.title),el('p',plan.description));}panel.append(guide);
 panel.append(el('p','Début prévu à 18 h en Guyane. Les matchs se jouent au score, sans limite à 25 minutes. Le repos des paires est distinct des 5 minutes de rotation du terrain. Dès qu’un tableau termine, son terrain peut être réaffecté.','programme-notice'));
 panel.append(el('p','Têtes de série : les deux meilleurs classements globaux d’équipe (somme des classements individuels, total le plus faible). En cas d’égalité, départage au tirage.','programme-notice'));
 if(d.drawn_at)panel.append(el('p',(d.seeds||[]).map(id=>teamName(id)).join(' / '),'programme-notice'));
 if(d.count===7)panel.append(el('p',d.drawn_at?'Exemptée de quart, en bas du tableau : '+teamName(d.draw_order[6]):'TS1 est exemptée de quart en bas du tableau ; TS2 est placée en haut.','programme-notice'));
 if(isClub&&clubReady)renderClub(d,f);
 if(!f)return;
 const g=groupsFor(d);
 if(selected==='poules'){
  if(d.count<=6){
   panel.append(el('p',d.drawn_at?'Tirage effectué.':'Répartition en attente du tirage. Les repères TS1, TS2, A3… ne désignent pas encore des équipes.','programme-notice'));
   g.forEach((pool,i)=>{const box=el('section','','programme-pool');box.append(el('h3',g.length===1?'Poule unique':'Poule '+String.fromCharCode(65+i)));const list=el('ol');pool.forEach(id=>list.append(el('li',d.drawn_at?teamName(id):id+' · équipe à tirer')));box.append(list);panel.append(box);});
  }else if(d.count===7){
   panel.append(el('h2','Poule de classement · places 5–7'),el('p','Pas de poules préliminaires : le tournoi commence par les quarts. Les trois perdants des quarts se rencontrent ensuite pour les places 5 à 7.','programme-notice'));
   schedule.filter(m=>m.phase==='classement').forEach(m=>panel.append(matchCard(m,schedule.indexOf(m))));
  }else panel.append(el('p','Pas de poules à 8 équipes : quarts de finale, puis deux tableaux de classement, places 1–4 et 5–8. Consultez l’onglet Finales.','programme-notice'));
 }else if(selected==='finales'){
  const matches=schedule.filter(m=>m.phase!=='poules');
  if(!matches.length)panel.append(el('p','Pas de phase finale : le classement de la poule unique donne le classement final.','programme-notice'));
  else{panel.append(el('p',d.count>=7?'Quarts et matchs de classement. Les vainqueurs et perdants seront précisés au fil des résultats.':'Les équipes seront connues après le classement des poules.','programme-notice'));matches.forEach(m=>panel.append(matchCard(m,schedule.indexOf(m))));}
 }else if(selected==='resultats'){
  panel.append(el('p','Aucun résultat pour le moment. Les résultats et classements seront affichés pendant le tournoi.','programme-notice'));
 }else{
  panel.append(el('h2','Chrono prévisionnel'));
  panel.append(el('p','Ordre et terrains indicatifs, à recalculer avec le juge-arbitre selon les repos réglementaires et la durée réelle des rencontres. Aucune heure de fin n’est garantie.','programme-notice'));
  schedule.forEach((m,i)=>panel.append(matchCard(m,i)));
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
if(isClub){const {client}=await import('./private-client.js?v=54');clubClient=client;async function ready(){const {error}=await client.rpc('suzini_e3_club');clubReady=!error;render();}document.addEventListener('club:ready',ready);ready();}
load();setInterval(()=>{if(document.visibilityState==='visible')load();},30000);
