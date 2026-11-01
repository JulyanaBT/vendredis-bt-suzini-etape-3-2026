import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
const url = Deno.env.get('SUPABASE_URL')!;
const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {auth:{persistSession:false,autoRefreshToken:false}});
const authClient = () => createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const digest = async (token:string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),b=>b.toString(16).padStart(2,'0')).join('');
const site = 'https://julyanabt.fr/vendredis-bt-suzini-etape-3-2026/club/index.html';
const origins = new Set(['https://julyanabt.fr','http://127.0.0.1:8893']);
Deno.serve(async req => {
 const origin=req.headers.get('origin') || '';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://julyanabt.fr','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(req.method==='OPTIONS')return new Response(null,{headers});
 if(req.method!=='POST'||(origin&&!origins.has(origin)))return reply({error:'Requête non autorisée.'},403);
 try {
 const body=await req.json();

 if(body.action==='invite_info'||body.action==='activate_simple'){
 const token=String(body.token||'');
 if(!/^[a-f0-9]{64}$/.test(token))return reply({error:'Lien d’invitation incomplet.'},400);
 const hash=await digest(token);
 const {data:inv}=await service.from('club_accounts').select('id,username,enabled,event_ids,invite_expires_at,user_id,invitation_opened_at').eq('invitation_hash',hash).is('user_id',null).maybeSingle();
 if(!inv?.enabled||inv.event_ids.length!==1||inv.event_ids[0]!=='20261106-0000-4000-8000-000000000003'||!inv.invite_expires_at||Date.parse(inv.invite_expires_at)<=Date.now())return reply({error:'Ce lien est expiré, annulé ou déjà utilisé. Si le compte est activé, connectez-vous avec votre e-mail.'},400);
 if(body.action==='invite_info'){
 if(!inv.invitation_opened_at)await service.from('club_accounts').update({invitation_opened_at:new Date().toISOString()}).eq('id',inv.id).eq('invitation_hash',hash);
 return reply({ok:true,expires_at:inv.invite_expires_at});
 }
 const initial=String(body.initial_password||'');
 const {data:matches,error:passwordError}=await service.rpc('suzini_e3_invite_password_matches',{p_password:initial});
 if(passwordError||!matches)return reply({error:'Le mot de passe initial transmis par l’organisation est incorrect.'},400);
 const email=String(body.email||'').trim().toLowerCase();
 const password=String(body.new_password||initial);
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>150||password.length<6||password.length>128)return reply({error:'Vérifiez l’e-mail et le mot de passe (6 caractères minimum).'},400);
 const {data:created,error:creation}=await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{club_invitation_id:inv.id,club_invitation_hash:hash}});
 if(creation){
 if(!['email_exists','user_already_exists'].includes(creation.code||'')&&!/already.*registered|already.*exist/i.test(creation.message||''))return reply({error:'La création du compte a échoué. Votre invitation reste utilisable ; contactez l’administrateur.'},400);
 const existingPassword=String(body.existing_password||initial);
 const {data:existing,error:existingError}=await authClient().auth.signInWithPassword({email,password:existingPassword});
 if(existingError||!existing.user||!existing.session)return reply({error:'Cet e-mail possède déjà un compte. Saisissez le mot de passe actuel de ce compte pour le rattacher au tournoi.',code:'EXISTING_ACCOUNT_PASSWORD_REQUIRED'},409);
 const {error:attachError}=await service.rpc('suzini_e3_attach_existing_invite',{p_hash:hash,p_user:existing.user.id});
 if(attachError)return reply({error:'Le rattachement a échoué. Vérifiez que le compte n’est pas suspendu ou contactez l’administrateur. Votre mot de passe est conservé.'},400);
 return reply({session:existing.session,email,reused:true});
 }
 if(!created?.user)return reply({error:'Compte créé sans réponse de finalisation. Contactez l’administrateur.'},400);
 const {error:finalization}=await service.rpc('suzini_e3_finalize_invite',{p_user:created.user.id});
 if(finalization)return reply({error:'Le compte a été créé mais l’accès Club n’a pas pu être finalisé. Réessayez avec le même lien et votre mot de passe.'},400);
 const {data,error}=await authClient().auth.signInWithPassword({email,password});
 if(error||!data.session)return reply({error:'Compte activé. Connectez-vous avec votre e-mail et votre mot de passe.'},400);
 await service.from('club_accounts').update({first_sign_in_at:new Date().toISOString(),last_activity_at:new Date().toISOString()}).eq('id',inv.id);
 return reply({session:data.session,email});
 }

 if(body.action==='login'){
  const username=String(body.username||'').trim().toLowerCase();
  const {data:account}=await service.from('club_accounts').select('user_id,email,enabled,activated_at').eq('username',username).maybeSingle();
  const authUser=account?.user_id?(await service.auth.admin.getUserById(account.user_id)).data.user:null;
  const client=authClient();
  const {data,error}=await client.auth.signInWithPassword({email:authUser?.email||'unknown-account@invalid.example',password:String(body.password||'')});
  if(error||!account?.enabled||!account.activated_at)return reply({error:'Identifiant ou mot de passe incorrect, ou accès désactivé.'},401);
  return reply({session:data.session});
 }
 if(body.action==='activate'){
  const password=String(body.password||'');
  if(password.length<6||password.length>128)return reply({error:'Choisissez un mot de passe de 6 à 128 caractères.'},400);
  if(body.type==='club'){
   const token=String(body.token_hash||'');
   const email=String(body.email||'').trim().toLowerCase();
   if(!/^[a-f0-9]{64}$/.test(token)||!/^\S+@\S+\.\S+$/.test(email)||email.length>150)return reply({error:'Vérifiez le lien et votre e-mail.'},400);
   const hash=await digest(token);
   const {data:invitation,error:lookupError}=await service.from('club_accounts').select('id,username,enabled,invite_expires_at').eq('invitation_hash',hash).is('user_id',null).maybeSingle();
   if(lookupError||!invitation?.enabled||!invitation.invite_expires_at||Date.parse(invitation.invite_expires_at)<=Date.now())return reply({error:'Ce lien est expiré, annulé ou déjà utilisé.'},400);
   const {error}=await service.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{club_invitation_id:invitation.id,club_invitation_hash:hash}});
   if(error)return reply({error:'Création impossible : cet e-mail peut être déjà utilisé, le mot de passe refusé ou le lien expiré. Aucun compte existant n’a été modifié.'},400);
   return reply({username:invitation.username});
  }
  if(!['invite','recovery'].includes(body.type)||typeof body.token_hash!=='string')return reply({error:'Invitation invalide.'},400);
  const username=String(body.username||'').trim().toLowerCase();
  const email=String(body.email||'').trim().toLowerCase();
  const {data:expected}=await service.from('club_accounts').select('user_id,email').eq('username',username).maybeSingle();
  if(!expected||expected.email!==email)return reply({error:'Vérifiez l’identifiant et l’e-mail indiqués par l’administrateur.'},400);
  const client=authClient();
  const {data,error}=await client.auth.verifyOtp({token_hash:body.token_hash,type:body.type});
  if(error||!data.user||!data.session||data.user.id!==expected.user_id)return reply({error:'Ce lien est expiré ou déjà utilisé. Demandez une nouvelle invitation.'},400);
  const {data:account}=await service.from('club_accounts').select('*').eq('user_id',data.user.id).maybeSingle();
  if(!account?.enabled||account.activated_at||!account.invite_expires_at||Date.parse(account.invite_expires_at)<Date.now())return reply({error:'Invitation expirée ou annulée.'},403);
  const {error:passwordError}=await service.auth.admin.updateUserById(data.user.id,{password,email_confirm:true});
  if(passwordError)throw new Error('Ce mot de passe ne peut pas être enregistré. Demandez un nouveau lien.');
  const {error:assignError}=await service.rpc('finish_club_activation',{target_user:data.user.id});
  if(assignError)throw new Error('Activation interrompue. Demandez une nouvelle invitation.');
  return reply({username:account.username});
 }
 const bearer=req.headers.get('authorization')?.replace(/^Bearer /i,'');
 if(!bearer)return reply({error:'Connexion administrateur requise.'},401);
 const {data:userData,error:userError}=await service.auth.getUser(bearer);
 if(userError||!userData.user)return reply({error:'Connexion expirée.'},401);

 if(body.action==='update_email'){
 const {data:account}=await service.from('club_accounts').select('id,event_ids').eq('user_id',userData.user.id).eq('enabled',true).not('activated_at','is',null).maybeSingle();
 if(!account)return reply({error:'Accès Club requis.'},403);
 const {data:membership}=await service.from('event_memberships').select('user_id').eq('user_id',userData.user.id).eq('event_id','20261106-0000-4000-8000-000000000003').maybeSingle();if(!membership)return reply({error:'Accès Club requis.'},403);
 const email=String(body.email||'').trim().toLowerCase();
 if(!/^\S+@\S+\.\S+$/.test(email)||email.length>150)return reply({error:'E-mail invalide.'},400);
 const {error:check}=await authClient().auth.signInWithPassword({email:userData.user.email!,password:String(body.current_password||'')});
 if(check)return reply({error:'Le mot de passe actuel est incorrect.'},400);
 const {error}=await service.auth.admin.updateUserById(userData.user.id,{email,email_confirm:true});
 if(error)return reply({error:'Cet e-mail est déjà utilisé ou ne peut pas être enregistré.'},400);
 const {error:profileError}=await service.from('club_accounts').update({email}).eq('id',account.id);
 if(profileError){await service.auth.admin.updateUserById(userData.user.id,{email:userData.user.email!,email_confirm:true});return reply({error:'Modification impossible. Votre ancien identifiant est conservé.'},400);}
 return reply({ok:true,email});
 }

 if(body.action==='profile'||body.action==='update_profile'){
  const {data:account}=await service.from('club_accounts').select('id,username,email').eq('user_id',userData.user.id).eq('enabled',true).not('activated_at','is',null).maybeSingle();
  if(!account)return reply({error:'Ce compte ne dispose pas d’un profil gestionnaire Club.'},403);
  if(body.action==='profile')return reply({username:account.username,email:account.email?.endsWith('@accounts.invalid')?'':account.email||''});
  const {error:check}=await authClient().auth.signInWithPassword({email:userData.user.email!,password:String(body.current_password||'')});
  if(check)return reply({error:'Le mot de passe actuel est incorrect.'},400);
  const username=String(body.username||'').trim().toLowerCase(),email=String(body.email||'').trim().toLowerCase();
  if(!/^[a-z][a-z0-9_-]{1,29}$/.test(username)||email.length>150||(email&&!/^\S+@\S+\.\S+$/.test(email)))return reply({error:'Vérifiez l’identifiant et l’e-mail.'},400);
  const {error}=await service.from('club_accounts').update({username,email:email||null}).eq('id',account.id).eq('enabled',true);
  if(error)return reply({error:'Cet identifiant ou cet e-mail est déjà utilisé, ou la modification est impossible.'},400);
  return reply({ok:true,username,email});
 }
 if(body.action==='change_password'){
  const password=String(body.password||'');
  if(password.length<6||password.length>128)return reply({error:'Choisissez un mot de passe de 6 à 128 caractères.'},400);
  const {data:account}=await service.from('club_accounts').select('id').eq('user_id',userData.user.id).eq('enabled',true).not('activated_at','is',null).maybeSingle();
  if(!account)return reply({error:'Accès Club requis.'},403);
  const {error:check}=await authClient().auth.signInWithPassword({email:userData.user.email!,password:String(body.current_password||'')});
  if(check)return reply({error:'Le mot de passe actuel est incorrect.'},400);
  const {error}=await service.auth.admin.updateUserById(userData.user.id,{password});
  if(error)return reply({error:'Ce mot de passe ne peut pas être enregistré.'},400);
  return reply({ok:true});
 }
 const {data:owner}=await service.from('organizers').select('user_id').eq('user_id',userData.user.id).maybeSingle();
 if(!owner)return reply({error:'Accès réservé à l’administrateur.'},403);
 const scopedEvent='20261106-0000-4000-8000-000000000003';

 if(body.action==='delete_account'){
 const id=String(body.auth_user_id||'');
 if(body.confirm!==true||!/^[a-f0-9-]{36}$/.test(id))return reply({error:'Confirmez la suppression complète du compte.'},400);
 const {data:protectedUser}=await service.from('organizers').select('user_id').eq('user_id',id).maybeSingle();
 if(protectedUser||id===userData.user.id)return reply({error:'Compte administrateur protégé.'},403);
 const {data:target,error:lookup}=await service.auth.admin.getUserById(id);
 if(lookup||!target.user)return reply({error:'Compte introuvable. Actualisez la liste.'},404);
 const {data:linked,error:linkedError}=await service.from('club_accounts').select('id').eq('linked_user_id',id);
 if(linkedError)return reply({error:'Impossible de vérifier les accès associés.'},400);
 const {error}=await service.auth.admin.deleteUser(id,false);
 if(error)return reply({error:'Suppression refusée par le serveur. Le compte et son e-mail n’ont pas été libérés.'},400);
 if(linked?.length){const {error:cleanup}=await service.from('club_accounts').delete().in('id',linked.map(a=>a.id));if(cleanup)return reply({ok:true,email_released:true,warning:'Compte supprimé. Certains anciens suivis d’invitation restent à retirer.'});}
 return reply({ok:true,email_released:true});
 }
 if(body.user_id){const {data:target}=await service.from('club_accounts').select('event_ids').eq('id',body.user_id).maybeSingle();if(!target||target.event_ids.length!==1||target.event_ids[0]!==scopedEvent)return reply({error:'Ce compte ne dépend pas de cette étape.'},403);}
 if(['create','update'].includes(body.action))body.event_ids=[scopedEvent];
 if(body.action==='delete'){
  const {data:account}=await service.from('club_accounts').select('user_id,linked_user_id').eq('id',body.user_id).single();
  if(account?.linked_user_id){const {error}=await service.rpc('suzini_e3_linked_access',{p_id:body.user_id,p_enabled:false});if(error)return reply({error:'Ce compte est protégé ou ne peut pas être retiré.'},403);}
  if(account?.user_id){const {data:protectedUser}=await service.from('organizers').select('user_id').eq('user_id',account.user_id).maybeSingle();if(protectedUser||account.user_id===userData.user.id)return reply({error:'Compte administrateur protégé.'},403);const {error}=await service.auth.admin.deleteUser(account.user_id);if(error)throw error;}
  const {error}=await service.from('club_accounts').delete().eq('id',body.user_id);if(error)throw error;return reply({ok:true});
 }

 if(body.action==='create_password'||body.action==='set_password'){
  const password=String(body.password||'');
  const eventId='20261106-0000-4000-8000-000000000003';
  if(password.length<6||password.length>128)return reply({error:'Choisissez un mot de passe de 6 à 128 caractères.'},400);
  let account;
  if(body.action==='create_password'){
   const username=String(body.username||'').trim().toLowerCase();
   if(!/^[a-z][a-z0-9_-]{1,29}$/.test(username))return reply({error:'Identifiant invalide.'},400);
   const {data,error}=await service.from('club_accounts').insert({username,display_name:username,event_ids:[eventId]}).select('*').single();
   if(error){
    if(error.code!=='23505')return reply({error:'Impossible de préparer le compte gestionnaire. Réessayez.'},400);
    const {data:pending}=await service.from('club_accounts').select('*').eq('username',username).is('user_id',null).is('activated_at',null).eq('enabled',true).maybeSingle();
    if(!pending)return reply({error:'Identifiant déjà utilisé. Utilisez Définir / partager le mot de passe sur ce compte.'},409);
    account=pending;
   }else account=data;
  }else{
   const {data}=await service.from('club_accounts').select('*').eq('id',body.user_id).maybeSingle();account=data;
  }
  if(!account||!account.enabled||account.event_ids.length!==1||account.event_ids[0]!==eventId)return reply({error:'Compte indisponible ou suspendu.'},400);
  if(!account.user_id){
   const {data:recovered,error:recoveryError}=await service.rpc('finalize_password_club_account',{p_account:account.id});
   if(recoveryError)return reply({error:'La liaison du compte ne peut pas être vérifiée. Contactez l’administrateur.'},400);
   if(recovered){account.user_id=recovered;account.activated_at=new Date().toISOString();}
  }
  if(account.user_id){
   const {data:protectedUser}=await service.from('organizers').select('user_id').eq('user_id',account.user_id).maybeSingle();
   if(protectedUser||account.user_id===userData.user.id)return reply({error:'Compte administrateur protégé.'},403);
   const {error}=await service.auth.admin.updateUserById(account.user_id,{password,email_confirm:true});
   if(error)return reply({error:'Mot de passe refusé.'},400);
   if(!account.activated_at){const {error:activation}=await service.rpc('finish_club_activation',{target_user:account.user_id});if(activation)throw activation;}
  }else{
   const hash=await digest(crypto.randomUUID());
   const {error:pending}=await service.from('club_accounts').update({invitation_hash:hash,invite_expires_at:new Date(Date.now()+3600000).toISOString()}).eq('id',account.id).is('user_id',null);
   if(pending)throw pending;
   const {error}=await service.auth.admin.createUser({email:`${account.id}@accounts.invalid`,password,email_confirm:true,app_metadata:{club_invitation_id:account.id,club_invitation_hash:hash}});
   if(error)return reply({error:'Création impossible. Vérifiez le mot de passe puis réessayez depuis la liste des gestionnaires.'},400);
  }
  const {error:finalizeError}=await service.rpc('finalize_password_club_account',{p_account:account.id});
  if(finalizeError)return reply({error:'Compte créé, mais finalisation impossible. Réessayez depuis les gestionnaires.'},400);
  const {data:ready}=await service.from('club_accounts').select('user_id,activated_at,enabled,invite_tracking_token').eq('id',account.id).single();
  if(!ready?.user_id||!ready.activated_at||!ready.enabled)return reply({error:'Le compte doit encore être finalisé. Réessayez depuis la liste des gestionnaires.'},400);
  return reply({user_id:account.id,username:account.username,link:site+'#compte?invitation='+ready.invite_tracking_token});
 }

 if(body.action==='invite_simple'||body.action==='renew_simple'){
 const eventId='20261106-0000-4000-8000-000000000003';
 let account;
 if(body.action==='invite_simple'){
 const name=String(body.display_name||'').trim();
 if(!name||name.length>80)return reply({error:'Indiquez un nom de suivi (80 caractères maximum).'},400);
 const username='m'+crypto.randomUUID().replaceAll('-','').slice(0,24);
 const {data,error}=await service.from('club_accounts').insert({username,display_name:name,event_ids:[eventId]}).select('id,username').single();
 if(error)return reply({error:'Invitation impossible. Réessayez.'},400);account=data;
 }else{
 const {data}=await service.from('club_accounts').select('id,username,user_id,activated_at,enabled,event_ids').eq('id',body.user_id).maybeSingle();
 if(!data||data.user_id||data.activated_at||!data.enabled||data.event_ids.length!==1||data.event_ids[0]!==eventId)return reply({error:'Cette invitation ne peut pas être renouvelée.'},400);account=data;
 }
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
 const expires=new Date(Date.now()+7*86400000).toISOString();
 const {data:updated,error}=await service.from('club_accounts').update({invitation_hash:await digest(token),invite_expires_at:expires,invitation_opened_at:null,invitation_sent_at:null}).eq('id',account.id).is('user_id',null).eq('enabled',true).select('id').maybeSingle();
 if(error||!updated)return reply({error:'Invitation indisponible.'},400);
 const {data:initialPassword,error:shareError}=await service.rpc('suzini_e3_invite_initial_password');
 if(shareError||!initialPassword)return reply({error:'Le mot de passe initial ne peut pas être préparé. Réessayez le partage depuis les gestionnaires.'},400);
 return reply({user_id:account.id,expires_at:expires,initial_password:initialPassword,link:'https://julyanabt.fr/vendredis-bt-suzini-etape-3-2026/club/compte.html#invitation?token='+token});
 }

 if(body.action==='list'){
  const {data,error}=await service.from('club_accounts').select('id,user_id,username,display_name,email,enabled,event_ids,activated_at,invite_expires_at,invitation_sent_at,first_sign_in_at,last_activity_at,invitation_opened_at,invite_tracking_token,linked_user_id').contains('event_ids',[scopedEvent]).order('created_at');
  if(error)throw new Error('Gestion des accès indisponible.');
  
 const {data:admins,error:adminsError}=await service.from('organizers').select('user_id');
 if(adminsError)return reply({error:'Impossible de vérifier les comptes protégés.'},400);
 const protectedIds=new Set((admins||[]).map(a=>a.user_id));
 const users=[];let page=1;
 while(true){const {data:batch,error}=await service.auth.admin.listUsers({page,perPage:200});if(error)return reply({error:'Impossible de charger les e-mails enregistrés.'},400);users.push(...batch.users);if(batch.users.length<200)break;page++;if(page>100)return reply({error:'Répertoire trop volumineux.'},400);}
 const usersById=new Map(users.map(u=>[u.id,u]));
 const accounts=data.map(a=>{const authId=a.user_id||a.linked_user_id;return {...a,user_id:a.id,auth_user_id:authId,protected:protectedIds.has(authId),email:authId?usersById.get(authId)?.email||a.email||'':a.email||'',linked_user_id:undefined};});
 const stageUsers=new Set(accounts.map(a=>a.auth_user_id).filter(Boolean));
 const {data:memberships,error:membershipsError}=await service.from('event_memberships').select('user_id');
 if(membershipsError)return reply({error:'Impossible de vérifier les accès.'},400);
 const counts=new Map();for(const m of memberships||[])counts.set(m.user_id,(counts.get(m.user_id)||0)+1);
 const directory=users.filter(u=>u.email&&!stageUsers.has(u.id)).map(u=>({auth_user_id:u.id,email:u.email,created_at:u.created_at,last_sign_in_at:u.last_sign_in_at||null,event_count:counts.get(u.id)||0,protected:protectedIds.has(u.id)})).sort((a,b)=>a.email.localeCompare(b.email));
 return reply({accounts,directory});

 }
 if(body.action==='mark_sent'){
  const {error}=await service.from('club_accounts').update({invitation_sent_at:new Date().toISOString()}).eq('id',body.user_id);
  if(error)throw new Error('Mise à jour impossible.');return reply({ok:true});
 }
 if(body.action==='update'){
  const {data:linked}=await service.from('club_accounts').select('linked_user_id').eq('id',body.user_id).maybeSingle();
  if(linked?.linked_user_id){if(typeof body.enabled!=='boolean')return reply({error:'Droits invalides.'},400);const {error}=await service.rpc('suzini_e3_linked_access',{p_id:body.user_id,p_enabled:body.enabled});if(error)return reply({error:'Impossible de modifier cet accès.'},403);return reply({ok:true});}
  if(!Array.isArray(body.event_ids)||typeof body.enabled!=='boolean')return reply({error:'Droits invalides.'},400);
  const {error}=await service.rpc('apply_club_assignments',{target_user:body.user_id,assigned_events:body.event_ids,access_enabled:body.enabled});
  if(error)throw new Error('Impossible de modifier ces droits.');
  return reply({ok:true});
 }
 if(body.action==='create'||body.action==='reinvite'){
  let account;

  if(body.action==='create'){
   const username=String(body.username||'').trim().toLowerCase();
   if(!/^[a-z][a-z0-9_-]{1,29}$/.test(username)||!Array.isArray(body.event_ids)||!body.event_ids.length)return reply({error:'Vérifiez l’identifiant et les événements.'},400);
   const {data:events,error:eventsError}=await service.from('events').select('id').in('id',body.event_ids);
   if(eventsError||events?.length!==new Set(body.event_ids).size)return reply({error:'Événement inconnu.'},400);
   const {data:created,error}=await service.from('club_accounts').insert({username,display_name:username,event_ids:body.event_ids}).select('*').single();
   if(error)return reply({error:'Cet identifiant est déjà utilisé ou l’invitation ne peut pas être créée.'},409);
   account=created;
  }else{
   const {data}=await service.from('club_accounts').select('*').eq('id',body.user_id).maybeSingle();
   if(!data||data.activated_at||!data.enabled)return reply({error:'Cette invitation ne peut pas être renouvelée.'},400);
   account=data;
  }
  if(!account.user_id){
   const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
   const expires=new Date(Date.now()+3600000).toISOString();
   const {data:updated,error}=await service.from('club_accounts').update({invitation_hash:await digest(token),invite_expires_at:expires,invitation_sent_at:null}).eq('id',account.id).is('user_id',null).eq('enabled',true).select('id').maybeSingle();
   if(error||!updated)throw new Error('Invitation indisponible.');
   return reply({user_id:account.id,username:account.username,expires_at:expires,link:`${site}#activation?username=${encodeURIComponent(account.username)}&type=club&token_hash=${token}`});
  }
  // Recovery token activates only this pending, non-admin Club account.
  const {data:generated,error}=await service.auth.admin.generateLink({type:'recovery',email:account.email});
  if(error||!generated.properties?.hashed_token)throw new Error('Le compte est réservé, mais le lien n’a pas été généré. Utilisez « Renouveler le lien ».');
  const expires=new Date(Date.now()+3600000).toISOString();
  const {error:expiryError}=await service.from('club_accounts').update({invite_expires_at:expires,invitation_sent_at:null}).eq('user_id',account.user_id);
  if(expiryError)throw new Error('Impossible de renouveler cette invitation.');
  return reply({user_id:account.user_id,username:account.username,expires_at:expires,link:`${site}#activation?username=${encodeURIComponent(account.username)}&type=recovery&token_hash=${encodeURIComponent(generated.properties.hashed_token)}`});
 }
 return reply({error:'Action inconnue.'},400);
 }catch{return reply({error:'Opération impossible. Actualisez la liste avant de réessayer.'},400);}
});
