import {rpc} from './supabase-site.js?v=94';
import {displayShortPlayerName,displayFirstName} from './team-cards.js?v=94';
import {config} from './supabase-config.js?v=94';
const paymentUrl="https://tennis-club-de-suzini.sumupstore.com/product/beach-tennis-inscription-tournoi-pour-un-competiteur-de-la-paire";
if(!paymentUrl){const a=document.getElementById('paymentLink');a?.removeAttribute('href');if(a){a.setAttribute('aria-disabled','true');a.setAttribute('tabindex','-1');a.textContent='Paiement en ligne · bientôt disponible';}}
if(paymentUrl){const a=document.getElementById('paymentLink');a.href=paymentUrl;a.removeAttribute('aria-disabled');a.removeAttribute('tabindex');a.textContent='Payer en ligne · 10 € par joueur';}
const $=id=>document.getElementById(id),key='suzini-e3-payment-receipt';
let receipt=null;try{receipt=JSON.parse(localStorage.getItem(key)||'null');}catch{}
function setReceipt(value){receipt=value;try{localStorage.setItem(key,JSON.stringify(value));}catch{}renderReceipt();}
function renderReceipt(){document.querySelectorAll('[name=paymentChoice]').forEach(input=>{input.disabled=!receipt?.token;input.checked=input.value===receipt?.choice;});if(receipt?.token){$('paymentChoiceStatus').textContent=receipt.choice?'Votre choix est enregistré. Vous pouvez le modifier.':'Choisissez votre mode de paiement.';}}
document.addEventListener('suzini:registered',event=>{setReceipt(event.detail);loadTeams();});
document.querySelectorAll('[name=paymentChoice]').forEach(input=>input.addEventListener('change',async()=>{if(!receipt?.token)return;const token=receipt.token,choice=input.value;document.querySelectorAll('[name=paymentChoice]').forEach(i=>i.disabled=true);$('paymentChoiceStatus').textContent='Enregistrement…';try{await rpc('suzini_e3_payment_choice',{p_token:token,p_choice:choice});if(receipt.token===token)setReceipt({...receipt,choice});if(choice==='online_now'){if(paymentUrl)location.assign(paymentUrl);else $('paymentChoiceStatus').textContent='Choix enregistré. Le lien de paiement sera disponible prochainement.';}if(choice==='cash')$('paymentChoiceStatus').textContent='Choix enregistré : règlement en espèces au club, le jour du tournoi.';}catch(error){renderReceipt();$('paymentChoiceStatus').textContent=error.message;}finally{document.querySelectorAll('[name=paymentChoice]').forEach(i=>i.disabled=!receipt?.token);}}));
renderReceipt();
const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
let teams=[],loading=false;
function renderTeams(){
 const name=(t,n)=>displayShortPlayerName(t['p'+n+'_last_name'],t['p'+n+'_first_name']);
 const count=t=>Number(t.paid_players)||0;
 const rows=[...teams].sort((a,b)=>count(a)-count(b)||(name(a,1)+' / '+name(a,2)).localeCompare(name(b,1)+' / '+name(b,2),'fr',{sensitivity:'base'}));
 $('paymentTeams').replaceChildren();$('paymentListStatus').textContent=rows.length?rows.length+' équipes · dames et messieurs':'Aucune équipe inscrite.';
 const dot=(state,label)=>{const d=el('span','€','euro-dot '+state);d.setAttribute('role','img');d.setAttribute('aria-label',label);d.title=label;return d;};
 for(const t of rows){const row=el('article','','payment-team payment-team-compact');
 for(const n of [1,2]){if(n===2)row.append(el('span','/','payment-separator'));const player=el('span','','payment-player-inline');player.append(el('span',name(t,n),'payment-player-name'),dot(t['p'+n+'_paid']?'paid':'unpaid',name(t,n)+(t['p'+n+'_paid']?' : payé':' : non payé')));row.append(player);}
 const state=count(t)===2?'paid':count(t)===1?'partial':'unpaid';row.append(dot(state,'Équipe : '+(count(t)===2?'payée':count(t)===1?'partiellement payée':'non payée')));$('paymentTeams').append(row);
 }
}
async function loadTeams(){if(loading)return;loading=true;$('refreshPayments').disabled=true;try{teams=await rpc('suzini_e3_teams');renderTeams();}catch(error){$('paymentListStatus').textContent=error.message;}finally{loading=false;$('refreshPayments').disabled=false;}}
$('refreshPayments').addEventListener('click',loadTeams);
document.getElementById('payment-tab').addEventListener('click',loadTeams);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadTeams();});
setInterval(()=>{if(!document.hidden&&!$('paiement-panel').hidden)loadTeams();},30000);
loadTeams();
