import {client} from './private-client.js?v=92';
const club=document.body.dataset.space==='club';
const page=document.body.dataset.infoPage;
let state,busy=false,root;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phone=v=>String(v||'').replace(/[^+0-9]/g,'');
const subject='Les vendredis du BT Suzini - Etape 3 - contact';
const emailCard=(email)=>email?'<a class="contact-email info-email" href="mailto:'+esc(email)+'?subject='+encodeURIComponent(subject)+'"><strong>✉ Envoyer un e-mail ↗</strong><span>'+esc(email)+'</span></a>':'';
const field=(name,label,value,textarea=false,type='text')=>'<label>'+label+(textarea?'<textarea name="'+name+'" rows="3" required maxlength="3000">'+esc(value)+'</textarea>':'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" maxlength="'+(type==='email'?254:100)+'" '+(name==='name'||name==='venue'?'required':'')+'>')+'</label>';
function notice(text,error=false){const el=document.querySelector('#info-status');if(el){el.textContent=text;el.classList.toggle('info-error',error);}}
async function save(section,data){const {data:next,error}=await client.rpc('suzini_e3_info_save',{p_section:section,p_data:data,p_revision:state.revision});if(error)throw error;state=next;}
function render(){
 if(page==='access'){
 const a=state.access;
 root.innerHTML=club?'<form data-info-form="access" class="public-card info-editor"><h1>Adresse du tournoi</h1>'+field('venue','Lieu',a.venue)+field('address','Adresse',a.address,true)+'<h2>Stationnement et accueil</h2>'+field('welcome','Informations à afficher',a.welcome,true)+'<button class="signup-submit">Enregistrer les modifications</button></form>':'<section class="public-card"><h1>'+esc(a.venue)+'</h1><address class="info-multiline">'+esc(a.address)+'</address><div class="contact-actions"><a target="_blank" rel="noopener" href="https://maps.google.com/?q='+encodeURIComponent(a.venue+' '+a.address)+'">Voir la carte ↗</a><a target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(a.venue+' '+a.address)+'">Itinéraire ↗</a></div></section><details class="public-card" open><summary>Stationnement et accueil</summary><p class="info-multiline">'+esc(a.welcome)+'</p></details>';
 }else if(page==='flyer'){
 root.innerHTML=(club?'<form data-info-form="flyer" class="public-card info-editor flyer-import"><label>Importer un nouveau flyer<input type="file" name="flyer" accept="image/jpeg,image/png,image/webp,application/pdf,.pdf" required></label><small>JPG, PNG, WebP ou PDF · 20 Mo maximum. Le flyer remplacera celui du public.</small><button class="signup-submit">Publier le nouveau flyer</button></form>':'')+'<figure class="event-flyer"><img src="'+esc(state.flyer.image)+'" alt="Flyer actuel du tournoi Les Vendredis du BT Suzini">'+(!club?'<figcaption><a target="_blank" rel="noopener" href="'+esc(state.flyer.document||state.flyer.image)+'">Télécharger le flyer ↗</a></figcaption>':'')+'</figure>';
 }else if(page==='contacts'){
 const c=state.contacts;
 root.innerHTML='<a class="home-whatsapp contact-group" href="'+esc(c.group)+'" target="_blank" rel="noopener"><strong>Rejoindre le groupe WhatsApp ↗</strong><span>Toutes les infos et photos du tournoi seront sur le groupe.</span></a>'+[['organisation','Organisation'],['ja','Juge Arbitre'],['support','Support Technique']].map(([key,title],i)=>'<details class="public-card contact-accordion" name="contact-sections" '+(!i?'open':'')+'><summary>'+title+'</summary>'+(key==='organisation'?emailCard(c.organisation_email):'')+c.people.filter(p=>p.section===key).map(p=>'<article class="organizer-contact"><h2>'+esc(p.name)+'</h2><div class="contact-actions">'+(p.phone?'<a href="tel:'+phone(p.phone)+'">'+esc(p.phone)+'</a><a href="https://wa.me/'+phone(p.phone).replace('+','')+'" target="_blank" rel="noopener">WhatsApp ↗</a>':'')+'</div>'+emailCard(p.email)+(club?'<div class="info-edit-actions"><button type="button" data-edit-contact="'+esc(p.id)+'">Modifier</button><button type="button" class="info-delete" data-delete-contact="'+esc(p.id)+'">Supprimer</button></div>':'')+'</article>').join('')+(club?'<button type="button" class="info-add" data-add-contact="'+key+'">＋ Ajouter un contact</button>':'')+'</details>').join('')+(club?'<details class="public-card"><summary>Coordonnées de l’organisation</summary><form class="info-editor" data-info-form="organisation">'+field('organisation_email','Adresse e-mail de l’organisation',c.organisation_email,false,'email')+field('group','Lien du groupe WhatsApp',c.group,false,'url')+'<button class="signup-submit">Enregistrer</button></form></details>':'');
 }
}
function editContact(person,section){
 const dialog=document.createElement('dialog');dialog.className='info-dialog';
 dialog.innerHTML='<form class="info-editor"><h2>'+(person?'Modifier le contact':'Ajouter un contact')+'</h2>'+field('name','Nom affiché',person?.name||'')+field('email','E-mail',person?.email||'',false,'email')+field('phone','Téléphone (avec indicatif)',person?.phone||'',false,'tel')+'<label>Rubrique<select name="section">'+[['organisation','Organisation'],['ja','Juge Arbitre'],['support','Support Technique']].map(([k,t])=>'<option value="'+k+'" '+((person?.section||section)===k?'selected':'')+'>'+t+'</option>').join('')+'</select></label><div class="info-edit-actions"><button type="button" data-cancel>Annuler</button><button type="submit" class="signup-submit">Enregistrer</button></div><p role="status"></p></form>';
 document.body.append(dialog);dialog.showModal();
 dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.addEventListener('close',()=>dialog.remove());
 dialog.querySelector('form').onsubmit=async event=>{
 event.preventDefault();const button=event.submitter;button.disabled=true;
 try{const values=Object.fromEntries(new FormData(event.target));for(const k of ['name','email','phone'])values[k]=values[k].trim();const next={id:person?.id||crypto.randomUUID(),...values};const people=person?state.contacts.people.map(p=>p.id===person.id?next:p):[...state.contacts.people,next];await save('contacts',{...state.contacts,people});dialog.close();render();notice('Contact enregistré et mis à jour côté public.');}
 catch(error){dialog.querySelector('[role="status"]').textContent=error.message;}finally{button.disabled=false;}
 };
}
async function uploadFlyer(file){
 if(!file||file.size>20*1024*1024)throw new Error('Choisissez un fichier de 20 Mo maximum.');
 const bytes=new Uint8Array(await file.arrayBuffer());const pdf=new TextDecoder().decode(bytes.slice(0,5))==='%PDF-';
 let imageBlob,pdfBlob;
 if(pdf){
 const lib=await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.min.mjs');lib.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs';
 const doc=await lib.getDocument({data:bytes}).promise;
 try{if(doc.numPages!==1)throw new Error('Le flyer PDF doit contenir une seule page.');const p=await doc.getPage(1);const base=p.getViewport({scale:1});const vp=p.getViewport({scale:Math.min(2,2000/Math.max(base.width,base.height))});const canvas=document.createElement('canvas');canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);await p.render({canvasContext:canvas.getContext('2d'),viewport:vp,background:'white'}).promise;imageBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.9));pdfBlob=file;}finally{await doc.destroy();}
 }else{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Formats acceptés : JPG, PNG, WebP ou PDF.');
 const url=URL.createObjectURL(file);
 try{const image=new Image();image.src=url;await image.decode();const ratio=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(image.naturalHeight*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);imageBlob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.92));}finally{URL.revokeObjectURL(url);}
 }
 if(!imageBlob)throw new Error('Impossible de préparer l’image du flyer.');
 const bucket=client.storage.from('suzini-e3-flyers');const id=crypto.randomUUID();async function upload(name,blob,type){const {error}=await bucket.upload(name,blob,{contentType:type,cacheControl:'31536000',upsert:false});if(error)throw error;return bucket.getPublicUrl(name).data.publicUrl;}
 const image=await upload(id+'.jpg',imageBlob,'image/jpeg');const document=pdfBlob?await upload(id+'.pdf',pdfBlob,'application/pdf'):'';
 await save('flyer',{image,document});
}
async function boot(){
 root=document.querySelector('#info-content');if(!root)return;
 if(club){const {error}=await client.rpc('suzini_e3_club');if(error)return;}
 const {data,error}=await client.rpc('suzini_e3_info');if(error){notice('Chargement impossible. Réessayez en actualisant la page.',true);return;}state=data;render();
}
document.addEventListener('submit',async event=>{
 const form=event.target;if(!form.matches('[data-info-form]'))return;event.preventDefault();if(busy)return;busy=true;const button=event.submitter;button.disabled=true;notice('Enregistrement…');
 try{const type=form.dataset.infoForm;const values=Object.fromEntries(new FormData(form));
 if(type==='access')await save('access',values);
 if(type==='organisation')await save('contacts',{...state.contacts,...values});
 if(type==='flyer'){notice('Préparation et import du flyer…');await uploadFlyer(values.flyer);}
 render();notice('Modifications enregistrées et publiées.');
 }catch(error){notice(error.message,true);}finally{busy=false;if(button.isConnected)button.disabled=false;}
});
document.addEventListener('click',async event=>{
 const b=event.target.closest('[data-add-contact],[data-edit-contact],[data-delete-contact]');if(!b||!club||!state||busy)return;
 if(b.hasAttribute('data-add-contact'))return editContact(null,b.dataset.addContact);
 const p=state.contacts.people.find(p=>p.id===(b.dataset.editContact||b.dataset.deleteContact));if(!p)return;
 if(b.hasAttribute('data-edit-contact'))return editContact(p);
 if(!confirm('Supprimer le contact « '+p.name+' » du club et du public ?'))return;
 busy=true;b.disabled=true;try{await save('contacts',{...state.contacts,people:state.contacts.people.filter(x=>x.id!==p.id)});render();notice('Contact supprimé.');}catch(error){notice(error.message,true);}finally{busy=false;if(b.isConnected)b.disabled=false;}
});
document.addEventListener('toggle',event=>{const box=event.target;if(box.matches?.('.contact-accordion')&&box.open)document.querySelectorAll('.contact-accordion[open]').forEach(other=>{if(other!==box)other.open=false;});},true);
if(club){await import('./club-shell.js?v=92');document.addEventListener('club:ready',boot);}
await boot();
if(!club)window.addEventListener('pageshow',event=>{if(event.persisted)boot();});
