export const accountState=a=>!a.enabled?'Accès suspendu':a.first_sign_in_at||a.last_sign_in_at||a.last_activity_at?'Première connexion effectuée':a.activated_at?(a.invitation_sent_at?'Invitation partagée':'Compte prêt'):'Compte à finaliser';
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9_-]/g,'').slice(0,30);
let accountWatch;
export async function accessManager(backend,main,isCurrent,logout){
 clearTimeout(accountWatch);
 const eventId='20261106-0000-4000-8000-000000000003';
 const {accounts}=await backend.access({action:'list'});
 if(!isCurrent())return;
 const inviteView=location.hash==='#admin-inviter';
 const date=value=>value?new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Cayenne'}).format(new Date(value)):null;
 const state=accountState;
 main.innerHTML=`<section class="admin-access-view" data-admin-view="${inviteView?'invite':'accounts'}"><section class="card admin-invite"><h1>Créer un gestionnaire</h1><form id="invite-form"><label>Identifiant<input name="username" pattern="[A-Za-z][A-Za-z0-9_-]{1,29}" minlength="2" maxlength="30" required autocomplete="off" autocapitalize="none"><small>Majuscules ou minuscules, sans accents. Chiffres, tiret et souligné acceptés. Enregistré en minuscules ; la connexion accepte les deux.</small></label><label>Mot de passe initial<input name="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required><small>6 caractères minimum. Modifiable ensuite, sans obligation.</small></label><button>Créer l’accès</button></form><p class="access-status" id="invite-status" role="status"></p><div id="invite-result" class="invite-result"></div></section><section class="card admin-accounts"><h1>Gestionnaires</h1><p class="smalltext">Horaires de Guyane. L’activité est enregistrée lors de l’utilisation de l’espace Club.</p><div id="accounts">${accounts.length?accounts.map(a=>`<form class="access-person" data-user="${esc(a.user_id)}"><h2>${esc(a.username)}</h2><dl class="manager-details"><div><dt>E-mail</dt><dd>${esc(a.email&&!a.email.endsWith('@accounts.invalid')?a.email:'Connexion par identifiant')}</dd></div><div><dt>Statut</dt><dd>${state(a)}</dd></div><div><dt>Lien d’invitation ouvert</dt><dd>${a.invitation_opened_at?esc(date(a.invitation_opened_at)):'Pas encore enregistré'}</dd></div><div><dt>Première connexion</dt><dd>${a.first_sign_in_at?esc(date(a.first_sign_in_at)):a.last_sign_in_at?'Connexion antérieure au suivi':'Pas encore connecté'}</dd></div><div><dt>Dernier accès Club</dt><dd>${a.last_activity_at?esc(date(a.last_activity_at)):'Aucun accès enregistré'}</dd></div></dl><div class="toolbar"><button type="button" data-toggle-access>${a.enabled?'Suspendre l’accès':'Réactiver l’accès'}</button><button type="button" class="secondary danger" data-delete-manager>Supprimer le gestionnaire</button>${a.enabled?`${a.activated_at?'<button type="button" class="secondary" data-share>Invitation WhatsApp</button>':''}<button type="button" class="secondary" data-password>Définir / partager le mot de passe</button>`:''}</div><p role="status"></p></form>`).join(''):'<p>Aucun gestionnaire invité pour le moment.</p>'}</div></section></section>`;
 main.insertAdjacentHTML('beforeend','<div class="organizer-logout"><button id="admin-logout" class="secondary">Se déconnecter</button></div>');
 main.querySelector('#admin-logout').onclick=logout;
 const form=main.querySelector('#invite-form');
 function showInvite(result,password){
  clearTimeout(accountWatch);
  if(!isCurrent())return;
  const panel=main.querySelector('.admin-access-view');panel.dataset.adminView='invite';
  document.querySelectorAll('header nav a').forEach(a=>{const active=a.hash==='#admin-inviter';a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
  history.replaceState(null,'',location.pathname+location.search+'#admin-inviter');
  const root=main.querySelector('#invite-result');root.replaceChildren();
  form.hidden=true;
  const p=document.createElement('p');p.textContent=`Identifiant : ${result.username}. Compte prêt. Transmets le mot de passe initial au gestionnaire. Il pourra le conserver ou le changer depuis l’espace Club.`;
  const share=document.createElement('a');share.className='button';share.target='_blank';share.rel='noopener noreferrer';share.textContent='1. Invitation WhatsApp';share.href='https://wa.me/?text='+encodeURIComponent(`Invitation à gérer Vendredis Suzini · TC Suzini. Ton identifiant : ${result.username}. Connecte-toi avec le mot de passe transmis par l’organisation : ${result.link}`);
  const delivery=document.createElement('p');delivery.setAttribute('role','status');let marking=false;
  share.onclick=async()=>{if(marking)return;marking=true;delivery.textContent='Enregistrement de l’envoi…';try{await backend.access({action:'mark_sent',user_id:result.user_id});if(isCurrent())delivery.textContent='WhatsApp ouvert. Choisissez le destinataire et envoyez le message.';}catch(error){if(isCurrent())delivery.textContent='Le statut n’a pas pu être enregistré. Cliquez de nouveau sur WhatsApp pour réessayer.';}finally{marking=false;}};
  root.append(p,share,delivery);
  const next=document.createElement('button');next.className='secondary';next.textContent='Créer un autre gestionnaire';next.onclick=()=>{root.replaceChildren();form.hidden=false;main.querySelector('#invite-status').textContent='';form.elements.username.focus();};
  if(password){
   const passwordShare=document.createElement('a');passwordShare.className='button secondary';passwordShare.target='_blank';passwordShare.rel='noopener noreferrer';passwordShare.referrerPolicy='no-referrer';passwordShare.textContent='2. Mot de passe via WhatsApp';
   passwordShare.href='https://wa.me/?text='+encodeURIComponent(`Voici ton mot de passe initial pour l’espace Club Vendredis Suzini : ${password}
Tu peux le modifier dans Paramètres → Mon compte.`);
   root.append(passwordShare);
   const note=document.createElement('p');note.className='smalltext';note.textContent='Deux messages séparés, à envoyer au même destinataire en conversation privée. Le mot de passe ne sera plus disponible ici après avoir quitté cette page.';root.append(note);
  }

  root.append(next);
  root.scrollIntoView({block:'nearest'});
 }
 form.onsubmit=async e=>{e.preventDefault();const data=new FormData(form),status=main.querySelector('#invite-status'),button=form.querySelector('button');const ids=[eventId];button.disabled=true;status.textContent='Création de l’accès…';main.querySelector('#invite-result').replaceChildren();try{const result=await backend.access({action:'create_password',username:normalize(data.get('username')),password:data.get('password')});showInvite(result,data.get('password'));status.textContent='Compte prêt. Envoyez les deux messages ci-dessous.';button.disabled=false;form.reset();}catch(error){if(isCurrent()){status.textContent=error.message;button.disabled=false;}}};
 main.querySelectorAll('[data-user]').forEach(row=>{
  row.onsubmit=e=>e.preventDefault();
  const account=accounts.find(a=>a.user_id===row.dataset.user);
  const toggle=row.querySelector('[data-toggle-access]');toggle.onclick=async()=>{row.querySelectorAll('button').forEach(b=>b.disabled=true);try{await backend.access({action:'update',user_id:account.user_id,event_ids:[eventId],enabled:!account.enabled});await accessManager(backend,main,isCurrent,logout);}catch(error){if(isCurrent()){row.querySelector('[role="status"]').textContent=error.message;row.querySelectorAll('button').forEach(b=>b.disabled=false);}}};
  row.querySelector('[data-delete-manager]').onclick=()=>{
    const dialog=document.createElement('dialog');dialog.className='manager-delete-dialog';dialog.setAttribute('aria-labelledby','manager-delete-title');
    dialog.innerHTML=`<h2 id="manager-delete-title">Supprimer ${esc(account.username)} ?</h2><p>Son accès gestionnaire et son compte seront supprimés. Une invitation en attente sera annulée. Les inscriptions et résultats sportifs seront conservés.</p><p role="status"></p><div class="toolbar"><button type="button" class="secondary" data-cancel>Annuler</button><button type="button" class="danger" data-confirm>Confirmer la suppression</button></div>`;
    main.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
    dialog.querySelector('[data-confirm]').onclick=async()=>{dialog.querySelectorAll('button').forEach(b=>b.disabled=true);dialog.oncancel=e=>e.preventDefault();try{await backend.access({action:'delete',user_id:account.user_id});dialog.close();await accessManager(backend,main,isCurrent,logout);}catch(error){dialog.querySelector('[role="status"]').textContent=error.message;dialog.querySelectorAll('button').forEach(b=>b.disabled=false);dialog.oncancel=null;}};
    dialog.showModal();dialog.querySelector('[data-cancel]').focus();
  };

  const shareAgain=row.querySelector('[data-share]');if(shareAgain)shareAgain.onclick=()=>showInvite({user_id:account.user_id,username:account.username,link:'https://julyanabt.fr/vendredis-bt-suzini-etape-3-2026/club/index.html#compte'+(account.invite_tracking_token?'?invitation='+account.invite_tracking_token:'')});
  const reset=row.querySelector('[data-password]');if(reset)reset.onclick=()=>{
   const dialog=document.createElement('dialog');dialog.className='manager-delete-dialog';dialog.innerHTML=`<h2>Mot de passe de ${esc(account.username)}</h2><form><label>Nouveau mot de passe<input name="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></label><p>Le mot de passe précédent sera remplacé. 6 caractères minimum.</p><p role="status"></p><div class="toolbar"><button>Enregistrer</button><button type="button" data-cancel>Annuler</button></div></form>`;
   main.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();
   dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=dialog.querySelector('button');button.disabled=true;try{const password=dialog.querySelector('input').value;const result=await backend.access({action:'set_password',user_id:account.user_id,password});dialog.close();showInvite(result,password);}catch(error){dialog.querySelector('[role="status"]').textContent=error.message;button.disabled=false;}};dialog.showModal();
  };

 });
 const watch=async()=>{if(!isCurrent())return;if(document.hidden||main.querySelector('dialog[open],button:disabled')){accountWatch=setTimeout(watch,15000);return;}try{const fresh=await backend.access({action:'list'});if(isCurrent()&&location.hash==='#admin'&&JSON.stringify(fresh.accounts)!==JSON.stringify(accounts)){await accessManager(backend,main,isCurrent,logout);return;}}catch{}if(isCurrent())accountWatch=setTimeout(watch,15000);};
 if(!inviteView)accountWatch=setTimeout(watch,15000);
}
export function activationPage(backend,main,page,isCurrent){
 const params=new URLSearchParams(page.split('?')[1]||'');
 const token_hash=params.get('token_hash'),type=params.get('type');
 main.innerHTML=`<div class="page-head"><div class="eyebrow">ESPACE CLUB · TC SUZINI</div><h1>Activer mon accès</h1></div><section class="card"><p>Renseignez votre e-mail et choisissez votre mot de passe personnel pour gérer la journée Vendredis Suzini au TC Suzini.</p><form id="activate-form"><label>Identifiant<input name="username" autocomplete="username" readonly required value="${esc(params.get('username')||'')}"></label><label>E-mail<input name="email" type="email" autocomplete="email" required></label><label>Mot de passe<input name="password" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></label><label>Confirmer le mot de passe<input name="confirm" type="password" minlength="6" maxlength="128" autocomplete="new-password" required></label><small>6 caractères minimum.</small><button>Activer mon compte</button></form><p id="activation-status" role="status"></p></section>`;
 const form=main.querySelector('form'),status=main.querySelector('#activation-status');
 if(!token_hash||!['invite','recovery','club'].includes(type)){form.remove();status.textContent='Lien incomplet. Demandez une nouvelle invitation.';return;}
 form.onsubmit=async e=>{e.preventDefault();if(form.elements.password.value!==form.elements.confirm.value){status.textContent='Les mots de passe ne correspondent pas.';return;}const button=form.querySelector('button');button.disabled=true;status.textContent='Activation…';try{const result=await backend.activate({token_hash,type,username:form.elements.username.value.trim(),email:form.elements.email.value.trim(),password:form.elements.password.value});if(!isCurrent())return;history.replaceState(null,'',location.pathname+location.search+'#activation');form.remove();status.textContent=`Votre compte est activé. Identifiant : ${result.username}. Vous pouvez maintenant vous connecter.`;const a=document.createElement('a');a.href='#club';a.className='button';a.textContent='Me connecter à l’espace Club';status.after(a);}catch(error){if(isCurrent()){status.textContent=error.message;button.disabled=false;}}};
}

export function passwordDialog(backend,main){
 const dialog=document.createElement('dialog');dialog.className='manager-delete-dialog';dialog.innerHTML='<h2>Changer mon mot de passe</h2><form><label>Mot de passe actuel<input name="current" type="password" autocomplete="current-password" required></label><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required></label><label>Confirmer<input name="confirm" type="password" autocomplete="new-password" required></label><small>6 caractères minimum.</small><p role="status"></p><div class="toolbar"><button>Enregistrer</button><button type="button" data-cancel>Fermer</button></div></form>';
 main.append(dialog);dialog.onclose=()=>dialog.remove();dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const form=e.target,status=dialog.querySelector('[role="status"]');if(form.elements.password.value!==form.elements.confirm.value){status.textContent='Les mots de passe ne correspondent pas.';return;}const button=form.querySelector('button');button.disabled=true;try{await backend.access({action:'change_password',current_password:form.elements.current.value,password:form.elements.password.value});form.reset();status.textContent='Mot de passe modifié.';}catch(error){status.textContent=error.message;}finally{button.disabled=false;}};dialog.showModal();
}

export async function accountPage(backend,main,isCurrent,logout){
 const profile=await backend.access({action:'profile'});if(!isCurrent())return;
 main.innerHTML=`<section class="card"><h1>Mon compte</h1>${!profile.email?'<p>Pour terminer votre première connexion, renseignez votre e-mail et confirmez le mot de passe initial transmis par l’organisation.</p>':''}<p><strong>ID : ${esc(profile.username)}</strong><br>E-mail : ${esc(profile.email)||"Non renseigné"}</p><form id="profile-form"><label>Identifiant<input name="username" autocomplete="username" pattern="[A-Za-z][A-Za-z0-9_-]{1,29}" minlength="2" maxlength="30" required value="${esc(profile.username)}"></label><label>E-mail de contact<input name="email" type="email" autocomplete="email" maxlength="150" required value="${esc(profile.email)}"></label><small>La connexion se fait avec votre identifiant. Cet e-mail permet à l’organisation de vous contacter.</small><label>Mot de passe actuel<input name="current_password" type="password" autocomplete="current-password" required></label><button>Enregistrer mon profil</button><p role="status"></p></form><button type="button" id="profile-password" class="secondary">Changer mon mot de passe</button></section><div class="organizer-logout"><button id="logout" class="secondary">Se déconnecter</button></div>`;
 main.querySelector('#logout').onclick=logout;main.querySelector('#profile-password').onclick=()=>passwordDialog(backend,main);
 const form=main.querySelector('form');form.onsubmit=async e=>{e.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role="status"]');button.disabled=true;try{const result=await backend.access({action:'update_profile',...Object.fromEntries(new FormData(form))});if(!isCurrent())return;form.elements.username.value=result.username;form.elements.current_password.value='';status.textContent='Profil enregistré. Vous pouvez accéder aux activités du Club.';}catch(error){if(isCurrent())status.textContent=error.message;}finally{button.disabled=false;}};
}
