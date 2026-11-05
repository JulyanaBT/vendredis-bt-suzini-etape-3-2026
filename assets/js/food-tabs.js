const tabs=[...document.querySelectorAll('[data-food-tab]')],panels=[...document.querySelectorAll('[data-food-panel]')];
function selectFood(value,focus=false){
 const tab=tabs.find(t=>t.dataset.foodTab===value)||tabs[0];if(!tab)return;
 for(const b of tabs){const active=b===tab;b.setAttribute('aria-selected',String(active));b.tabIndex=active?0:-1;}
 for(const p of panels)p.hidden=p.dataset.foodPanel!==tab.dataset.foodTab;
 try{sessionStorage.setItem('suzini_e3_food_tab',tab.dataset.foodTab);const url=new URL(location.href);url.searchParams.set('foodtab',tab.dataset.foodTab);history.replaceState(null,'',url);}catch{}
 if(focus)tab.focus();
}
tabs.forEach((tab,i)=>{tab.onclick=()=>selectFood(tab.dataset.foodTab);tab.onkeydown=e=>{let n;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;else return;e.preventDefault();selectFood(tabs[n].dataset.foodTab,true);};});
let initial=new URLSearchParams(location.search).get('foodtab');try{initial=initial||sessionStorage.getItem('suzini_e3_food_tab');}catch{}selectFood(initial||'joueurs');
