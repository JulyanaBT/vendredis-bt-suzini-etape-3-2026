import {rankTeams,createTeamCard} from './team-cards.js?v=91';
import {config} from './supabase-config.js?v=91';
async function rawRpc(name,body={}){
 let response;
 try{response=await fetch(config.supabaseUrl+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(12000)});}catch{throw new Error('Connexion interrompue. Vérifiez auprès du club avant de réessayer une inscription.');}
 const data=await response.json();if(!response.ok)throw new Error(data?.code==='P0001'?data.message:'Service temporairement indisponible. Réessayez plus tard.');return data;
}
let guardPromise=null;
function prepareGuard(){if(!guardPromise)guardPromise=rawRpc('suzini_e3_form_token').then(token=>({token,readyAt:Date.now()+2100})).catch(error=>{guardPromise=null;throw error;});return guardPromise;}
export async function rpc(name,body={}){
 const guarded=['suzini_e3_register','suzini_e3_register_payment'].includes(name)||name==='suzini_e3_partners'&&['post','propose','accept'].includes(body.p_action);
 if(!guarded)return rawRpc(name,body);
 const guard=await prepareGuard();if(guard.readyAt>Date.now())await new Promise(resolve=>setTimeout(resolve,guard.readyAt-Date.now()));
 const field=name==='suzini_e3_partners'?'p_data':'p_team';const next={...body,[field]:{...body[field],_guard:guard.token}};
 try{return await rawRpc(name,next);}finally{guardPromise=null;prepareGuard().catch(()=>{});}
}
if(document.getElementById('signupForm')){
 prepareGuard().catch(()=>{});
 for(const form of document.querySelectorAll('#signupForm,#partner-form,#proposal-form')){
  const trap=document.createElement('div');trap.className='form-trap';trap.setAttribute('aria-hidden','true');
  const input=document.createElement('input');input.name='_website';input.type='text';input.tabIndex=-1;input.autocomplete='off';input.setAttribute('aria-label','Laisser vide');trap.append(input);form.append(trap);
 }
}
const form=document.getElementById('signupForm'),button=document.getElementById('submitBtn'),status=document.getElementById('status');
let registrationOpen=false;let registrationState='suspended';
if(button)button.disabled=true;
async function loadStatus(){
 try{const data=await rpc('suzini_e3_status');registrationOpen=data?.open===true;registrationState=data?.registration_state||(!registrationOpen?'suspended':'open');const closedLabel=registrationState==='closed'?'Inscriptions clôturées':'Inscriptions suspendues';for(const a of document.querySelectorAll('.home-register')){a.setAttribute('aria-disabled',String(!registrationOpen));a.querySelector('.home-register-copy')?.setAttribute('data-registration-label',registrationOpen?'Inscrire mon équipe':closedLabel);}for(const n of document.querySelectorAll('[data-registration-state]')){n.textContent=registrationOpen?'Inscriptions ouvertes':closedLabel;n.hidden=registrationOpen;}
 document.dispatchEvent(new CustomEvent('suzini:status',{detail:data}));
 for(const note of document.querySelectorAll('[data-site-status]'))note.textContent=registrationOpen?'BT250 · Clôture le 4 novembre à minuit (Guyane).':(registrationState==='closed'?'Inscriptions clôturées.':'Inscriptions suspendues.');
 if(form){form.hidden=!registrationOpen;const closedBox=document.getElementById('registrationClosed');if(closedBox){closedBox.hidden=registrationOpen;closedBox.querySelector('h1').textContent=registrationState==='closed'?'Inscriptions closes':'Inscriptions suspendues';closedBox.querySelector('p').textContent=registrationState==='closed'?'Pensez à vous inscrire plus vite pour l’étape 4, le 27/11 !':'Les inscriptions seront bientôt réouvertes.';}const note=document.querySelector('#inscription-panel>[data-registration-state]');if(note)note.hidden=true;button.disabled=!registrationOpen;button.textContent=registrationOpen?'Valider l’inscription':closedLabel;status.textContent=registrationOpen?'10 € par joueur · Inscription par équipe, sans compte joueur.':closedLabel+'.';}
 }catch(error){if(form){if(!registrationOpen){form.hidden=true;const box=document.getElementById('registrationClosed');if(box){box.hidden=false;box.querySelector('h1').textContent='Inscriptions indisponibles';box.querySelector('p').textContent=error.message;}}status.textContent=error.message;button.textContent='Inscriptions indisponibles';}}
}
if(document.body.dataset.space==='public')loadStatus();
if(form){
 for(const id of ['p1FirstName','p1LastName','p2FirstName','p2LastName'])document.getElementById(id).maxLength=60;
 for(const id of ['p1Licence','p2Licence']){const input=document.getElementById(id);input.maxLength=8;input.pattern='[0-9]{7}[A-Za-z]';}
 const privacy=document.createElement('details');privacy.className='registration-privacy';const summary=document.createElement('summary');summary.textContent='Utilisation des informations';const privacyText=document.createElement('p');privacyText.textContent='Seuls les prénoms, les initiales des noms et les classements sont affichés au public. Les noms complets et les numéros de licence restent réservés à l’organisation. Le nom d’équipe utilise les prénoms, avec une initiale en cas d’homonymie. Les numéros de licence sont réservés à l’organisation pour la gestion de ce tournoi.';privacy.append(summary,privacyText);button.before(privacy);
 form.addEventListener('submit',async event=>{event.preventDefault();if(!registrationOpen||button.disabled||!form.reportValidity())return;button.disabled=true;form.dataset.submitting='true';status.textContent='Enregistrement en cours…';
 try{const receipt=await rpc('suzini_e3_register_payment',{p_team:Object.fromEntries(new FormData(form))});document.getElementById('successBox').hidden=false;status.textContent='Inscription enregistrée.';form.reset();document.dispatchEvent(new CustomEvent('suzini:registered',{detail:receipt}));}
 catch(error){status.textContent=error.message;}finally{delete form.dataset.submitting;button.disabled=!registrationOpen;}});
}
const list=document.getElementById('rankedList');
if(list){let teams=[],division=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';
 function render(){const rows=rankTeams(teams.filter(team=>team.division===division));list.replaceChildren();document.getElementById('currentLabel').textContent=division==='DD'?'Double Dames':'Double Messieurs';document.getElementById('rankedCount').textContent=rows.length;status.textContent=rows.length?'Équipes inscrites à cette étape.':'Aucune équipe inscrite pour le moment.';
 rows.forEach((team,index)=>list.append(createTeamCard(team,index+1,{shortNames:true})));}

 document.addEventListener('publicZoneChange',event=>{division=event.detail.epreuve;render();});
 rpc('suzini_e3_teams').then(data=>{teams=data||[];render();}).catch(error=>{status.textContent=error.message;});
}

if(document.body.dataset.space==='public'){setInterval(()=>{if(!document.hidden)loadStatus();},5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadStatus();});}
