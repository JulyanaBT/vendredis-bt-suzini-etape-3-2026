import {rpc as publicRpc} from './supabase-site.js?v=78';
import {hasRankingConflict,rankingCounts,createRankingDetails} from './ranking-info.js?v=54';
import {createTeamCard,rankTeams} from './team-cards.js?v=54';
if(location.hash.startsWith('#compte'))location.replace(new URL('compte.html',location.href));
import {client,signIn} from './private-client.js?v=54';
const $=id=>document.getElementById(id),login=$('adminLogin'),content=$('adminContent'),status=$('adminStatus');
let data={teams:[],labels:[],open:false},editId=null;
const rankFilter=new URLSearchParams(location.search).get('classement');if(['conflict','matched','unlisted','manual'].includes(rankFilter))$('rankState').value=rankFilter;
const teamsPage=location.pathname.endsWith('/equipes.html');if(teamsPage){try{$('division').value=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{$('division').value='DM';}$('division').closest('label').hidden=true;document.addEventListener('publicZoneChange',event=>{$('division').value=event.detail.epreuve;if(!content.hidden)render();});}

const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};

const isRegistrationPage=location.pathname.endsWith('/inscriptions.html');
let registrationTab='inscription';
if(isRegistrationPage){
 const tabs=el('nav','','signup-tabs');tabs.setAttribute('aria-label','Gestion des inscriptions');
 const panel=el('div','','club-registration-panel');panel.id='club-registration-panel';
 while(content.firstChild)panel.append(content.firstChild);
 const paymentPanel=el('section','');paymentPanel.id='club-payment-panel';paymentPanel.hidden=true;
 const partnerPanel=el('section','');partnerPanel.id='club-partner-panel';partnerPanel.hidden=true;
 for(const [value,label] of [['inscription','Inscriptions'],['paiement','Paiements'],['partenaire','Recherche partenaire']]){const b=el('button',label);b.type='button';b.dataset.clubRegistrationTab=value;b.setAttribute('aria-pressed',String(value===registrationTab));b.onclick=()=>selectRegistrationTab(value);tabs.append(b);}
 content.append(tabs,panel,paymentPanel,partnerPanel);
 $('reload').hidden=true;$('logout').hidden=true;
 paymentPanel.append($('adminCounts'));
 const filters=content.querySelector('.club-filters');if(filters){paymentPanel.append(filters);$('rankState').closest('label').hidden=true;}
 $('rankSummary').hidden=true;content.querySelector('.programme-manage-link')?.remove();
 const add=el('button','Inscrire une nouvelle équipe','signup-submit');add.id='quick-add-team';add.type='button';add.onclick=quickRegistration;panel.append(add);

}
function selectRegistrationTab(value){
 registrationTab=value;content.dataset.registrationTab=value;
 for(const b of content.querySelectorAll('[data-club-registration-tab]'))b.setAttribute('aria-pressed',String(b.dataset.clubRegistrationTab===value));
 for(const [id,v] of [['club-registration-panel','inscription'],['club-payment-panel','paiement'],['club-partner-panel','partenaire']])$(id).hidden=value!==v;
 const list=$('adminTeams');list.hidden=value!=='paiement';if(value==='paiement')$('club-payment-panel').append(list);else $('club-registration-panel').append(list);
 if(value==='partenaire')document.dispatchEvent(new CustomEvent('suzini:partners-tab'));
 render();
}
let openingBox=null;
if($('opening')){
 openingBox=el('div','','registration-toggle');
 const openButton=el('button','Ouvrir les inscriptions'),closeButton=el('button','Fermer les inscriptions'),stateLabel=el('p','');
 openButton.id='registrations-open';closeButton.id='registrations-close';stateLabel.id='registration-state-label';stateLabel.setAttribute('role','status');
 openButton.type=closeButton.type='button';openingBox.append(openButton,closeButton,stateLabel);$('opening').after(openingBox);
 openButton.onclick=async()=>{if(data.open)return;const closed=data.registration_state==='closed';if(closed){const accepted=await registrationDialog('Réouvrir les inscriptions ?',[['open','Confirmer la réouverture']]);if(!accepted)return;}await mutate(openButton,'opening',null,{state:'open',open:true,confirm_reopen:closed});};
 closeButton.onclick=async()=>{const choice=await registrationDialog('Fermer les inscriptions',[['suspended','Suspendre temporairement'],['closed','Clôturer les inscriptions']]);if(choice)await mutate(closeButton,'opening',null,{state:choice,open:false});};
}
function registrationDialog(title,options){return new Promise(resolve=>{const d=el('dialog','','registration-dialog'),h=el('h2',title),p=el('p',options.length===2?'Suspendre permet une reprise directe. Clôturer nécessite une confirmation pour réouvrir.':'Cette action permettra à nouveau de déposer des inscriptions.');d.append(h,p);let result=null;for(const [value,label] of options){const b=el('button',label);b.type='button';b.onclick=()=>{result=value;d.close();};d.append(b);}const cancel=el('button','Annuler');cancel.type='button';cancel.onclick=()=>d.close();d.append(cancel);d.onclose=()=>{d.remove();resolve(result);};document.body.append(d);d.showModal();});}

async function request(action='list',id=null,body={}){const {data:result,error}=await client.rpc('suzini_e3_club',{p_action:action,p_id:id,p_data:body});if(error)throw error;data=result;render();document.dispatchEvent(new CustomEvent('suzini:club-updated'));}
function render(){if(isRegistrationPage){$('adminTeams').hidden=registrationTab!=='paiement';$('rankSummary').hidden=true;$('quick-add-team').disabled=!data.open;$('quick-add-team').title=data.open?'Inscrire une équipe':'Ouvrez les inscriptions pour ajouter une équipe';}content.hidden=false;login.hidden=true;$('opening').textContent=data.open?'Fermer les inscriptions':'Ouvrir les inscriptions';$('opening').hidden=true;if(openingBox){openingBox.hidden=!data.is_admin;const state=data.registration_state||(!data.open?'suspended':'open');$('registrations-open').setAttribute('aria-pressed',String(data.open));$('registrations-close').setAttribute('aria-pressed',String(!data.open));$('registration-state-label').textContent=({open:'Inscriptions ouvertes',suspended:'Inscriptions suspendues',closed:'Inscriptions clôturées'})[state];}const counts=rankingCounts(data.teams);$('rankSummary').textContent=`${counts.matched} classement(s) reconnu(s) · ${counts.unlisted} absent(s) des fichiers · ${counts.conflict} incohérence(s) · ${counts.manual} manuel(s)`;$('rankSummary').classList.toggle('has-conflicts',counts.conflict>0);const paid=data.teams.reduce((n,t)=>n+Number(t.p1_paid)+Number(t.p2_paid),0);$('adminCounts').textContent=`${data.teams.length} équipe(s) · ${paid} joueur(s) payé(s) · ${paid*10} € reçus`;
 const q=$('search').value.trim().toLocaleLowerCase('fr');const rankState=$('rankState').value;const rows=rankTeams(data.teams).filter(t=>(!$('division').value||t.division===$('division').value)&&(!$('paid').value||($('paid').value==='partial'?(t.p1_paid!==t.p2_paid):t.payment_received===($('paid').value==='yes')))&&(!rankState||(rankState==='conflict'?hasRankingConflict(t):['p1','p2'].some(p=>t[p+'_rank_status']===rankState)))&&(!q||Object.values(t).join(' ').toLocaleLowerCase('fr').includes(q)));
 $('adminTeams').replaceChildren();if(!rows.length)$('adminTeams').append(el('p','Aucune équipe à afficher.'));
 for(const [index,team] of rows.entries()){const card=el('article','');card.className='club-team';card.dataset.paymentView=String(isRegistrationPage&&registrationTab==='paiement');const label=data.labels.find(t=>t.id===team.id);const teamCard=createTeamCard({...label,...team,team_name:label?.team_name||team.team_name},index+1),paidCount=Number(team.p1_paid)+Number(team.p2_paid),euro=el('span','€','euro-dot '+(paidCount===2?'paid':paidCount===1?'partial':'unpaid'));euro.setAttribute('role','img');euro.setAttribute('aria-label',paidCount===2?'Équipe payée':paidCount===1?'Un joueur payé':'Paiement à recevoir');teamCard.append(euro);card.append(teamCard);const details=el('details','');details.className='club-licences';details.append(el('summary','Licences FFT'),el('p',`${team.p1_first_name} : ${team.p1_licence} · ${team.p2_first_name} : ${team.p2_licence}`));if(!isRegistrationPage||registrationTab!=='paiement')card.append(details,createRankingDetails(team,showManualRank));
 const payment=el('div','');payment.className='player-payments';for(const n of [1,2]){const paid=!!team['p'+n+'_paid'],b=el('button',`${team['p'+n+'_first_name']} · ${paid?'Reçu':'À recevoir'} · 10 €`);b.type='button';b.setAttribute('aria-pressed',String(paid));b.className=paid?'payment-received':'';b.addEventListener('click',()=>mutate(b,'payment',team.id,{player:n,paid:!paid}));payment.append(b);}const choice=el('small',({online_now:'En ligne maintenant',online_later:'En ligne plus tard',cash:'Espèces sur place'})[team.payment_choice]||'Mode de paiement non précisé');payment.append(choice);const edit=el('button','Modifier');edit.type='button';edit.addEventListener('click',()=>showEdit(team));const tools=el('div','');tools.className='admin-tools';if(!isRegistrationPage||registrationTab==='paiement')tools.append(payment);if(!isRegistrationPage||registrationTab==='inscription')tools.append(edit);card.append(tools);$('adminTeams').append(card);}}
async function mutate(button,action,id,body){button.disabled=true;status.textContent='Enregistrement…';try{await request(action,id,body);status.textContent='Modification enregistrée.';}catch(e){status.textContent=e.code==='42501'?'Accès Club non attribué pour cette étape.':e.message;}finally{button.disabled=false;}}
function showEdit(t){editId=t.id;$('editFields').replaceChildren(createRankingDetails(t,showManualRank));$('editForm').elements.division.value=t.division;for(const p of ['p1','p2']){const fieldset=el('fieldset','');fieldset.append(el('legend',p==='p1'?'Joueur / Joueuse 1':'Joueur / Joueuse 2'));for(const [key,title,type] of [['first_name','Prénom','text'],['last_name','Nom','text'],['licence','Licence FFT','text'],['rank','Classement individuel','number']]){const label=el('label',title),input=document.createElement('input');input.name=p+'_'+key;input.value=t[input.name]??'';input.required=key!=='rank';input.type=type;if(key==='rank'){input.readOnly=true;input.setAttribute('aria-readonly','true');input.title='Calcul automatique à partir de la licence et du nom';input.min='1';input.max='10000000';input.step='1';input.placeholder='Non renseigné';}input.maxLength=key==='phone'?24:key==='licence'?8:60;if(key==='licence')input.pattern='[0-9]{7}[A-Za-z]';label.append(input);fieldset.append(label);}$('editFields').append(fieldset);}$('editStatus').textContent='';$('editTeam').showModal();}
$('editForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{await request('edit',editId,Object.fromEntries(new FormData(e.target)));document.dispatchEvent(new CustomEvent('suzini:form-saved',{detail:{form:e.target}}));$('editTeam').close();status.textContent='Inscription modifiée. Classements recalculés.';}catch(err){$('editStatus').textContent=err.message;}finally{b.disabled=false;}});$('cancelEdit').onclick=()=>{$('editForm').reset();$('editTeam').close();};
for(const id of ['division','search','paid','rankState'])$(id).addEventListener('input',render);
$('opening').onclick=()=>mutate($('opening'),'opening',null,{open:!data.open});$('reload').onclick=()=>mutate($('reload'),'list',null,{});
$('logout').onclick=async()=>{await client.auth.signOut();data={teams:[],labels:[],open:false};$('adminTeams').replaceChildren();content.hidden=true;login.hidden=false;status.textContent='Déconnecté.';};
login.addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;status.textContent='Connexion…';const fields=new FormData(login);try{await signIn(fields.get('email'),fields.get('password'));login.reset();await request();status.textContent='';}catch{status.textContent='Connexion ou accès refusé. Vérifiez votre compte Club.';}finally{b.disabled=false;}});
try{const {data:{session}}=await client.auth.getSession();if(session)await request();}catch{content.hidden=true;login.hidden=false;status.textContent='Accès Club non attribué pour cette étape.';}

function showManualRank(team,player){
 if($('editTeam').open)$('editTeam').close();
 const p=player===1?'p1':'p2',manual=team[p+'_rank_status']==='manual';
 const dialog=document.createElement('dialog');dialog.className='manual-rank-dialog';
 const form=el('form',''),title=el('h2','Classement manuel'),name=el('p',`${team[p+'_first_name']} ${team[p+'_last_name']}`),label=el('label','Classement individuel');
 const input=document.createElement('input');input.type='number';input.name='manualRank';input.min='1';input.max='10000000';input.step='1';input.required=true;input.inputMode='numeric';input.value=manual?team[p+'_rank']:'';label.append(input);
 const note=el('p','Cette valeur remplacera le calcul automatique pour ce joueur. L’incohérence restera consultable dans sa fiche.','rank-auto-help'),message=el('p','');message.setAttribute('role','status');
 const actions=el('div','','club-edit-actions'),save=el('button','Enregistrer','signup-submit'),cancel=el('button','Annuler');save.type='submit';cancel.type='button';cancel.onclick=()=>dialog.close();actions.append(save,cancel);form.append(title,name,label,note,message,actions);
 if(manual){const reset=el('button','Revenir au calcul automatique','manual-rank-reset');reset.type='button';reset.onclick=()=>apply(null);form.append(reset);}
 async function apply(value){form.querySelectorAll('button').forEach(b=>b.disabled=true);try{const {data:result,error}=await client.rpc('suzini_e3_manual_rank',{p_id:team.id,p_player:player,p_rank:value});if(error)throw error;data=result;render();document.dispatchEvent(new CustomEvent('suzini:club-updated'));dialog.close();status.textContent=value===null?'Calcul automatique rétabli.':'Classement manuel enregistré.';}catch(error){message.textContent=error.message;}finally{form.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 form.onsubmit=event=>{event.preventDefault();if(form.reportValidity())apply(Number(input.value));};dialog.addEventListener('close',()=>form.reset());dialog.append(form);document.body.append(dialog);dialog.onclose=()=>dialog.remove();dialog.showModal();input.focus();
}

document.addEventListener('suzini:mail-updated',()=>request().catch(()=>{}));

function quickRegistration(){
 if(!data.open)return;
 const dialog=document.createElement('dialog');dialog.className='quick-registration-dialog';dialog.setAttribute('aria-labelledby','quick-registration-title');
 const title=el('h2','Inscrire une nouvelle équipe');title.id='quick-registration-title';
 const close=el('button','Fermer','quick-close');close.type='button';close.onclick=()=>dialog.close();
 const wrapper=el('div','');wrapper.innerHTML="<form id=\"clubQuickForm\" class=\"compact-signup\" autocomplete=\"on\"><fieldset class=\"division-field\"><legend>Épreuve · 8 équipes maximum par tableau</legend><div class=\"division-choices\"><label><input id=\"catDM\" name=\"epreuve\" type=\"radio\" value=\"DM\" required> Double hommes</label><label><input id=\"catDD\" name=\"epreuve\" type=\"radio\" value=\"DD\" required> Double dames</label></div></fieldset><fieldset class=\"player-fields\"><legend>Joueur / Joueuse 1</legend><div class=\"player-grid\"><div class=\"field\"><label for=\"p1LastName\">Nom</label><input id=\"p1LastName\" name=\"p1LastName\" type=\"text\" required placeholder=\"Nom\" autocomplete=\"section-player1 family-name\"></div><div class=\"field\"><label for=\"p1FirstName\">Prénom</label><input id=\"p1FirstName\" name=\"p1FirstName\" type=\"text\" required placeholder=\"Prénom\" autocomplete=\"section-player1 given-name\"></div><div class=\"field\"><label for=\"p1Licence\">Licence FFT</label><input id=\"p1Licence\" name=\"p1Licence\" type=\"text\" required placeholder=\"0123456A\" autocomplete=\"section-player1 off\" autocapitalize=\"characters\"></div></div></fieldset><fieldset class=\"player-fields\"><legend>Joueur / Joueuse 2</legend><div class=\"player-grid\"><div class=\"field\"><label for=\"p2LastName\">Nom</label><input id=\"p2LastName\" name=\"p2LastName\" type=\"text\" required placeholder=\"Nom\" autocomplete=\"section-player2 family-name\"></div><div class=\"field\"><label for=\"p2FirstName\">Prénom</label><input id=\"p2FirstName\" name=\"p2FirstName\" type=\"text\" required placeholder=\"Prénom\" autocomplete=\"section-player2 given-name\"></div><div class=\"field\"><label for=\"p2Licence\">Licence FFT</label><input id=\"p2Licence\" name=\"p2Licence\" type=\"text\" required placeholder=\"0123456A\" autocomplete=\"section-player2 off\" autocapitalize=\"characters\"></div></div></fieldset><button id=\"quickSubmit\" class=\"signup-submit\" type=\"submit\">Inscrire l’équipe</button><p id=\"quickStatus\" class=\"signup-status\" role=\"status\" aria-live=\"polite\">10 € par joueur · 20 € par équipe.</p></form>";dialog.append(title,close,wrapper);document.body.append(dialog);
 const form=dialog.querySelector('form'),submit=dialog.querySelector('#quickSubmit'),msg=dialog.querySelector('#quickStatus');
 for(const input of form.querySelectorAll('input[name$="Licence"]')){input.maxLength=8;input.pattern='[0-9]{7}[A-Za-z]';}
 for(const input of form.querySelectorAll('input[name$="Name"]'))input.maxLength=60;
 form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;submit.disabled=true;form.dataset.submitting='true';msg.textContent='Inscription…';try{await publicRpc('suzini_e3_register_payment',{p_team:Object.fromEntries(new FormData(form))});form.reset();await request();dialog.close();status.textContent='Nouvelle équipe inscrite. Retrouvez-la dans Équipes et Paiements.';}catch(error){msg.textContent=error.message;}finally{delete form.dataset.submitting;submit.disabled=false;}};
 dialog.onclose=()=>{form.reset();dialog.remove();};dialog.showModal();
}
