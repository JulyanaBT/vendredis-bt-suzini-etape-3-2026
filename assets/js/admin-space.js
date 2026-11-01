import {client,access,signIn,clearSession} from './private-client.js?v=94';
import {accessManager} from './admin-managers.js?v=94';
const main=document.querySelector('main');let generation=0;
const backend={access};
const logout=async()=>{await clearSession();showLogin();};
function showLogin(message=''){
 ++generation;
 main.innerHTML='<form class="compact-signup" id="admin-login"><h1>Administration</h1><label>Identifiant ou e-mail<input name="identifier" autocomplete="username" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><button class="signup-submit">Se connecter</button><p role="status"></p></form>';
 main.querySelector('[role="status"]').textContent=message;
 main.querySelector('form').onsubmit=async event=>{event.preventDefault();const b=event.submitter;b.disabled=true;try{const f=new FormData(event.target);await signIn(f.get('identifier'),f.get('password'));await render();}catch(error){const status=main.querySelector('[role="status"]');if(status)status.textContent=error.message;if(b.isConnected)b.disabled=false;}};
}
async function render(){
 const current=++generation,isCurrent=()=>generation===current;
 try{
 const {data:{session},error}=await client.auth.getSession();
 if(!isCurrent())return;
 if(error||!session){if(error)await clearSession();showLogin();return;}
 const check=await client.auth.getUser();
 if(!isCurrent())return;
 if(check.error){
 if([401,403].includes(check.error.status)||['session_not_found','refresh_token_not_found','bad_jwt'].includes(check.error.code)){await clearSession();showLogin('Votre session a expiré. Vous pouvez vous reconnecter.');return;}
 throw new Error('Connexion au serveur impossible. Réessayez dans un instant.');
 }
 main.innerHTML='<p role="status">Chargement…</p>';
 if(location.hash==='#admin-maintenance'){await maintenance(isCurrent);return;}
 await accessManager(backend,main,isCurrent,logout);
 }catch(error){
 if(!isCurrent())return;
 if(error.code==='AUTH_SESSION_EXPIRED'){showLogin(error.message);return;}
 main.replaceChildren();const p=document.createElement('p');p.textContent=error.message;
 const retry=document.createElement('button');retry.textContent='Réessayer';retry.onclick=render;
 const b=document.createElement('button');b.textContent='Revenir à la connexion';b.onclick=logout;main.append(p,retry,b);
 }
}

async function maintenance(isCurrent){
 const {data,error}=await client.rpc('suzini_e3_settings',{p_data:null});if(error)throw new Error('Accès réservé à l’administrateur.');if(!isCurrent())return;
 const pages=[['index.html','Accueil','Présentation du tournoi'],['inscriptions.html','Inscription','Inscription, paiement et Solo'],['equipes.html','Équipes','Liste des équipes'],['programmation.html','Matchs','Programme et tirage'],['restauration.html','Restauration','Informations de restauration'],['infos.html','Infos','Accès, règlement, flyer et contacts']];
 main.innerHTML='<section class="admin-card"><span class="admin-eyebrow">VISIBILITÉ DU SITE</span><h1>Maintenance</h1><p>Choisissez les rubriques à masquer au public. Votre compte administrateur garde l’accès.</p><form id="maintenanceForm"><fieldset class="maintenance-grid"><legend>Rubriques publiques</legend>'+pages.map(([id,label,help])=>'<label class="maintenance-tile"><input type="checkbox" name="page" value="'+id+'" '+(data.pages.includes(id)?'checked':'')+'><span><strong>'+label+'</strong><small>'+help+'</small></span><span class="maintenance-light" aria-hidden="true"></span></label>').join('')+'</fieldset><label class="maintenance-tile maintenance-club"><input type="checkbox" name="club" '+(data.club_blocked?'checked':'')+'><span><strong>Suspendre l’espace Club</strong><small>Les gestionnaires gardent accès à Mon compte. Les invitations restent disponibles dans l’administration.</small></span></label><button class="signup-submit">Enregistrer la maintenance</button><p role="status"></p></form></section><div class="organizer-logout"><button id="admin-logout">Se déconnecter</button></div>';
 main.querySelector('#admin-logout').onclick=logout;
 main.querySelector('form').onsubmit=async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;const f=new FormData(e.target),status=main.querySelector('[role="status"]');status.textContent='Enregistrement…';const {error}=await client.rpc('suzini_e3_settings',{p_data:{pages:f.getAll('page'),club_blocked:f.has('club')}});status.textContent=error?error.message:'Maintenance enregistrée. Les pages ouvertes se mettent à jour sous 15 secondes.';b.disabled=false;};
}
window.addEventListener('hashchange',render);render();
