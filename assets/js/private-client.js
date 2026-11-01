import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {config} from './supabase-config.js?v=91';
export const client=createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'suzini-e3-admin',persistSession:true,autoRefreshToken:true}});
export async function clearSession(){
 try{await client.auth.signOut({scope:'local'});}catch{}
 try{localStorage.removeItem('suzini-e3-admin');localStorage.removeItem('suzini-e3-admin-code-verifier');}catch{}
}
const expired=()=>Object.assign(new Error('Votre session a expiré. Reconnectez-vous ci-dessous.'),{code:'AUTH_SESSION_EXPIRED'});
export async function access(body,authorized=true){
 let {data:{session}}=await client.auth.getSession();
 if(authorized&&!session)throw expired();
 const send=async current=>{
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(authorized)headers.Authorization='Bearer '+current.access_token;
 const r=await fetch(config.supabaseUrl+'/functions/v1/suzini-e3-access',{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:AbortSignal.timeout(15000)});
 const data=await r.json();return {r,data};
 };
 let result=await send(session);
 if(authorized&&result.r.status===401){
 const refresh=await client.auth.refreshSession();
 if(refresh.error||!refresh.data.session){await clearSession();throw expired();}
 session=refresh.data.session;result=await send(session);
 if(result.r.status===401){await clearSession();throw expired();}
 }
 if(!result.r.ok)throw Object.assign(new Error(result.data.error||'Opération indisponible.'),{status:result.r.status});
 return result.data;
}
export async function signIn(identifier,password){identifier=String(identifier).trim();if(identifier.includes('@')){const {error}=await client.auth.signInWithPassword({email:identifier,password});if(error)throw new Error('Identifiants incorrects.');}else{const data=await access({action:'login',username:identifier,password},false);const {error}=await client.auth.setSession(data.session);if(error)throw error;}}
