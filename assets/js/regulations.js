import {RULES} from './regulations-content.js?v=54';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
RULES.fr.cards.push({title:"Droit à l’image",text:"L’inscription vaut acceptation de l’utilisation des photos et vidéos du tournoi pour sa communication, sauf opposition écrite adressée au Juge-Arbitre.",body:"<p>L’inscription au tournoi vaut acceptation de la prise et de l’utilisation de photographies et de vidéos réalisées pendant l’événement pour la communication du tournoi et de ses organisateurs. Tout participant qui s’y oppose doit le notifier par écrit au Juge-Arbitre, Jules PARISIS.</p>"});
RULES.pt.cards.push({title:"Direito de imagem",text:"A inscrição implica a aceitação do uso de fotos e vídeos do torneio para sua divulgação, salvo oposição por escrito ao juiz-árbitro.",body:"<p>A inscrição no torneio implica a aceitação da captação e utilização de fotografias e vídeos realizados durante o evento para a divulgação do torneio e de seus organizadores. Quem se opuser deverá comunicar sua decisão por escrito ao juiz-árbitro, Jules PARISIS.</p>"});
let lang='fr',mode='summary';
try{lang=localStorage.getItem('suzini-rules-language')==='pt'?'pt':'fr';mode=localStorage.getItem('suzini-rules-mode')==='full'?'full':'summary';}catch{}
const params=new URLSearchParams(location.search);if(['fr','pt'].includes(params.get('lang')))lang=params.get('lang');if(['summary','full'].includes(params.get('mode')))mode=params.get('mode');
function render(){const r=RULES[lang];document.documentElement.lang=lang==='pt'?'pt-BR':'fr';document.title=r.title+' · Vendredis Suzini';
 for(const b of document.querySelectorAll('[data-rules-language]'))b.setAttribute('aria-pressed',String(b.dataset.rulesLanguage===lang));
 for(const b of document.querySelectorAll('[data-rules-mode]')){b.setAttribute('aria-pressed',String(b.dataset.rulesMode===mode));b.textContent=b.dataset.rulesMode==='full'?r.full:r.summary;}
 for(const [key,value] of Object.entries({access:r.access,contacts:r.contacts,flyer:r.flyer,rules:r.rules}))document.querySelector('[data-rules-nav='+key+']').textContent=value;
 const content=$('rules-content');content.replaceChildren();content.className=mode==='summary'?'rules-summary':'rules-full';
 for(const card of r.cards){
 const box=el('details','','rules-card rules-accordion'+(card.featured?' rules-featured':''));box.name='tournament-rules';
 const heading=el('summary',card.title);box.append(heading);const body=el('div','','rules-accordion-body');
 if(mode==='summary')body.append(el('p',card.text));else body.innerHTML=card.body;
 box.append(body);box.addEventListener('toggle',()=>{if(box.open)for(const other of content.querySelectorAll('details[open]'))if(other!==box)other.open=false;});content.append(box);
 }
 $('rules-sources-title').textContent=r.sources;$('rules-sources-intro').textContent=r.sourceIntro;
 try{localStorage.setItem('suzini-rules-language',lang);localStorage.setItem('suzini-rules-mode',mode);}catch{}
}
for(const b of document.querySelectorAll('[data-rules-language]'))b.addEventListener('click',()=>{lang=b.dataset.rulesLanguage;render();});
for(const b of document.querySelectorAll('[data-rules-mode]'))b.addEventListener('click',()=>{mode=b.dataset.rulesMode;render();});
render();
// One open topic, including reference texts, on browsers without details[name].
document.addEventListener('toggle',event=>{const box=event.target;if(box.matches?.('details[name="tournament-rules"]')&&box.open)for(const other of document.querySelectorAll('details[name="tournament-rules"][open]'))if(other!==box)other.open=false;},true);
