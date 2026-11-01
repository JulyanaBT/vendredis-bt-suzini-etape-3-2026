import {rpc as publicRpc} from './supabase-site.js?v=92';
import {readRankingPdf} from './ranking-pdf.js?v=92';
import {hasRankingConflict,rankingCounts,createRankingDetails} from './ranking-info.js?v=92';
import {createTeamCard,rankTeams,displayPlayerName} from './team-cards.js?v=92';
if(location.hash.startsWith('#compte'))location.replace(new URL('compte.html',location.href));
import {client,signIn} from './private-client.js?v=92';
const $=id=>document.getElementById(id),login=$('adminLogin'),content=$('adminContent'),status=$('adminStatus');
let data={teams:[],labels:[],open:false},editId=null,editingTeam=null;
const rankFilter=new URLSearchParams(location.search).get('classement');if(['conflict','matched','unlisted','manual'].includes(rankFilter))$('rankState').value=rankFilter;
const teamsPage=location.pathname.endsWith('/equipes.html');if(teamsPage){try{$('division').value=localStorage.getItem('suzini_etape3_public_epreuve')||'DM';}catch{$('division').value='DM';}$('division').closest('label').hidden=true;document.addEventListener('publicZoneChange',event=>{$('division').value=event.detail.epreuve;if(!content.hidden)render();});}

const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};

const isRegistrationPage=location.pathname.endsWith('/inscriptions.html');
let registrationTab=new URLSearchParams(location.search).get('tab')||'inscription';if(!['inscription','paiement','partenaire'].includes(registrationTab))registrationTab='inscription';
if(isRegistrationPage){
 const tabs=el('nav','','signup-tabs');tabs.setAttribute('aria-label','Gestion des inscriptions');
 const panel=el('div','','club-registration-panel');panel.id='club-registration-panel';
 while(content.firstChild)panel.append(content.firstChild);
 const paymentPanel=el('section','');paymentPanel.id='club-payment-panel';paymentPanel.hidden=true;
 const partnerPanel=el('section','');partnerPanel.id='club-partner-panel';partnerPanel.hidden=true;
 for(const [value,label] of [['inscription','Inscription'],['paiement','Paiement'],['partenaire','Solo']]){const b=el('button',label);b.type='button';b.dataset.clubRegistrationTab=value;b.setAttribute('aria-pressed',String(value===registrationTab));b.onclick=()=>selectRegistrationTab(value);tabs.append(b);}
 content.append(tabs,panel,paymentPanel,partnerPanel);
 $('reload').hidden=true;$('logout').hidden=true;
 paymentPanel.append($('adminCounts'));
 const filters=content.querySelector('.club-filters');if(filters){paymentPanel.append(filters);$('rankState').closest('label').hidden=true;$('division').closest('label').hidden=true;$('paid').closest('label').hidden=true;$('division').value='';$('paid').value='';}
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
if($('opening')&&!teamsPage){
 openingBox=el('div','','registration-toggle');
 const openButton=el('button','Ouvrir les inscriptions'),closeButton=el('button','Fermer les inscriptions'),stateLabel=el('p','');
 openButton.id='registrations-open';closeButton.id='registrations-close';stateLabel.id='registration-state-label';stateLabel.setAttribute('role','status');
 openButton.type=closeButton.type='button';openingBox.append(openButton,closeButton,stateLabel);$('opening').after(openingBox);
 openButton.onclick=async()=>{if(data.open)return;const closed=data.registration_state==='closed';if(closed){const accepted=await registrationDialog('Réouvrir les inscriptions ?',[['open','Confirmer la réouverture']]);if(!accepted)return;}await mutate(openButton,'opening',null,{state:'open',open:true,confirm_reopen:closed});};
 closeButton.onclick=async()=>{const choice=await registrationDialog('Fermer les inscriptions',[['suspended','Suspendre temporairement'],['closed','Clôturer les inscriptions']]);if(choice)await mutate(closeButton,'opening',null,{state:choice,open:false});};
}

let rankingSync=null,rankingSyncSummary=null,rankingSyncBody=null;
if(teamsPage){
 for(const id of ['reload','logout'])$(id).hidden=true;
 for(const id of ['search','paid','rankState'])$(id).closest('label').hidden=true;
 $('paid').value='';$('rankState').value='';$('search').value='';
 $('rankSummary').hidden=true;
 rankingSync=el('details','','ranking-sync');rankingSyncSummary=el('summary','Synchronisation classement');rankingSyncBody=el('div','','ranking-sync-body');rankingSync.append(rankingSyncSummary,rankingSyncBody);$('adminTeams').before(rankingSync);
}
function renderRankingSync(){
 if(!rankingSync)return;
 const needs=t=>['p1','p2'].some(p=>t[p+'_rank_status']==='conflict'||t[p+'_rank_status']==='pending'||!Number.isInteger(t[p+'_rank'])||t[p+'_rank']<1);
 const rows=data.teams.filter(t=>(!$('division').value||t.division===$('division').value));
 const issues=rows.filter(needs),wasOpen=rankingSync.open;
 rankingSync.classList.toggle('needs-action',issues.length>0);rankingSync.classList.toggle('all-ok',!issues.length);
 rankingSyncSummary.textContent='Synchronisation classement · '+(issues.length?issues.length+' équipe(s) à vérifier':'Tout est OK');
 rankingSyncBody.replaceChildren();
 if(!issues.length)rankingSyncBody.append(el('p','Tous les classements de ce tableau sont reconnus ou validés.'));
 for(const team of issues){
 const card=el('article','','ranking-sync-team');card.append(el('h3',team.p1_first_name+' / '+team.p2_first_name),createRankingDetails(team,showManualRank));
 const fix=el('button','Corriger le nom ou la licence');fix.type='button';fix.onclick=()=>showEdit(team);card.append(fix);
 for(const n of [1,2]){const p='p'+n;if(team[p+'_rank_status']==='pending'||!Number.isInteger(team[p+'_rank'])&&team[p+'_rank_status']!=='conflict'){const b=el('button','Saisir le classement de '+team[p+'_first_name']);b.type='button';b.onclick=()=>showManualRank(team,n);card.append(b);}}
 rankingSyncBody.append(card);
 }
 rankingSync.open=wasOpen;
}

function registrationDialog(title,options){return new Promise(resolve=>{const d=el('dialog','','registration-dialog'),h=el('h2',title),p=el('p',options.length===2?'Suspendre permet une reprise directe. Clôturer nécessite une confirmation pour réouvrir.':'Cette action permettra à nouveau de déposer des inscriptions.');d.append(h,p);let result=null;for(const [value,label] of options){const b=el('button',label);b.type='button';b.onclick=()=>{result=value;d.close();};d.append(b);}const cancel=el('button','Annuler');cancel.type='button';cancel.onclick=()=>d.close();d.append(cancel);d.onclose=()=>{d.remove();resolve(result);};document.body.append(d);d.showModal();});}


let licenceSync=null,licenceSummary=null,licenceBody=null;
if(teamsPage){
 licenceSync=el('details','','ranking-sync licence-sync');licenceSummary=el('summary','Vérification des licences');licenceBody=el('div','','ranking-sync-body');licenceSync.append(licenceSummary,licenceBody);rankingSync.after(licenceSync);
 const box=el('details','','ranking-sync ranking-import'),title=el('summary','Importer de nouveaux classements PDF'),form=el('form','','compact-signup');
 box.append(title,form);licenceSync.after(box);
 const note=el('p','Chargez le classement FFT complet dames et/ou messieurs. L’import relance tous les contrôles et remplace les classements manuels. Les licences saisies ne sont pas corrigées sans votre validation.');form.append(note);
 const monthLabel=el('label','Mois des classements','field'),month=el('input');month.type='month';month.required=true;month.value=new Date().toLocaleDateString('sv-SE',{timeZone:'America/Cayenne'}).slice(0,7);monthLabel.append(month);form.append(monthLabel);
 const inputs={};
 for(const [division,label] of [['DD','PDF dames'],['DM','PDF messieurs']]){const field=el('label',label,'field'),input=el('input');input.type='file';input.accept='.pdf,application/pdf';inputs[division]=input;field.append(input);form.append(field);}
 const analyze=el('button','Analyser les PDF','signup-submit'),apply=el('button','Importer et revérifier toutes les équipes','signup-submit'),message=el('p',''),preview=el('div','','ranking-import-preview');analyze.type='submit';apply.type='button';apply.hidden=true;message.setAttribute('role','status');form.append(analyze,preview,apply,message);let sources=null;
 for(const input of [...Object.values(inputs),month])input.addEventListener('change',()=>{sources=null;apply.hidden=true;preview.replaceChildren();});
 form.onsubmit=async event=>{event.preventDefault();if(!form.reportValidity())return;const chosen=Object.entries(inputs).filter(([,i])=>i.files?.length);if(!chosen.length){message.textContent='Choisissez au moins un PDF.';return;}analyze.disabled=true;apply.hidden=true;sources=null;preview.replaceChildren();try{
 const next=[];for(const [division,input] of chosen){message.textContent='Lecture '+input.files[0].name+'…';next.push(await readRankingPdf(input.files[0],division,month.value,(p,n)=>{message.textContent=(division==='DD'?'Dames':'Messieurs')+' : page '+p+' / '+n;}));}
 sources=next;for(const s of sources)preview.append(el('p',(s.division==='DD'?'Dames':'Messieurs')+' · '+s.rows.length+' joueurs · '+s.pages+' pages · dernier rang '+Math.max(...s.rows.map(r=>r.rank))));
 message.textContent='Vérifiez les fichiers et le mois, puis confirmez l’import.';apply.hidden=false;
 }catch(error){message.textContent=error.message||'Lecture impossible. Aucun classement remplacé.';}finally{analyze.disabled=false;}};
 apply.onclick=async()=>{if(!sources)return;if(!await askClubConfirmation('Importer ces classements ?','Tous les classements seront recalculés. Les validations manuelles de classement et de licence seront revérifiées.','Confirmer l’import'))return;apply.disabled=true;form.dataset.submitting='true';message.textContent='Import et vérification…';try{
 const {data:result,error}=await client.rpc('suzini_e3_import_rankings',{p_sources:sources});if(error)throw error;data=result;render();document.dispatchEvent(new CustomEvent('suzini:club-updated'));message.textContent='Import terminé : tous les classements et licences ont été revérifiés.';form.reset();sources=null;apply.hidden=true;preview.replaceChildren();
 }catch(error){message.textContent=error.message;}finally{delete form.dataset.submitting;apply.disabled=false;}};
}
function renderLicenceSync(){
 if(!licenceSync)return;
 const rows=data.teams.filter(t=>!$('division').value||t.division===$('division').value),issues=[];
 for(const team of rows)for(const n of [1,2])if(!['verified','manual'].includes(team['p'+n+'_licence_status']))issues.push({team,n});
 licenceSync.classList.toggle('needs-action',issues.length>0);licenceSync.classList.toggle('all-ok',!issues.length);
 licenceSummary.textContent='Vérification des licences · '+(issues.length?issues.length+' à vérifier':'Tout est OK');licenceBody.replaceChildren();
 licenceBody.append(el('p','Comparaison des chiffres uniquement : la lettre finale et les zéros initiaux ne changent pas la correspondance.'));
 if(!issues.length)licenceBody.append(el('p','Toutes les licences de ce tableau sont reconnues ou validées manuellement.'));
 for(const {team,n} of issues){const p='p'+n,section=el('article','','ranking-sync-team'),issue=team[p+'_licence_issue'];section.append(el('h3',team[p+'_first_name']+' '+team[p+'_last_name']),el('p','Licence saisie : '+team[p+'_licence']),el('p',issue?.message||'Cette personne est absente du classement de référence. Contrôle manuel nécessaire.'));
 for(const match of issue?.matches||[])section.append(el('p','Fichier : '+match.first_name+' '+match.last_name+' · licence '+match.licence+' · '+(match.division==='DD'?'dames':'messieurs')));
 const edit=el('button','Corriger les informations'),validate=el('button','Valider après contrôle');edit.type=validate.type='button';edit.onclick=()=>showEdit(team);
 validate.onclick=async()=>{if(await askClubConfirmation('Valider cette licence ?',team[p+'_first_name']+' '+team[p+'_last_name']+' · '+team[p+'_licence']+' : confirmez avoir vérifié cette licence.','Confirmer le contrôle'))await mutate(validate,'validate_licence',team.id,{player:n,confirm:true});};
 section.append(edit,validate);licenceBody.append(section);}
}
function askClubConfirmation(title,text,label){return new Promise(resolve=>{
 const d=el('dialog','','registration-dialog'),h=el('h2',title),message=el('p',text),confirm=el('button',label),cancel=el('button','Annuler');let value=false;confirm.type=cancel.type='button';confirm.onclick=()=>{value=true;d.close();};cancel.onclick=()=>d.close();d.append(h,message,confirm,cancel);document.body.append(d);d.onclose=()=>{d.remove();resolve(value);};d.showModal();
});}

async function request(action='list',id=null,body={}){const {data:result,error}=await client.rpc('suzini_e3_club',{p_action:action,p_id:id,p_data:body});if(error)throw error;data=result;if(isRegistrationPage)selectRegistrationTab(registrationTab);else render();document.dispatchEvent(new CustomEvent('suzini:club-updated'));}
function render(){if(teamsPage){$('reload').hidden=true;$('logout').hidden=true;$('rankSummary').hidden=true;renderRankingSync();renderLicenceSync();}if(isRegistrationPage){$('adminTeams').hidden=registrationTab!=='paiement';$('rankSummary').hidden=true;$('quick-add-team').disabled=!data.open;$('quick-add-team').title=data.open?'Inscrire une équipe':'Ouvrez les inscriptions pour ajouter une équipe';}content.hidden=false;login.hidden=true;$('opening').textContent=data.open?'Fermer les inscriptions':'Ouvrir les inscriptions';$('opening').hidden=true;if(openingBox){openingBox.hidden=!data.is_admin;const state=data.registration_state||(!data.open?'suspended':'open');$('registrations-open').setAttribute('aria-pressed',String(data.open));$('registrations-close').setAttribute('aria-pressed',String(!data.open));$('registration-state-label').textContent=({open:'Inscriptions ouvertes',suspended:'Inscriptions suspendues',closed:'Inscriptions clôturées'})[state];}const counts=rankingCounts(data.teams);$('rankSummary').textContent=`${counts.matched} classement(s) reconnu(s) · ${counts.unlisted} absent(s) des fichiers · ${counts.conflict} incohérence(s) · ${counts.manual} manuel(s)`;$('rankSummary').classList.toggle('has-conflicts',counts.conflict>0);const paid=data.teams.reduce((n,t)=>n+Number(t.p1_paid)+Number(t.p2_paid),0);$('adminCounts').textContent=`${data.teams.length} équipe(s) · ${paid} joueur(s) payé(s) · ${paid*10} € reçus`;
 if(teamsPage)$('adminCounts').textContent=data.teams.filter(t=>!$('division').value||t.division===$('division').value).length+' équipe(s) inscrite(s)';
 const q=$('search').value.trim().toLocaleLowerCase('fr');const rankState=$('rankState').value;let rows=rankTeams(data.teams).filter(t=>(!$('division').value||t.division===$('division').value)&&(!$('paid').value||($('paid').value==='partial'?(t.p1_paid!==t.p2_paid):t.payment_received===($('paid').value==='yes')))&&(!rankState||(rankState==='conflict'?hasRankingConflict(t):['p1','p2'].some(p=>t[p+'_rank_status']===rankState)))&&(!q||Object.values(t).join(' ').toLocaleLowerCase('fr').includes(q)));
 if(isRegistrationPage&&registrationTab==='paiement')rows.sort((a,b)=>(Number(a.p1_paid)+Number(a.p2_paid))-(Number(b.p1_paid)+Number(b.p2_paid))||((a.p1_first_name||'')+' / '+(a.p2_first_name||'')).localeCompare((b.p1_first_name||'')+' / '+(b.p2_first_name||''),'fr',{sensitivity:'base'}));
 $('adminTeams').replaceChildren();if(!rows.length)$('adminTeams').append(el('p','Aucune équipe à afficher.'));
 for(const [index,team] of rows.entries()){if(isRegistrationPage&&registrationTab==='paiement'){$('adminTeams').append(paymentCard(team));continue;}const card=el('article','');card.className='club-team';card.dataset.paymentView=String(isRegistrationPage&&registrationTab==='paiement');const label=data.labels.find(t=>t.id===team.id);const teamCard=createTeamCard({...label,...team,team_name:label?.team_name||team.team_name},index+1),paidCount=Number(team.p1_paid)+Number(team.p2_paid),euro=el('span','€','euro-dot '+(paidCount===2?'paid':paidCount===1?'partial':'unpaid'));euro.setAttribute('role','img');euro.setAttribute('aria-label',paidCount===2?'Équipe payée':paidCount===1?'Un joueur payé':'Paiement à recevoir');if(!teamsPage)teamCard.append(euro);card.append(teamCard);const details=el('details','');details.className='club-licences';details.append(el('summary','Licences FFT'),el('p',`${team.p1_first_name} : ${team.p1_licence} · ${team.p2_first_name} : ${team.p2_licence}`));if(teamsPage){for(const [i,line] of [...teamCard.querySelectorAll('.team-player')].entries()){const p='p'+(i+1),ok=['verified','manual'].includes(team[p+'_licence_status']),licence=el('small','Licence FFT : '+team[p+'_licence']+' ','team-license'),mark=el('span',ok?'✓':'✕','licence-mark');mark.style.color=ok?'#147a3f':'#bd2424';mark.style.fontWeight='900';mark.setAttribute('role','img');mark.setAttribute('aria-label',ok?'Licence vérifiée ou validée manuellement':'Licence à vérifier');mark.title=ok?'Licence OK':'Licence à vérifier';licence.append(mark);line.after(licence);}}else if(!isRegistrationPage||registrationTab!=='paiement')card.append(details,createRankingDetails(team,showManualRank));
 const payment=el('div','');payment.className='player-payments';for(const n of [1,2]){const paid=!!team['p'+n+'_paid'],b=el('button',`${team['p'+n+'_first_name']} · ${paid?'Reçu':'À recevoir'} · 10 €`);b.type='button';b.setAttribute('aria-pressed',String(paid));b.className=paid?'payment-received':'';b.addEventListener('click',()=>mutate(b,'payment',team.id,{player:n,paid:!paid}));payment.append(b);}const choice=el('small',({online_now:'En ligne maintenant',online_later:'En ligne plus tard',cash:'Espèces sur place'})[team.payment_choice]||'Mode de paiement non précisé');payment.append(choice);const edit=el('button','Modifier');edit.type='button';edit.addEventListener('click',()=>showEdit(team));const tools=el('div','');tools.className='admin-tools';if(!teamsPage&&(!isRegistrationPage||registrationTab==='paiement'))tools.append(payment);if(!isRegistrationPage||registrationTab==='inscription')tools.append(edit);if(teamsPage){const remove=el('button','Supprimer');remove.type='button';remove.onclick=async()=>{if(await askClubConfirmation('Supprimer cette équipe ?',team.p1_first_name+' / '+team.p2_first_name+' sera retirée du tournoi. Les règlements restent dans l’historique.','Confirmer la suppression'))await mutate(remove,'remove',team.id,{confirm:true});};tools.append(remove);}card.append(tools);$('adminTeams').append(card);}}
async function mutate(button,action,id,body){button.disabled=true;status.textContent='Enregistrement…';try{await request(action,id,body);status.textContent='Modification enregistrée.';}catch(e){status.textContent=e.code==='42501'?'Accès Club non attribué pour cette étape.':e.message;}finally{button.disabled=false;}}
function showEdit(t){editId=t.id;editingTeam=t;$('editFields').replaceChildren(createRankingDetails(t,showManualRank));$('editForm').elements.division.value=t.division;for(const p of ['p1','p2']){const fieldset=el('fieldset','');fieldset.append(el('legend',p==='p1'?'Joueur / Joueuse 1':'Joueur / Joueuse 2'));for(const [key,title,type] of [['first_name','Prénom','text'],['last_name','Nom','text'],['licence','Licence FFT','text'],['rank','Classement individuel','number']]){const label=el('label',title),input=document.createElement('input');input.name=p+'_'+key;input.value=t[input.name]??'';input.required=key!=='rank';input.type=type;if(key==='rank'){input.readOnly=false;input.title='Classement modifiable manuellement ; vide pour le calcul automatique';input.min='1';input.max='10000000';input.step='1';input.placeholder='Non renseigné';}input.maxLength=key==='phone'?24:key==='licence'?8:60;if(key==='licence')input.pattern='[0-9]{1,7}[A-Za-z]?';label.append(input);fieldset.append(label);}$('editFields').append(fieldset);}$('editStatus').textContent='';$('editTeam').showModal();}
$('editForm').addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const values=Object.fromEntries(new FormData(e.target));for(const p of ['p1','p2'])if(editingTeam?.[p+'_rank_status']!=='manual'&&String(editingTeam?.[p+'_rank']??'')===values[p+'_rank'])delete values[p+'_rank'];await request('edit',editId,values);document.dispatchEvent(new CustomEvent('suzini:form-saved',{detail:{form:e.target}}));$('editTeam').close();status.textContent='Équipe modifiée. Licences et classements revérifiés.';}catch(err){$('editStatus').textContent=err.message;}finally{b.disabled=false;}});$('cancelEdit').onclick=()=>{$('editForm').reset();$('editTeam').close();};
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

function paymentCard(team){
 const card=el('article','','club-payment-card'),head=el('div','','club-payment-line club-payment-heading');
 const count=Number(team.p1_paid)+Number(team.p2_paid);
 head.append(el('strong',data.labels.find(t=>t.id===team.id)?.team_name||team.team_name||team.p1_first_name+' / '+team.p2_first_name),el('span','€','euro-dot team-euro '+(count===2?'paid':count===1?'partial':'unpaid')));
 head.lastChild.setAttribute('aria-label',count===2?'Équipe payée':count===1?'Équipe partiellement payée':'Équipe non payée');card.append(head);
 for(const n of [1,2]){
 const paid=!!team['p'+n+'_paid'],method=team['p'+n+'_method'],row=el('div','','club-payment-line'),name=el('span',displayPlayerName(team['p'+n+'_last_name'],team['p'+n+'_first_name']),'club-payment-name'),modes=el('div','','club-payment-methods');
 for(const [value,label] of [['card','CB'],['cash','Espèces']]){const b=el('button',label);b.type='button';b.setAttribute('aria-pressed',String(paid&&method===value));b.title='Valider le paiement de '+team['p'+n+'_first_name']+' en '+label;b.onclick=()=>mutate(b,'payment',team.id,{player:n,paid:true,method:value});modes.append(b);}
 const euro=el('button','€','euro-dot individual-euro '+(paid?'paid':'unpaid'));euro.type='button';euro.setAttribute('aria-label',team['p'+n+'_first_name']+(paid?' : payé, annuler le règlement':' : non payé, valider le règlement'));euro.onclick=()=>mutate(euro,'payment',team.id,{player:n,paid:!paid});row.append(name,modes,euro);card.append(row);
 }return card;
}
