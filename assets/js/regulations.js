import {RULES} from './regulations-content.js?v=33';
const $=id=>document.getElementById(id),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;};
let lang='fr',mode='summary';
try{lang=localStorage.getItem('suzini-rules-language')==='pt'?'pt':'fr';mode=localStorage.getItem('suzini-rules-mode')==='full'?'full':'summary';}catch{}
const params=new URLSearchParams(location.search);if(['fr','pt'].includes(params.get('lang')))lang=params.get('lang');if(['summary','full'].includes(params.get('mode')))mode=params.get('mode');
function render(){const r=RULES[lang];document.documentElement.lang=lang==='pt'?'pt-BR':'fr';document.title=r.title+' · Vendredis Suzini';$('rules-title').textContent=r.title;$('rules-subtitle').textContent=r.subtitle;$('rules-draft').textContent=r.draft;$('rules-notice').textContent=r.notice;$('rules-updated').textContent=r.updated;
 for(const b of document.querySelectorAll('[data-rules-language]'))b.setAttribute('aria-pressed',String(b.dataset.rulesLanguage===lang));
 for(const b of document.querySelectorAll('[data-rules-mode]')){b.setAttribute('aria-pressed',String(b.dataset.rulesMode===mode));b.textContent=b.dataset.rulesMode==='full'?r.full:r.summary;}
 for(const [key,value] of Object.entries({access:r.access,contacts:r.contacts,flyer:r.flyer,rules:r.rules}))document.querySelector('[data-rules-nav='+key+']').textContent=value;
 const content=$('rules-content');content.replaceChildren();content.className=mode==='summary'?'rules-summary':'rules-full';
 if(mode==='summary'){for(const card of r.cards){const box=el('article','','rules-card');box.append(el('h2',card.title),el('p',card.text));content.append(box);}}
 else{const toc=el('details','','rules-toc');toc.append(el('summary',r.toc));const list=el('ol');r.sections.forEach((section,index)=>{const li=el('li'),a=el('a',section.title);a.href='#rule-'+(index+1);a.addEventListener('click',event=>{event.preventDefault();$('rule-'+(index+1)).scrollIntoView({block:'start',behavior:'auto'});});li.append(a);list.append(li);});toc.append(list);content.append(toc);
 r.sections.forEach((section,index)=>{const box=el('section','','rules-card');box.id='rule-'+(index+1);box.append(el('h2',(index+1)+'. '+section.title));const body=el('div');body.innerHTML=section.body;box.append(body);content.append(box);});}
 $('rules-sources-title').textContent=r.sources;$('rules-sources-intro').textContent=r.sourceIntro;
 try{localStorage.setItem('suzini-rules-language',lang);localStorage.setItem('suzini-rules-mode',mode);}catch{}
}
for(const b of document.querySelectorAll('[data-rules-language]'))b.addEventListener('click',()=>{lang=b.dataset.rulesLanguage;render();});
for(const b of document.querySelectorAll('[data-rules-mode]'))b.addEventListener('click',()=>{mode=b.dataset.rulesMode;render();});
render();
