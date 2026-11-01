import {client} from './private-client.js?v=91';
const file=location.pathname.split('/').pop()||'index.html';
const space=document.body.dataset.space;
const exempt=space==='admin'||(space==='club'&&file==='compte.html');
const page=['infos.html','contact.html','flyer.html','reglement.html','animations.html'].includes(file)?'infos.html':['tirage.html','matchs-direct.html','classement.html','resultats.html'].includes(file)?'programmation.html':file;
let visible=false,checking=false;
async function checkMaintenance(){
 if(exempt||checking)return;checking=true;
 try{
 const [{data:state,error},{data:admin}]=await Promise.all([client.rpc('suzini_e3_maintenance'),client.rpc('suzini_e3_is_admin')]);
 if(error||!state)return;
 const blocked=!admin&&(space==='club'?state.club_blocked:state.pages.includes(page));
 document.body.classList.toggle('site-in-maintenance',blocked);
 if(blocked){
 let box=document.querySelector('.maintenance-cover');
 if(!box){box=document.createElement('section');box.className='maintenance-cover';box.setAttribute('role','status');box.innerHTML='<div class="maintenance-notice"><span class="maintenance-badge">⚒</span><small>LES VENDREDIS DU BT SUZINI</small><h1>Une petite pause<br>pour préparer la suite</h1><p>Cette rubrique est momentanément en maintenance.</p><p>Merci de votre patience, à très vite sur le sable !</p>'+(space==='club'?'<a href="compte.html">Accéder à Mon compte →</a>':'')+'</div>';document.body.append(box);}
 const header=document.querySelector('#publicHeader');box.style.top=(header?.getBoundingClientRect().bottom||0)+'px';
 }else{document.querySelector('.maintenance-cover')?.remove();if(visible){location.reload();return;}}
 visible=blocked;
 }catch{}finally{checking=false;}
}
if(!exempt){checkMaintenance();setInterval(()=>{if(!document.hidden)checkMaintenance();},15000);window.addEventListener('focus',checkMaintenance);}
