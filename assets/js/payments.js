import {rpc} from './supabase-site.js?v=21';
import {displayPlayerName,displayFirstName} from './team-cards.js?v=18';
import {config} from './supabase-config.js?v=27';
const paymentUrl=config.paymentUrl;
if(!paymentUrl){const a=document.getElementById('paymentLink');a?.removeAttribute('href');if(a){a.setAttribute('aria-disabled','true');a.setAttribute('tabindex','-1');a.textContent='Paiement en ligne · bientôt disponible';}}
if(paymentUrl){const a=document.getElementById('paymentLink');a.href=paymentUrl;a.removeAttribute('aria-disabled');a.removeAttribute('tabindex');a.textContent='Payer en ligne · 10 € par joueur';}
const $=id=>document.getElementById(id),key='suzini-e3-payment-receipt';
let receipt=null;try{receipt=JSON.parse(localStorage.getItem(key)||'null');}catch{}
function setReceipt(value){receipt=value;try{localStorage.setItem(key,JSON.stringify(value));}catch{}renderReceipt();}
function renderReceipt(){document.querySelectorAll('[name=paymentChoice]').forEach(input=>{input.disabled=!receipt?.token;input.checked=input.value===receipt?.choice;});if(receipt?.token){$('payment-registration-status').hidden=false;$('paymentChoiceStatus').textContent=receipt.choice?'Votre choix est enregistré. Vous pouvez le modifier.':'Choisissez votre mode de paiement.';}}
document.addEventListener('suzini:registered',event=>{setReceipt(event.detail);loadTeams();});
document.querySelectorAll('[name=paymentChoice]').forEach(input=>input.addEventListener('change',async()=>{if(!receipt?.token)return;const token=receipt.token,choice=input.value;document.querySelectorAll('[name=paymentChoice]').forEach(i=>i.disabled=true);$('paymentChoiceStatus').textContent='Enregistrement…';try{await rpc('suzini_e3_payment_choice',{p_token:token,p_choice:choice});if(receipt.token===token)setReceipt({...receipt,choice});if(choice==='online_now'){if(paymentUrl)location.assign(paymentUrl);else $('paymentChoiceStatus').textContent='Choix enregistré. Le lien de paiement sera disponible prochainement.';}if(choice==='cash')$('paymentChoiceStatus').textContent='Choix enregistré : règlement en espèces au club, le jour du tournoi.';}catch(error){renderReceipt();$('paymentChoiceStatus').textContent=error.message;}finally{document.querySelectorAll('[name=paymentChoice]').forEach(i=>i.disabled=!receipt?.token);}}));
renderReceipt();
const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
let teams=[],loading=false;
function renderTeams(){const rows=teams.filter(t=>t.division===$('paymentDivision').value);$('paymentTeams').replaceChildren();$('paymentListStatus').textContent=rows.length?`${rows.length} équipe(s) · Paiements validés par le club`:'Aucune équipe inscrite pour cette épreuve.';for(const team of rows){const count=Number(team.paid_players)||0,state=count===2?'paid':count===1?'partial':'unpaid',label=count===2?'Équipe payée · 20 €':count===1?'Un joueur payé · 10 €':'Paiement à recevoir · 20 €';const row=el('article','','payment-team'),details=el('div',''),badge=el('span','€','euro-dot '+state);details.append(el('h3',`${displayFirstName(team.player1)} / ${displayFirstName(team.player2)}`),el('p',displayPlayerName(team.p1_last_name,team.p1_first_name)),el('p',displayPlayerName(team.p2_last_name,team.p2_first_name)),el('small',label));badge.setAttribute('role','img');badge.setAttribute('aria-label',label);row.append(details,badge);$('paymentTeams').append(row);}}
async function loadTeams(){if(loading)return;loading=true;$('refreshPayments').disabled=true;try{teams=await rpc('suzini_e3_teams');renderTeams();}catch(error){$('paymentListStatus').textContent=error.message;}finally{loading=false;$('refreshPayments').disabled=false;}}
$('refreshPayments').addEventListener('click',loadTeams);$('paymentDivision').addEventListener('change',renderTeams);
document.getElementById('payment-tab').addEventListener('click',loadTeams);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)loadTeams();});
setInterval(()=>{if(!document.hidden&&!$('paiement-panel').hidden)loadTeams();},30000);
loadTeams();
