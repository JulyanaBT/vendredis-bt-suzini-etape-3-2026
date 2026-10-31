import {rankTeams,createTeamCard} from './team-cards.js?v=18';
import {config} from './supabase-config.js';
export async function rpc(name,body={}){
 let response;
 try{response=await fetch(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(12000)});}catch{throw new Error('Connexion interrompue. Vérifiez auprès du club avant de réessayer une inscription.');}
 const data=await response.json();if(!response.ok)throw new Error(data?.code==='P0001'?data.message:'Service temporairement indisponible. Réessayez plus tard.');return data;
}
const form=document.getElementById('signupForm'),button=document.getElementById('submitBtn'),status=document.getElementById('status');
let registrationOpen=false;
if(button)button.disabled=true;
async function loadStatus(){
 try{const data=await rpc('suzini_e3_status');registrationOpen=data?.open===true;
 for(const note of document.querySelectorAll('[data-site-status]'))note.textContent=registrationOpen?'BT250 · Inscriptions ouvertes jusqu’au 4 novembre.':'Site en préparation · Les inscriptions ne sont pas encore ouvertes.';
 if(form){button.disabled=!registrationOpen;button.textContent=registrationOpen?'Valider l’inscription':'Inscriptions prochainement';status.textContent=registrationOpen?'10 € par joueur · Inscription par équipe, sans compte joueur.':'Inscriptions prochainement.';}
 }catch(error){if(form){status.textContent=error.message;button.textContent='Inscriptions indisponibles';}}
}
if(document.body.dataset.space==='public')loadStatus();
if(form){
 for(const id of ['p1FirstName','p1LastName','p2FirstName','p2LastName'])document.getElementById(id).maxLength=60;
 for(const id of ['p1Licence','p2Licence']){const input=document.getElementById(id);input.maxLength=8;input.pattern='[0-9]{7}[A-Za-z]';}
 const privacy=document.createElement('details');privacy.className='registration-privacy';const summary=document.createElement('summary');summary.textContent='Utilisation des informations';const privacyText=document.createElement('p');privacyText.textContent='Les noms, prénoms et classements des joueurs sont affichés dans la liste des équipes. Le nom d’équipe utilise les prénoms, avec une initiale en cas d’homonymie. Les numéros de licence sont réservés à l’organisation pour la gestion de ce tournoi.';privacy.append(summary,privacyText);button.before(privacy);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!registrationOpen||button.disabled||!form.reportValidity())return;button.disabled=true;form.dataset.submitting='true';status.textContent='Enregistrement en cours…';
 try{const receipt=await rpc('suzini_e3_register_payment',{p_team:Object.fromEntries(new FormData(form))});document.getElementById('successBox').hidden=false;status.textContent='Inscription enregistrée.';form.reset();document.dispatchEvent(new CustomEvent('suzini:registered',{detail:receipt}));}
 catch(error){status.textContent=error.message;}finally{delete form.dataset.submitting;button.disabled=!registrationOpen;}});
}
const list=document.getElementById('rankedList');
if(list){let teams=[],division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';
 function render(){const rows=rankTeams(teams.filter(team=>team.division===division));list.replaceChildren();document.getElementById('currentLabel').textContent=division==='DD'?'Double Dames':'Double Messieurs';document.getElementById('rankedCount').textContent=rows.length;status.textContent=rows.length?'Équipes inscrites à cette étape.':'Aucune équipe inscrite pour le moment.';
 rows.forEach((team,index)=>list.append(createTeamCard(team,index+1)));}

 document.addEventListener('publicZoneChange',event=>{division=event.detail.epreuve;render();});
 rpc('suzini_e3_teams').then(data=>{teams=data||[];render();}).catch(error=>{status.textContent=error.message;});
}
