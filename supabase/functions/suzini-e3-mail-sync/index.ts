import {createClient} from 'npm:@supabase/supabase-js@2.57.4';
import {ImapFlow} from 'npm:imapflow@2.10.0';
import PostalMime from 'npm:postal-mime@4.2.0';
import {parseOrder} from './parser.js';
const url=Deno.env.get('SUPABASE_URL')!;
const db=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
const origins=new Set(['https://julyanabt.fr','http://127.0.0.1:8893']);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const cors={'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://julyanabt.fr','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'};
 const response=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return response({error:'POST requis'},405);
 let actor:string|null=null;
 const cron=req.headers.get('X-Suzini-Mail-Token');
 if(!cron){const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return response({error:'Connexion requise'},401);const {data,error}=await db.auth.getUser(token);if(error||!data.user)return response({error:'Connexion requise'},401);actor=data.user.id;}
 const {data:cfg,error:claimError}=await db.rpc('suzini_e3_mail_claim',{p_token:cron,p_actor:actor});
 if(claimError)return response({error:'Accès non autorisé'},403);
 if(!cfg?.ready)return response({ready:false,busy:!!cfg?.busy});
 let uid=Number(cfg.last_uid)||0,validity=String(cfg.uid_validity||''),imap:ImapFlow|null=null;
 const counts={matched:0,pending:0,duplicate:0,ignored:0};
 let stage='connexion';
 try{
  imap=new ImapFlow({host:'mail.infomaniak.com',port:993,secure:true,auth:{user:'contact@julyanabt.fr',pass:cfg.password},logger:false,disableAutoIdle:true,disableCompression:true,connectionTimeout:12000,greetingTimeout:12000,socketTimeout:20000,tls:{rejectUnauthorized:true}});
  await imap.connect();
  const lock=await imap.getMailboxLock('INBOX',{readOnly:true});
  try{
   validity=String(imap.mailbox.uidValidity);
   if(validity!==cfg.uid_validity)uid=0;
   stage='lecture';
   const found=await imap.search({since:new Date(cfg.started_at),from:'no-reply@notification.sumup.com'},{uid:true});
   const ids=(found||[]).filter((id:number)=>id>uid).sort((a:number,b:number)=>a-b).slice(0,15);
   for(const id of ids){
    const meta=await imap.fetchOne(String(id),{size:true,internalDate:true},{uid:true});
    if(!meta)continue;
    const received=new Date(meta.internalDate).toISOString();
    if(new Date(received)<new Date(cfg.started_at)||meta.size>2_000_000){uid=id;counts.ignored++;continue;}
    const message=await imap.fetchOne(String(id),{source:true},{uid:true});
    if(!message?.source)throw new Error('Message indisponible');
    const mail=await PostalMime.parse(message.source,{maxNestingDepth:30,maxHeadersSize:100000,maxPartCount:100,maxRfc822NestingDepth:0});
    const order=parseOrder(mail,received,cfg.product);
    if(order){stage='enregistrement';const {data,error}=await db.rpc('suzini_e3_mail_ingest',{p_order:order});if(error)throw new Error('Erreur de rapprochement');if(data in counts)counts[data as keyof typeof counts]++;}else counts.ignored++;
    uid=id;
   }
  }finally{lock.release();}
  await imap.logout();imap=null;
  await db.rpc('suzini_e3_mail_finish',{p_uid:uid,p_validity:validity,p_error:null});
  return response({ready:true,...counts});
 }catch{
  try{imap?.close();}catch{}
  // Never log credentials, bodies, addresses or provider exception messages.
  await db.rpc('suzini_e3_mail_finish',{p_uid:uid,p_validity:validity,p_error:stage==='connexion'?'Connexion Infomaniak refusée ou indisponible. Vérifiez le mot de passe d’appareil.':stage==='lecture'?'Lecture des confirmations interrompue. Une nouvelle tentative aura lieu.':'Rapprochement interrompu. Une nouvelle tentative aura lieu.'});
  return response({error:'Synchronisation interrompue',stage},502);
 }
});
