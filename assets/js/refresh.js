export function freshPageUrl(href,stamp=Date.now()){const url=new URL(href);url.searchParams.set('_refresh',String(stamp));return url.href;}
export function createResumeGuard(){let wasHidden=false;return{hide(){wasHidden=true;},resume(){const result=wasHidden;wasHidden=false;return result;}};}
let reloading=false,hideTimer;
function indicator(){let el=document.getElementById('pull-refresh');if(!el){el=document.createElement('div');el.id='pull-refresh';el.className='refresh-badge';el.hidden=true;el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.innerHTML='<span class="refresh-wheel" aria-hidden="true">↻</span><span class="refresh-label"></span>';document.body.append(el);}return el;}
export function showRefresh(text,ready=false,loading=false){clearTimeout(hideTimer);const el=indicator();el.querySelector('.refresh-label').textContent=text;el.hidden=false;el.classList.toggle('ready',ready);el.classList.toggle('loading',loading);}
export function hideRefresh(){if(reloading)return;const el=indicator();el.hidden=true;el.classList.remove('ready','loading');}
export function refreshPage({automatic=false}={}){
 if(reloading)return false;
 const form=document.getElementById('signupForm');
 if(form?.dataset.submitting==='true')return false;
 // Returning from another app must not erase a form being filled out.
 if(automatic&&form?.dataset.dirty==='true')return false;
 if(navigator.onLine===false){showRefresh('Connexion indisponible');hideTimer=setTimeout(hideRefresh,3000);return false;}
 reloading=true;showRefresh('Actualisation…',true,true);
 // A fresh URL also bypasses a browser/CDN copy before the worker takes control.
 requestAnimationFrame(()=>requestAnimationFrame(()=>location.replace(freshPageUrl(location.href))));return true;
}
export function installFreshNavigation(win=window,doc=document){
 const guard=createResumeGuard();if(doc.hidden)guard.hide();
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)guard.hide();else if(guard.resume())refreshPage({automatic:true});});
 win.addEventListener('pageshow',event=>{if(event.persisted)refreshPage({automatic:true});});
 const form=doc.getElementById('signupForm');form?.addEventListener('input',()=>{form.dataset.dirty='true';});form?.addEventListener('reset',()=>{delete form.dataset.dirty;});
 const sw=win.navigator.serviceWorker;
 if(sw&&win.isSecureContext){
  sw.addEventListener('controllerchange',()=>refreshPage({automatic:true}));
  const worker=new URL('../../refresh-worker.js',import.meta.url),scope=new URL('../../',import.meta.url);
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
