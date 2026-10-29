// Standalone apps have no browser refresh control. Keep normal browser gestures intact.
export function createPullGesture(threshold=96){
 let start=null,amount=0,claimed=false;
 return {
  start(x,y,allowed=true){start=allowed?{x,y}:null;amount=0;claimed=false;},
  move(x,y){
   if(!start)return {capture:false,amount:0,ready:false};
   const dx=Math.abs(x-start.x),dy=y-start.y;
   if(!claimed&&(dy<0||dx>12&&dx>dy)){this.cancel();return {capture:false,amount:0,ready:false};}
   if(!claimed&&dy>0&&dy>=dx)claimed=true;
   amount=claimed?Math.max(0,dy):0;
   return {capture:claimed,amount,ready:amount>=threshold};
  },
  end(){const ready=claimed&&amount>=threshold;this.cancel();return ready;},
  cancel(){start=null;amount=0;claimed=false;}
 };
}
export function installPullRefresh(win=window,doc=document){
 const mode=win.matchMedia('(display-mode: standalone)'),full=win.matchMedia('(display-mode: fullscreen)');
 const enabled=()=>mode.matches||full.matches||win.navigator.standalone===true;
 const sync=()=>doc.documentElement.classList.toggle('standalone-refresh',enabled());
 sync();mode.addEventListener?.('change',sync);full.addEventListener?.('change',sync);
 const indicator=doc.createElement('div');indicator.id='pull-refresh';indicator.setAttribute('role','status');indicator.setAttribute('aria-live','polite');indicator.hidden=true;doc.body.append(indicator);
 const gesture=createPullGesture();let reloading=false,hideTimer,blockClickUntil=0;
 const hide=()=>{indicator.hidden=true;indicator.classList.remove('ready');};
 const cancel=()=>{gesture.cancel();if(!reloading)hide();};
 const show=(text,ready=false)=>{indicator.textContent=text;indicator.hidden=false;indicator.classList.toggle('ready',ready);};
 function excluded(target){
  if(!(target instanceof win.Element)||target.closest('input,textarea,select,button,a,[contenteditable],dialog,[role="dialog"]')||doc.querySelector('dialog[open]')||win.getSelection()?.type==='Range')return true;
  for(let el=target;el&&el!==doc.body&&el!==doc.documentElement;el=el.parentElement){if(el.scrollHeight>el.clientHeight+1&&/(auto|scroll)/.test(win.getComputedStyle(el).overflowY)){const publicScroller=doc.body.dataset.space==='public'&&(el.matches('main')||el.matches('.participant-list'));if(!publicScroller||el.scrollTop>1)return true;}}
  return false;
 }
 doc.addEventListener('touchstart',event=>{
  clearTimeout(hideTimer);if(!reloading)hide();
  const t=event.touches[0];const top=win.scrollY<=1&&(doc.scrollingElement?.scrollTop||0)<=1;
  gesture.start(t?.clientX||0,t?.clientY||0,!reloading&&enabled()&&event.touches.length===1&&top&&!excluded(event.target));
 },{passive:true});
 doc.addEventListener('touchmove',event=>{
  if(event.touches.length!==1||!enabled()){cancel();return;}
  const t=event.touches[0],result=gesture.move(t.clientX,t.clientY);
  if(!result.capture){hide();return;}
  // Cancel only the downward pull that started at the page top, never normal scrolling.
  if(!event.cancelable){cancel();return;}
  event.preventDefault();
  if(result.amount>=12)show(result.ready?'↻ Relâchez pour actualiser':'↓ Tirez pour actualiser',result.ready);else hide();
 },{passive:false});
 doc.addEventListener('touchend',event=>{
  if(event.touches.length){cancel();return;}
  if(!gesture.end()){hide();return;}
  if(event.cancelable)event.preventDefault();blockClickUntil=Date.now()+500;
  if(win.navigator.onLine===false){show('Connexion indisponible. Réessayez une fois en ligne.');hideTimer=win.setTimeout(hide,3500);return;}
  if(doc.querySelector('form button:disabled')){show('Enregistrement en cours… Réessayez dans un instant.');hideTimer=win.setTimeout(hide,2500);return;}
  reloading=true;show('↻ Actualisation…',true);
  // Preserve the current route and the existing persisted login session.
  win.requestAnimationFrame(()=>win.requestAnimationFrame(()=>win.location.reload()));
 },{passive:false});
 doc.addEventListener('touchcancel',cancel,{passive:true});
 doc.addEventListener('click',event=>{if(Date.now()<blockClickUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 win.addEventListener('hashchange',cancel);win.addEventListener('pagehide',cancel);
 doc.addEventListener('visibilitychange',()=>{if(doc.hidden)cancel();});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')installPullRefresh();
