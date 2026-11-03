import {client,withDeadline} from './private-client.js?v=94';
export async function adminDrawTools(main,isCurrent){
 const style=document.createElement('link');style.rel='stylesheet';style.href=new URL('../draw-admin.css?v=1',import.meta.url).href;if(!document.querySelector('link[href="'+style.href+'"]'))document.head.append(style);
 const el=(tag,text='',cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;return e;};
 const box=el('section','','admin-card admin-draw-tools');box.append(el('span','ADMINISTRATION DES TIRAGES','admin-eyebrow'),el('h2','Réinitialiser un tirage'),el('p','Efface le tirage, les scores et les horaires de l’épreuve sélectionnée. Les inscriptions et les paiements sont conservés.'));
 const label=el('label','Données à gérer'),mode=el('select');mode.setAttribute('aria-label','Tournoi réel ou simulation');
 for(const [v,t] of [['real','Tournoi réel'],['simulation','Simulation privée']]){const o=el('option',t);o.value=v;mode.append(o);}try{mode.value=localStorage.getItem('suzini_e3_match_mode')==='simulation'?'simulation':'real';}catch{}
 label.append(mode);const rows=el('div','','admin-draw-rows'),status=el('p');status.setAttribute('role','status');box.append(label,rows,status);
 const footer=main.querySelector('.organizer-logout');if(footer)footer.before(box);else main.append(box);
 async function refresh(){
 rows.replaceChildren();status.textContent='Chargement des tirages…';const chosen=mode.value;
 try{const r=await withDeadline(client.rpc('suzini_e3_draw_manage',{p_action:'list',p_division:'DM',p_simulation:chosen==='simulation'}));if(r.error)throw r.error;if(!isCurrent()||chosen!==mode.value)return;status.textContent='';
 for(const d of r.data.divisions){const row=el('div','','admin-draw-row'),info=el('div');info.append(el('strong',d.division==='DM'?'Double hommes':'Double dames'),el('small',d.count+' équipes · '+(d.draw_published_at?(d.draw_public_complete?'diffusion terminée':'diffusion en cours'):d.draw_prepared?'préparé, non diffusé':'non préparé')));
 const button=el('button','Réinitialiser');button.type='button';button.onclick=async()=>{
 const scope=chosen==='simulation'?'SIMULATION PRIVÉE':'TOURNOI RÉEL',division=d.division==='DM'?'double hommes':'double dames';
 if(!confirm('Réinitialiser le tirage '+division+' — '+scope+' ?\n\nLes résultats et horaires de cette épreuve seront effacés. Les équipes inscrites et paiements seront conservés.\n\nIl faudra préparer puis diffuser un nouveau tirage.'))return;
 button.disabled=true;status.textContent='Réinitialisation…';
 try{const reset=await withDeadline(client.rpc('suzini_e3_draw_manage',{p_action:'reset',p_division:d.division,p_simulation:chosen==='simulation'}));if(reset.error)throw reset.error;await refresh();status.textContent='Tirage '+division+' réinitialisé — '+scope+'.';}catch(e){status.textContent=e.message;button.disabled=false;}
 };row.append(info,button);rows.append(row);}
 }catch(e){if(isCurrent())status.textContent=e.message;}
 }
 mode.onchange=refresh;await refresh();
}
