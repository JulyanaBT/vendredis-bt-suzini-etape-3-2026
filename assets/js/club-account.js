import {client,access,signIn,clearSession,withDeadline} from './private-client.js?v=94';
const main=document.querySelector('main');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.hash.split('?')[1]||'');
const token=params.get('token');
async function login(message=''){
 main.innerHTML='<section class="account-card"><h1>Mon compte</h1><form id="account-login"><label>E-mail ou identifiant<input name="identifier" autocomplete="username" required></label><label>Mot de passe<input name="password" type="password" autocomplete="current-password" required></label><button class="signup-submit">Me connecter</button><p role="status">'+esc(message)+'</p></form></section>';
 main.querySelector('form').onsubmit=async event=>{event.preventDefault();const b=event.submitter;b.disabled=true;try{const f=new FormData(event.target);await signIn(f.get('identifier'),f.get('password'));await render();}catch(e){main.querySelector('[role="status"]').textContent=e.message;b.disabled=false;}};
}
async function invitation(){
 main.innerHTML='<section class="account-card"><h1>Mon compte</h1><p role="status">Vérification de votre invitation…</p></section>';
 try{await withDeadline(access({action:'invite_info',token},false),14000);}catch(e){
 main.innerHTML='<section class="account-card"><h1>Mon compte</h1><p role="status">'+esc(e.message)+'</p><button id="retry-invitation" class="signup-submit">Réessayer mon invitation</button><p><a href="compte.html">Mon compte est déjà activé : me connecter →</a></p></section>';
 main.querySelector('#retry-invitation').onclick=invitation;return;
 }
 main.innerHTML='<section class="account-card"><span class="admin-eyebrow">BIENVENUE DANS L’ESPACE CLUB</span><h1>Mon compte</h1><p>Votre e-mail sera votre identifiant de connexion.</p><form id="accept-invite"><label>Mon e-mail<input name="email" type="email" autocomplete="email" maxlength="150" required></label><label>Mot de passe initial communiqué par l’organisation<input name="initial_password" type="password" autocomplete="current-password" required></label><details class="account-password-option"><summary>Choisir un autre mot de passe (facultatif)</summary><label>Nouveau mot de passe<input name="new_password" type="password" autocomplete="new-password" minlength="6" maxlength="128"></label><label>Confirmer le nouveau mot de passe<input name="confirm" type="password" autocomplete="new-password"></label><small>Laissez ces champs vides pour conserver le mot de passe initial.</small></details><button class="signup-submit">Activer mon compte et entrer</button><p role="status"></p></form></section>';
 const form=main.querySelector('form');form.onsubmit=async event=>{event.preventDefault();const b=event.submitter,s=form.querySelector('[role="status"]'),data=Object.fromEntries(new FormData(form));if(data.new_password!==data.confirm){s.textContent='Les nouveaux mots de passe ne correspondent pas.';return;}b.disabled=true;s.textContent='Activation…';try{const result=await access({action:'activate_simple',token,...data},false);const {error}=await withDeadline(client.auth.setSession(result.session));if(error)throw error;const club=await withDeadline(client.rpc('suzini_e3_club'));if(club.error)throw new Error('Le compte est connecté mais l’accès Club n’est pas confirmé. Contactez l’administrateur.');history.replaceState(null,'',location.pathname);location.replace(new URL('index.html',location.href).href);}catch(e){s.textContent=e.message;
 if(e.code==='EXISTING_ACCOUNT_PASSWORD_REQUIRED'&&!form.querySelector('[name="existing_password"]')){
 const field=document.createElement('label');field.textContent='Mot de passe actuel de ce compte existant';const input=document.createElement('input');input.name='existing_password';input.type='password';input.autocomplete='current-password';input.required=true;field.append(input);s.before(field);form.querySelector('[name="new_password"]').value='';form.querySelector('[name="confirm"]').value='';form.querySelector('.account-password-option').hidden=true;input.focus();
 }
 b.disabled=false;}};
}
async function render(){
 try{
 const {data:{session}}=await withDeadline(client.auth.getSession());if(!session)return login();
 const p=await access({action:'profile'});
 main.innerHTML='<section class="account-card"><h1>Mon compte</h1><p>Votre accès gestionnaire est actif.</p><form id="email-form"><label>Mon e-mail (identifiant)<input name="email" type="email" autocomplete="email" maxlength="150" required value="'+esc(p.email)+'"></label><label>Mot de passe actuel<input name="current_password" type="password" autocomplete="current-password" required></label><button>Enregistrer mon e-mail</button><p role="status"></p></form><details class="account-password-option"><summary>Modifier mon mot de passe (facultatif)</summary><form id="password-form"><label>Mot de passe actuel<input name="current_password" type="password" autocomplete="current-password" required></label><label>Nouveau mot de passe<input name="password" type="password" autocomplete="new-password" minlength="6" maxlength="128" required></label><label>Confirmer<input name="confirm" type="password" autocomplete="new-password" required></label><button>Modifier le mot de passe</button><p role="status"></p></form></details><a class="account-enter" href="index.html">Entrer dans l’espace Club →</a><button type="button" id="account-logout" class="secondary">Se déconnecter</button></section>';
 main.querySelector('#account-logout').onclick=async()=>{await clearSession();login();};
 for(const [id,action] of [['email-form','update_email'],['password-form','change_password']]){
 const form=main.querySelector('#'+id);form.onsubmit=async event=>{event.preventDefault();const values=Object.fromEntries(new FormData(form)),s=form.querySelector('[role="status"]'),b=event.submitter;if(action==='change_password'&&values.password!==values.confirm){s.textContent='Les mots de passe ne correspondent pas.';return;}b.disabled=true;try{await access({action,...values});if(action==='update_email'){await client.auth.refreshSession();form.elements.current_password.value='';s.textContent='E-mail enregistré. Utilisez-le pour vos prochaines connexions.';}else{form.reset();s.textContent='Mot de passe modifié.';}}catch(e){s.textContent=e.message;}finally{b.disabled=false;}};
 }
 }catch(e){main.innerHTML='<section class="account-card"><h1>Mon compte</h1><p>'+esc(e.message)+'</p><button id="leave">Se déconnecter</button></section>';main.querySelector('#leave').onclick=async()=>{await clearSession();login();};}
}
if(token)await invitation();else await render();
