export function freshPageUrl(href,stamp=Date.now()){const url=new URL(href);url.searchParams.set('_refresh',String(stamp));return url.href;}
export function createResumeGuard(){let wasHidden=false;return{hide(){wasHidden=true;},resume(){const result=wasHidden;wasHidden=false;return result;}};}
let reloading=false,hideTimer;
function indicator(){let el=document.getElementById('pull-refresh');if(!el){el=document.createElement('div');el.id='pull-refresh';el.className='refresh-badge';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<span class="refresh-wheel" aria-hidden="true">↻</span><span class="refresh-label"></span>';document.body.append(el);}return el;}
export function showRefresh(text,ready=false,loading=false){clearTimeout(hideTimer);const el=indicator();el.querySelector('.refresh-label').textContent=text;el.hidden=false;el.classList.toggle('ready',ready);el.classList.toggle('loading',loading);}
export function hideRefresh(){if(reloading)return;const el=indicator();el.hidden=true;el.classList.remove('ready','loading');}
export function refreshPage({automatic=false}={}){
 if(reloading)return false;
 if(automatic&&location.hash.startsWith('#invitation'))return false;
 if(document.querySelector('form[data-submitting="true"]'))return false;
 if(document.querySelector('form[data-dirty="true"],dialog[open]')){if(!automatic){showRefresh('Saisie conservée · terminez ou annulez avant d’actualiser');hideTimer=setTimeout(hideRefresh,3500);}return false;}
 if(navigator.onLine===false){showRefresh('Connexion indisponible');hideTimer=setTimeout(hideRefresh,3000);return false;}
 reloading=true;showRefresh('Actualisation…',true,true);
 // A fresh URL also bypasses a browser/CDN copy before the worker takes control.
 hideTimer=setTimeout(()=>{reloading=false;showRefresh('Actualisation interrompue · réessayez');hideTimer=setTimeout(hideRefresh,3000);},10000);
 try{location.replace(freshPageUrl(location.href));}catch{reloading=false;hideRefresh();}return true;
}
export function installFreshNavigation(win=window,doc=document){
 const guard=createResumeGuard();if(doc.hidden)guard.hide();
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)guard.hide();else if(guard.resume())refreshPage({automatic:true});});
 win.addEventListener('pageshow',event=>{if(event.persisted)refreshPage({automatic:true});});
 doc.addEventListener('input',event=>{const form=event.target.closest?.('form');if(form)form.dataset.dirty='true';});
 doc.addEventListener('change',event=>{const form=event.target.closest?.('form');if(form)form.dataset.dirty='true';});
 doc.addEventListener('reset',event=>{if(event.target.matches?.('form'))delete event.target.dataset.dirty;},true);
 doc.addEventListener('suzini:form-saved',event=>{const form=event.detail?.form;if(form){delete form.dataset.dirty;delete form.dataset.submitting;}});
 win.addEventListener('beforeunload',event=>{if(doc.querySelector('form[data-dirty="true"]')){event.preventDefault();event.returnValue='';}});
 const sw=win.navigator.serviceWorker;
 if(sw&&win.isSecureContext){
  sw.addEventListener('controllerchange',()=>refreshPage({automatic:true}));
  const worker=new URL('../../refresh-worker.js?v=93',import.meta.url),scope=new URL('../../',import.meta.url);
  sw.register(worker.href,{scope:scope.href,updateViaCache:'none'}).then(registration=>registration.update()).catch(()=>{/* Fresh navigation URLs remain available without worker support. */});
 }
 // Cache-bust a normal page change, including the first uncontrolled visit.
 doc.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  const link=event.target.closest?.('a[href]');if(!link||link.target&&link.target!=='_self'||link.hasAttribute('download'))return;
  const url=new URL(link.href,win.location.href),scope=new URL('../../',import.meta.url);
  if(url.origin!==scope.origin||!url.pathname.startsWith(scope.pathname)||!(/\/$|\.html$/.test(url.pathname)))return;
  if(url.pathname===win.location.pathname&&url.search===win.location.search&&url.hash)return;
  link.href=freshPageUrl(url.href);
 });
}
if(typeof window!=='undefined'&&typeof document!=='undefined')installFreshNavigation();
