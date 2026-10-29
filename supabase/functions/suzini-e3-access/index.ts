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
 if(body.user_id){const {data:target}=await service.from('club_accounts').select('event_ids').eq('id',body.user_id).maybeSingle();if(!target||target.event_ids.length!==1||target.event_ids[0]!==scopedEvent)return reply({error:'Ce compte ne dépend pas de cette étape.'},403);}
 if(['create','update'].includes(body.action))body.event_ids=[scopedEvent];
 if(body.action==='delete'){
  const {data:account}=await service.from('club_accounts').select('user_id').eq('id',body.user_id).single();
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
 if(body.action==='list'){
  const {data,error}=await service.from('club_accounts').select('id,user_id,username,display_name,email,enabled,event_ids,activated_at,invite_expires_at,invitation_sent_at,first_sign_in_at,last_activity_at,invitation_opened_at,invite_tracking_token').contains('event_ids',[scopedEvent]).order('created_at');
  if(error)throw new Error('Gestion des accès indisponible.');
  return reply({accounts:data.map(a=>({...a,user_id:a.id}))});
 }
 if(body.action==='mark_sent'){
  const {error}=await service.from('club_accounts').update({invitation_sent_at:new Date().toISOString()}).eq('id',body.user_id);
  if(error)throw new Error('Mise à jour impossible.');return reply({ok:true});
 }
 if(body.action==='update'){
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
