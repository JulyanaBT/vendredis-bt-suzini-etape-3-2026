import {client,withDeadline} from './private-client.js?v=94';
const make=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr');
export function receptionRows(players,query=''){
 const terms=fold(query).trim().split(/\s+/).filter(Boolean);
 return [...players].filter(p=>terms.every(t=>fold([p.first_name,p.last_name,p.licence,p.team_name].join(' ')).includes(t)))
 .sort((a,b)=>a.first_name.localeCompare(b.first_name,'fr',{sensitivity:'base'})||a.last_name.localeCompare(b.last_name,'fr',{sensitivity:'base'}));
}
export function createReception(){
 const element=make('section','','reception-panel');element.id='club-reception-panel';element.hidden=true;
 const intro=make('p','Contrôlez chaque joueur, puis validez son passage. Le paiement reste géré dans Paiement.','reception-intro');
 const label=make('label','Rechercher un joueur','reception-search'),search=make('input');search.type='search';search.placeholder='Prénom, nom, licence…';search.autocomplete='off';label.append(search);
 const status=make('p','','reception-status');status.setAttribute('role','status');
 const lists=make('div','','reception-lists');element.append(intro,label,status,lists);
 let players=[],busy=false,writing=false,loadedAt=0,epoch=0,authenticated=true;
 function draw(){
 lists.replaceChildren();const rows=receptionRows(players,search.value);
 for(const checked of [false,true]){
 const box=make('section','',checked?'reception-group reception-done':'reception-group reception-pending'),items=rows.filter(p=>!!p.checked_at===checked);
 const h=make('h2',(checked?'Vérification effectuée':'À vérifier')+' · '+items.length);box.append(h);
 if(!items.length)box.append(make('p',search.value?'Aucun joueur correspondant.':checked?'Aucun passage validé.':'Tous les joueurs ont été vérifiés.','reception-empty'));
 for(const p of items){
 const card=make('article','','reception-player'),top=make('div','','reception-player-top'),name=make('h3',p.first_name+' '+p.last_name.toLocaleUpperCase('fr')),badge=make('small',p.division,'reception-division '+p.division.toLowerCase());top.append(name,badge);
 const licence=make('p','Licence FFT : '+p.licence+' ','reception-licence'),mark=make('span',p.licence_ok?'✓':'✕',p.licence_ok?'licence-ok':'licence-error');mark.setAttribute('role','img');mark.setAttribute('aria-label',p.licence_ok?'Licence vérifiée':'Licence à vérifier');licence.append(mark);
 const payment=make('p','','reception-payment');
 if(p.paid)payment.append(make('span','✓ Payé'+(p.method==='card'?' · CB':p.method==='cash'?' · Espèces':''),'reception-paid'));
 else payment.append(make('strong','doit payer','reception-unpaid'));
 card.append(top,licence,payment);
 if(p.constraint)card.append(make('p','📌 '+p.constraint,'reception-constraint'));
 if(checked)card.append(make('small','Vérifié à '+new Intl.DateTimeFormat('fr-FR',{timeZone:'America/Cayenne',hour:'2-digit',minute:'2-digit'}).format(new Date(p.checked_at))+' · Guyane','reception-checked-time'));
 const action=make('button',checked?'Remettre à vérifier':'✓ Valider le passage',checked?'reception-undo':'reception-validate');action.type='button';action.disabled=writing;
 action.onclick=async()=>{
 if(writing)return;writing=true;draw();status.textContent='Enregistrement du passage…';const version=epoch;
 try{
 const r=await withDeadline(client.rpc('suzini_e3_reception',{p_action:'check',p_team:p.team_id,p_player:p.player,p_checked:!checked,p_expected:p.checked_at||null}));if(r.error)throw r.error;
 if(version!==epoch)return;players=r.data||[];loadedAt=Date.now();status.textContent=p.first_name+(checked?' est de nouveau à vérifier.':' : passage à l’accueil validé.');
 }catch(error){if(version===epoch){status.textContent=error.message;loadedAt=0;}}
 finally{if(version===epoch){writing=false;draw();}}
 };
 card.append(action);box.append(card);
 }
 lists.append(box);
 }
 }
 async function refresh(force=false){
 if(!authenticated||busy||writing||element.hidden||document.hidden||!force&&Date.now()-loadedAt<1500)return;
 busy=true;if(!loadedAt)status.textContent='Chargement des joueurs…';const version=epoch;
 try{const r=await withDeadline(client.rpc('suzini_e3_reception'));if(r.error)throw r.error;if(version!==epoch)return;players=r.data||[];loadedAt=Date.now();status.textContent='';draw();}
 catch(error){if(version===epoch)status.textContent=error.message||'Chargement impossible.';}
 finally{if(version===epoch)busy=false;}
 }
 search.oninput=draw;
 const timer=setInterval(()=>{if(!element.closest('[hidden]'))refresh();},10000);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!element.closest('[hidden]'))refresh(true);});
 client.auth.onAuthStateChange(event=>{if(event==='SIGNED_OUT'){epoch++;authenticated=false;players=[];writing=busy=false;lists.replaceChildren();search.value='';status.textContent='';}else if(event==='SIGNED_IN'){authenticated=true;}});
 return {element,refresh,clear(){epoch++;players=[];draw();},destroy(){clearInterval(timer);}};
}
