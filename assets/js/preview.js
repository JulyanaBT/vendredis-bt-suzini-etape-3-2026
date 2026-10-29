const main=document.querySelector('main');
if(main&&!['accueil','inscription'].includes(document.body.dataset.page)){const note=document.createElement('aside');note.className='preview-note';note.setAttribute('role','status');note.textContent='Site en préparation · Les inscriptions ne sont pas encore ouvertes.';note.dataset.siteStatus='' ;main.prepend(note);}
for(const form of document.forms){if(form.id==='signupForm')continue;form.addEventListener('submit',event=>{if(form.method!=='dialog')event.preventDefault();});}
for(const id of ['btnAdmin','btnJAT','btnArbitre']){const el=document.getElementById(id);if(el)el.addEventListener('click',event=>{event.preventDefault();document.getElementById('authHint').textContent='Espace conservé depuis TSCK. Les accès de cette édition restent à configurer.';});}
const hint=document.getElementById('authHint');if(hint)hint.textContent='Accès organisateurs en préparation.';
document.getElementById('btnLogout')?.remove();
for(const el of document.querySelectorAll('button[data-tab]'))el.addEventListener('click',()=>{for(const tab of document.querySelectorAll('button[data-tab]'))tab.setAttribute('aria-selected',String(tab===el));for(const panel of document.querySelectorAll('.tab-panel'))panel.classList.toggle('active',panel.id==='tab-'+el.dataset.tab);});
// The page-specific Supabase module fills shared event data.
for(const el of document.querySelectorAll('[id]')){if(el.children.length===0&&/chargement|connexion en cours/i.test(el.textContent))el.textContent='Données de cette étape à venir.';}
