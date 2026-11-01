import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {config} from './supabase-config.js?v=93';
export const client=createClient(config.supabaseUrl,config.publishableKey,{auth:{storageKey:'suzini-e3-admin',persistSession:true,autoRefreshToken:true}});
export function withDeadline(promise,ms=12000){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Le chargement prend trop de temps. Vérifiez votre connexion puis réessayez.')),ms);})]).finally(()=>clearTimeout(timer));
}
export async function clearSession(){
 try{await withDeadline(client.auth.signOut({scope:'local'}),3000);}catch{}
 try{localStorage.removeItem('suzini-e3-admin');localStorage.removeItem('suzini-e3-admin-code-verifier');}catch{}
}
const expired=()=>Object.assign(new Error('Votre session a expiré. Reconnectez-vous ci-dessous.'),{code:'AUTH_SESSION_EXPIRED'});
export async function access(body,authorized=true){
 let session=null;
 if(authorized){const result=await withDeadline(client.auth.getSession());session=result.data.session;}
 if(authorized&&!session)throw expired();
 const send=async current=>{
 const headers={apikey:config.publishableKey,'Content-Type':'application/json'};
 if(authorized)headers.Authorization='Bearer '+current.access_token;
 const controller=new AbortController();
 try{const r=await withDeadline(fetch(config.supabaseUrl+'/functions/v1/suzini-e3-access',{method:'POST',headers,body:JSON.stringify(body),cache:'no-store',signal:controller.signal}),12000);
 const data=await withDeadline(r.json(),5000);return {r,data};}finally{controller.abort();}
 };
 let result=await send(session);
 if(authorized&&result.r.status===401){
 const refresh=await withDeadline(client.auth.refreshSession());
 if(refresh.error||!refresh.data.session){await clearSession();throw expired();}
 session=refresh.data.session;result=await send(session);
 if(result.r.status===401){await clearSession();throw expired();}
 }
 if(!result.r.ok)throw Object.assign(new Error(result.data.error||'Opération indisponible.'),{status:result.r.status,code:result.data.code});
 return result.data;
}
export async function signIn(identifier,password){identifier=String(identifier).trim();if(identifier.includes('@')){const {error}=await client.auth.signInWithPassword({email:identifier,password});if(error)throw new Error('Identifiants incorrects.');}else{const data=await access({action:'login',username:identifier,password},false);const {error}=await client.auth.setSession(data.session);if(error)throw error;}}
