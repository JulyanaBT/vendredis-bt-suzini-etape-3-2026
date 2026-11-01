import {showRefresh,hideRefresh,refreshPage} from './refresh.js?v=91';
export function createPullGesture(threshold=84){
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
 doc.documentElement.classList.add('themed-refresh');
 const gesture=createPullGesture();let blockClickUntil=0;
 function excluded(target){
  if(!(target instanceof win.Element)||target.closest('input,textarea,select,button,[contenteditable],dialog,[role="dialog"]')||doc.querySelector('dialog[open]')||win.getSelection()?.type==='Range')return true;
  for(let el=target;el&&el!==doc.body&&el!==doc.documentElement;el=el.parentElement){if(el.scrollHeight>el.clientHeight+1&&/(auto|scroll)/.test(win.getComputedStyle(el).overflowY)&&el.scrollTop>1)return true;}
  return false;
 }
 const cancel=()=>{gesture.cancel();hideRefresh();};
 doc.addEventListener('touchstart',event=>{const t=event.touches[0];gesture.start(t?.clientX||0,t?.clientY||0,event.touches.length===1&&win.scrollY<=1&&!excluded(event.target));},{passive:true});
 doc.addEventListener('touchmove',event=>{
  if(event.touches.length!==1){cancel();return;}
  const t=event.touches[0],result=gesture.move(t.clientX,t.clientY);
  if(!result.capture){hideRefresh();return;}
  if(!event.cancelable){cancel();return;}event.preventDefault();
  if(result.amount>=12)showRefresh(result.ready?'Relâchez pour actualiser':'Tirez pour actualiser',result.ready);else hideRefresh();
 },{passive:false});
 doc.addEventListener('touchend',event=>{
  if(event.touches.length){cancel();return;}if(!gesture.end()){hideRefresh();return;}
  if(event.cancelable)event.preventDefault();blockClickUntil=Date.now()+500;refreshPage();
 },{passive:false});
 doc.addEventListener('touchcancel',cancel,{passive:true});
 doc.addEventListener('click',event=>{if(Date.now()<blockClickUntil){event.preventDefault();event.stopImmediatePropagation();}},{capture:true});
 win.addEventListener('pagehide',cancel);doc.addEventListener('visibilitychange',()=>{if(doc.hidden)cancel();});
}
if(typeof window!=='undefined'&&typeof document!=='undefined')installPullRefresh();
