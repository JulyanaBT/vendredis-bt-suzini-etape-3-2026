import {client} from './private-client.js?v=94';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let managerWatch;
export async function accessManager(backend,main,isCurrent,logout){
 clearTimeout(managerWatch);
 const {accounts,directory=[]}=await backend.access({action:'list'});if(!isCurrent())return;
 const invite=location.hash==='#admin-inviter';
 const date=v=>v?new Intl.DateTimeFormat('fr-FR',{dateStyle:'short',timeStyle:'short',timeZone:'America/Cayenne'}).format(new Date(v)):'—';
 const history=(id,used)=>id&&used?'<details class="manager-usage" data-usage="'+esc(id)+'"><summary>Historique d’utilisation</summary><div data-usage-content></div></details>':'';
 const status=a=>!a.enabled?'Suspendu':a.first_sign_in_at||a.last_activity_at?'Activé · connecté':a.activated_at?'Compte activé':a.invitation_opened_at?'Lien ouvert · à activer':a.invitation_sent_at?'Invitation partagée':'Invitation à partager';
 main.innerHTML=invite?'<section class="admin-card"><span class="admin-eyebrow">ACCÈS CLUB</span><h1>Inviter un gestionnaire</h1><p>Un nom pour le suivi, un lien à transmettre. Le gestionnaire choisira son e-mail dans Mon compte.</p><form id="simple-invite"><label>Nom de suivi<input name="display_name" maxlength="80" autocomplete="off" placeholder="Ex. Mélanie" required></label><small>Ce nom sert uniquement à suivre l’invitation. Le mot de passe initial commun est déjà configuré ; le gestionnaire pourra le conserver ou le changer.</small><button>Créer le lien d’invitation</button><p role="status"></p></form><div id="invite-result"></div></section>':'<section class="admin-card"><div class="admin-card-title"><h1>Gestionnaires</h1><a class="button" href="#admin-inviter">＋ Inviter</a></div><p>'+accounts.length+' accès · '+accounts.filter(a=>a.activated_at).length+' activé(s)</p><div class="manager-list">'+accounts.map(a=>'<article class="manager-item" data-manager="'+esc(a.user_id)+'"><div class="manager-heading"><h2>'+esc(a.display_name||a.username)+'</h2><span class="manager-state '+(a.activated_at?'ready':'pending')+'">'+status(a)+'</span></div><p>'+esc(a.email&&!a.email.endsWith('@accounts.invalid')?a.email:'E-mail à renseigner par le gestionnaire')+'</p><details><summary>Suivi de l’activation</summary><dl><dt>Lien ouvert</dt><dd>'+date(a.invitation_opened_at)+'</dd><dt>Compte activé</dt><dd>'+date(a.activated_at)+'</dd><dt>Dernier accès</dt><dd>'+date(a.last_activity_at)+'</dd></dl></details>'+history(a.auth_user_id,a.first_sign_in_at||a.last_activity_at||a.activated_at)+'<div class="admin-actions">'+(a.enabled?'<button data-share>'+(a.activated_at?'Lien Mon compte':'Renouveler / partager le lien')+'</button>':'')+'<button data-toggle>'+(a.enabled?'Suspendre':'Réactiver')+'</button><button class="danger" data-delete>Supprimer</button></div><p role="status"></p></article>').join('')+'</div></section>';
 if(!invite)main.insertAdjacentHTML('beforeend','<section class="admin-card"><h2>Autres e-mails enregistrés</h2><p>Ces comptes existent dans JulyanaBT, même sans accès à ce tournoi.</p>'+directory.map(u=>'<article class="manager-item" data-auth-user="'+esc(u.auth_user_id)+'"><h2 style="overflow-wrap:anywhere">'+esc(u.email)+'</h2><p>'+(u.protected?'Administrateur · compte protégé':u.last_sign_in_at?'Compte utilisé':'Aucune connexion enregistrée')+' · '+u.event_count+' accès événement</p><small>Créé le '+date(u.created_at)+'</small>'+history(u.auth_user_id,u.last_sign_in_at)+(!u.protected?'<div class="admin-actions"><button class="danger" data-remove-auth>Supprimer le compte et libérer l’e-mail</button></div>':'')+'<p role="status"></p></article>').join('')+(directory.length?'':'<p>Aucun autre e-mail enregistré.</p>')+'</section>');
 main.insertAdjacentHTML('beforeend','<div class="organizer-logout"><button id="admin-logout">Se déconnecter</button></div>');main.querySelector('#admin-logout').onclick=logout;
 function share(result,target){
 target.replaceChildren();const p=document.createElement('p');p.textContent='Lien personnel valable 7 jours, utilisable une fois. Le message WhatsApp contient le lien et le mot de passe initial. Le gestionnaire pourra conserver ce mot de passe ou le modifier.';
 const input=document.createElement('input');input.readOnly=true;input.value=result.link;input.setAttribute('aria-label','Lien personnel d’invitation');
 const a=document.createElement('a');a.className='button';a.target='_blank';a.rel='noopener noreferrer';a.referrerPolicy='no-referrer';a.textContent='Partager sur WhatsApp ↗';const message='Invitation à gérer Les Vendredis du BT Suzini – Étape 3.\n\nOuvre Mon compte et renseigne ton e-mail :\n'+result.link+'\n\nMot de passe initial : '+result.initial_password+'\n\nTu peux conserver ce mot de passe ou le modifier. Si ton e-mail possède déjà un compte JulyanaBT, utilise son mot de passe actuel lorsque demandé.';a.href='https://wa.me/?text='+encodeURIComponent(message);
 a.onclick=()=>backend.access({action:'mark_sent',user_id:result.user_id}).catch(()=>{});
 const copy=document.createElement('button');copy.textContent='Copier l’invitation';copy.onclick=async()=>{try{await navigator.clipboard.writeText(message);copy.textContent='Invitation copiée ✓';}catch{input.focus();input.select();}};
 target.append(p,input,a,copy);
 }
 const form=main.querySelector('#simple-invite');if(form)form.onsubmit=async event=>{event.preventDefault();const b=event.submitter;b.disabled=true;const s=form.querySelector('[role="status"]');s.textContent='Création du lien…';try{const result=await backend.access({action:'invite_simple',display_name:new FormData(form).get('display_name')});if(!isCurrent())return;share(result,main.querySelector('#invite-result'));s.textContent='Invitation prête à partager.';form.reset();}catch(e){s.textContent=e.message;}finally{b.disabled=false;}};
 main.querySelectorAll('[data-manager]').forEach(row=>{
 const a=accounts.find(a=>a.user_id===row.dataset.manager);
 async function run(body){row.querySelectorAll('button').forEach(b=>b.disabled=true);try{await backend.access(body);await accessManager(backend,main,isCurrent,logout);}catch(e){row.querySelector('[role="status"]').textContent=e.message;row.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 row.querySelector('[data-toggle]').onclick=()=>run({action:'update',user_id:a.user_id,event_ids:['20261106-0000-4000-8000-000000000003'],enabled:!a.enabled});
 const remove=row.querySelector('[data-delete]');remove.textContent=a.auth_user_id?'Supprimer le compte':'Supprimer l’invitation';remove.disabled=!!a.protected;
 remove.onclick=()=>{const message=a.auth_user_id?'Supprimer définitivement le compte '+(a.email||a.display_name)+' et tous ses accès JulyanaBT ? Son e-mail sera libéré. Cette action est irréversible.':'Supprimer cette invitation en attente ?';if(confirm(message))run(a.auth_user_id?{action:'delete_account',auth_user_id:a.auth_user_id,confirm:true}:{action:'delete',user_id:a.user_id});};
 const b=row.querySelector('[data-share]');if(b)b.onclick=async()=>{if(a.activated_at){const area=document.createElement('div');row.append(area);const link=document.createElement('a');link.className='button';link.target='_blank';link.rel='noopener';link.textContent='Partager Mon compte sur WhatsApp ↗';link.href='https://wa.me/?text='+encodeURIComponent('Ton espace Mon compte pour Les Vendredis du BT Suzini : https://julyanabt.fr/vendredis-bt-suzini-etape-3-2026/club/compte.html');area.append(link);return;}b.disabled=true;try{const r=await backend.access({action:'renew_simple',user_id:a.user_id});const area=document.createElement('div');row.append(area);share(r,area);}catch(e){row.querySelector('[role="status"]').textContent=e.message;}finally{b.disabled=false;}};
 });


 main.querySelectorAll('[data-usage]').forEach(box=>{
 let loaded=false,loading=false;
 async function load(){
 if(loaded||loading||!box.open)return;loading=true;const panel=box.querySelector('[data-usage-content]');panel.textContent='Chargement de l’historique…';
 try{
 const {data,error}=await client.rpc('suzini_e3_usage_history',{p_user:box.dataset.usage});if(error)throw error;
 panel.innerHTML='<ol class="usage-timeline" style="padding-left:20px;font-size:12px;line-height:1.5">'+data.events.map(e=>'<li style="margin:9px 0"><strong>'+esc(e.label)+'</strong><br><time>'+esc(date(e.at))+'</time></li>').join('')+'</ol><small>Horaires de Guyane · Informations conservées disponibles, jusqu’à 50 événements. Les anciennes connexions ne sont pas toutes historisées.</small>';loaded=true;
 }catch(error){panel.textContent='Historique indisponible. ';const retry=document.createElement('button');retry.type='button';retry.textContent='Réessayer';retry.onclick=load;panel.append(retry);}finally{loading=false;}
 }
 box.addEventListener('toggle',load);
 });
 main.querySelectorAll('[data-auth-user]').forEach(row=>{
 const u=directory.find(u=>u.auth_user_id===row.dataset.authUser),button=row.querySelector('[data-remove-auth]');if(!button)return;
 button.onclick=async()=>{if(!confirm('Supprimer définitivement le compte '+u.email+' et tous ses accès JulyanaBT ? Son e-mail sera libéré. Cette action est irréversible.'))return;button.disabled=true;
 try{await backend.access({action:'delete_account',auth_user_id:u.auth_user_id,confirm:true});await accessManager(backend,main,isCurrent,logout);}catch(e){row.querySelector('[role="status"]').textContent=e.message;button.disabled=false;}};
 });
 if(!invite){
 const watch=async()=>{if(!isCurrent()||location.hash!=='#admin')return;if(document.hidden||main.querySelector('button:disabled,#invite-result input,.manager-item input,.manager-usage[open]')){managerWatch=setTimeout(watch,15000);return;}try{const fresh=await backend.access({action:'list'});if(isCurrent()&&(JSON.stringify(fresh.accounts)!==JSON.stringify(accounts)||JSON.stringify(fresh.directory||[])!==JSON.stringify(directory))){await accessManager(backend,main,isCurrent,logout);return;}}catch{}managerWatch=setTimeout(watch,15000);};managerWatch=setTimeout(watch,15000);
 }

}
