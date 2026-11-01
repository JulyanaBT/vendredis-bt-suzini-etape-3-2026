import {config} from './supabase-config.js?v=54';
async function checkMaintenance(){

if(document.body.dataset.space!=='admin'){
 try{const response=await fetch(config.supabaseUrl+'/rest/v1/rpc/suzini_e3_maintenance',{method:'POST',headers:{apikey:config.publishableKey,'Content-Type':'application/json'},body:'{}',cache:'no-store'});if(response.ok){const state=await response.json();const club=document.body.dataset.space==='club';const file=location.pathname.split('/').pop()||'index.html';if((club&&state.club_blocked)||(!club&&state.pages.includes(file))){const main=document.querySelector('main');main.replaceChildren();const card=document.createElement('section');card.className='compact-signup';const h=document.createElement('h1');h.textContent='Maintenance en cours';const p=document.createElement('p');p.textContent='Cet espace est temporairement indisponible. Revenez dans quelques instants.';card.append(h,p);main.append(card);}}}catch{}
}

}
checkMaintenance();
