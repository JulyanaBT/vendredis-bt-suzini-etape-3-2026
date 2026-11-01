import {client} from './private-client.js?v=54';
const content=document.getElementById('adminContent');
const mount=document.createElement('details');mount.className='mail-payments';
const summary=document.createElement('summary');summary.textContent='Synchronisation des paiements SumUp';mount.append(summary);
(document.getElementById('club-payment-panel')||content).prepend(mount);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
const state=el('p','Chargement…'),notice=el('p','','mail-notice'),actions=el('div','','admin-tools'),sync=el('button','Synchroniser'),refresh=el('button','Actualiser le suivi'),pause=el('button','Suspendre');
for(const b of [sync,refresh,pause])b.type='button';actions.append(sync,refresh,pause);
const setup=el('form','','compact-signup mail-setup');setup.hidden=true;
setup.append(el('h3','Configurer la lecture des confirmations'));
const intro=el('p','Lecture de contact@julyanabt.fr dans Supabase, toutes les 5 minutes. Seules les nouvelles confirmations SumUp correspondant à l’article indiqué sont traitées. Aucun mail n’est supprimé ni marqué comme lu.');setup.append(intro);
const productLabel=el('label','Libellé exact de l’article SumUp'),product=el('input');product.name='product';product.type='text';product.required=true;product.maxLength=300;productLabel.append(product);
const passwordLabel=el('label','Mot de passe Infomaniak de l’appareil « Synchronisation paiements »'),password=el('input');password.name='password';password.type='password';password.autocomplete='new-password';password.required=true;password.minLength=8;passwordLabel.append(password);
const consentLabel=el('label','','mail-consent'),consent=el('input');consent.type='checkbox';consent.required=true;consentLabel.append(consent,document.createTextNode('J’autorise Supabase à utiliser ce mot de passe dédié pour lire les confirmations SumUp reçues sur contact@julyanabt.fr.'));
const save=el('button','Enregistrer et activer');save.type='submit';setup.append(productLabel,passwordLabel,consentLabel,save);
const list=el('div','','mail-order-list');mount.append(list,state,notice,actions);
const configBox=el('details','','mail-payments mail-configuration'),configTitle=el('summary','Configurer la lecture des confirmations');configBox.append(configTitle,setup);configBox.hidden=true;
const paymentPanel=document.getElementById('club-payment-panel')||content;paymentPanel.append(configBox);
new MutationObserver(()=>{if(paymentPanel.lastElementChild!==configBox)paymentPanel.append(configBox);}).observe(paymentPanel,{childList:true});
setup.querySelector('h3')?.remove();
let info=null,teams=[],busy=false;
async function rpc(action,data={}){const {data:result,error}=await client.rpc('suzini_e3_mail_manage',{p_action:action,p_data:data});if(error)throw error;return result;}
async function load(){if(content.hidden)return;try{info=await rpc('status');const {data,error}=await client.rpc('suzini_e3_club',{p_action:'list'});if(error)throw error;teams=data.teams||[];render();}catch{mount.classList.add('sync-action-required');mount.classList.remove('sync-ok');state.textContent='Suivi des mails indisponible. Actualisez ou reconnectez-vous.';}}
function render(){
 const pending=info.orders.filter(o=>o.state==='pending');summary.textContent=`Synchronisation SumUp · ${pending.length} à vérifier`;mount.classList.toggle('sync-action-required',!!info.last_error||pending.length>0||!info.configured);mount.classList.toggle('sync-ok',!info.last_error&&pending.length===0&&info.configured);
 state.textContent=!info.configured?'Connexion mail à configurer':!info.enabled?'Lecture suspendue':info.last_success?'Dernière lecture : '+new Date(info.last_success).toLocaleString('fr-FR'):'Lecture activée · première synchronisation en attente';
 notice.textContent=info.last_error||'';configBox.hidden=!info.is_admin;setup.hidden=!info.is_admin;sync.hidden=!info.is_admin;pause.hidden=!info.is_admin||!info.enabled;sync.disabled=!info.configured||!info.enabled;product.value=info.product||'';
 list.replaceChildren();list.append(el('h3','Confirmations à vérifier'));
 if(!pending.length)list.append(el('p','Aucune confirmation en attente.'));
 for(const order of pending){const card=el('article','','mail-order');card.append(el('h4','Commande #'+(order.order_number||'—')+' · '+(order.amount_cents==null?'Montant à vérifier':(order.amount_cents/100).toLocaleString('fr-FR')+' €')),el('p',order.buyer_name||'Client non identifié'),el('p',order.reason||'Vérification nécessaire'));
 const source=el('details'),sourceTitle=el('summary','Voir les informations du mail');source.append(sourceTitle,el('pre',order.details||''));card.append(source);
 const teamSelect=el('select');teamSelect.setAttribute('aria-label','Équipe pour la commande '+order.order_number);teamSelect.append(new Option('Choisir une équipe',''));
 for(const t of teams)teamSelect.append(new Option(`${t.division} · ${t.p1_last_name} ${t.p1_first_name} / ${t.p2_last_name} ${t.p2_first_name}`,t.id));
 const players=el('select');players.setAttribute('aria-label','Joueur payé');players.append(new Option('Choisir le bénéficiaire',''));
 teamSelect.addEventListener('change',()=>{players.replaceChildren(new Option('Choisir le bénéficiaire',''));const t=teams.find(t=>t.id===teamSelect.value);if(!t)return;if(order.amount_cents===2000)players.append(new Option('Les deux joueurs','both'));if(order.amount_cents===1000){players.append(new Option(t.p1_last_name+' '+t.p1_first_name,'1'),new Option(t.p2_last_name+' '+t.p2_first_name,'2'));}});
 const assign=el('button','Valider le paiement'),ignore=el('button','Écarter');assign.type=ignore.type='button';assign.disabled=![1000,2000].includes(order.amount_cents);
 assign.addEventListener('click',async()=>{if(!teamSelect.value||!players.value){notice.textContent='Choisissez l’équipe et le ou les joueurs payés.';return;}await mutate(assign,'assign',{id:order.id,team_id:teamSelect.value,players:players.value==='both'?[1,2]:[Number(players.value)]});});
 ignore.addEventListener('click',()=>mutate(ignore,'ignore',{id:order.id}));const controls=el('div','','mail-order-controls');controls.append(teamSelect,players,assign,ignore);card.append(controls);list.append(card);}
 const history=el('details');history.append(el('summary','Historique des confirmations traitées'));
 for(const order of info.orders.filter(o=>o.state!=='pending'))history.append(el('p',`#${order.order_number} · ${order.buyer_name||'Client'} · ${order.state==='matched'?'Attribué':'Écarté'} · ${order.reason||''}`));list.append(history);
}
async function mutate(button,action,data={}){if(busy)return;busy=true;button.disabled=true;notice.textContent='Enregistrement…';try{await rpc(action,data);notice.textContent='Modification enregistrée.';document.dispatchEvent(new CustomEvent('suzini:mail-updated'));await load();}catch(e){mount.classList.add('sync-action-required');mount.classList.remove('sync-ok');notice.textContent=e.message||'Modification impossible.';}finally{busy=false;button.disabled=false;}}
setup.addEventListener('submit',async e=>{e.preventDefault();if(!setup.reportValidity()||busy)return;await mutate(save,'configure',{product:product.value,password:password.value});password.value='';consent.checked=false;});
refresh.addEventListener('click',load);pause.addEventListener('click',()=>mutate(pause,'pause'));
sync.addEventListener('click',async()=>{if(busy)return;busy=true;sync.disabled=true;notice.textContent='Lecture des confirmations…';try{const {data:{session}}=await client.auth.getSession();if(!session)throw Error('Reconnectez-vous.');const response=await fetch('https://qbtjtdfpwkkgezpncdnf.supabase.co/functions/v1/suzini-e3-mail-sync',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(95000)});const result=await response.json();if(!response.ok)throw Error(result.error||'Synchronisation indisponible.');document.dispatchEvent(new CustomEvent('suzini:mail-updated'));await load();notice.textContent=result.busy?'Une lecture est déjà en cours.':result.ready?`${result.matched} attribué(s), ${result.pending} à vérifier, ${result.duplicate} déjà traité(s).`:'Connexion mail non configurée.';}catch(e){mount.classList.add('sync-action-required');mount.classList.remove('sync-ok');notice.textContent=e.message;}finally{busy=false;sync.disabled=false;}});
document.addEventListener('suzini:club-updated',load);new MutationObserver(()=>{if(content.hidden){password.value='';mount.open=false;}else load();}).observe(content,{attributes:true,attributeFilter:['hidden']});
load();

setInterval(()=>{if(!document.hidden&&!content.hidden&&!busy)load();},30000);
