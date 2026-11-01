const tabs=[...document.querySelectorAll('[data-signup-tab]')];
export function selectSignupTab(name){for(const tab of tabs){const active=tab.dataset.signupTab===name;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=!active;}document.querySelector('main').scrollTop=0;}
for(const tab of tabs){tab.addEventListener('click',()=>selectSignupTab(tab.dataset.signupTab));tab.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const target=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(tabs.indexOf(tab)+1)%tabs.length];selectSignupTab(target.dataset.signupTab);target.focus();});}
document.addEventListener('suzini:registered',()=>{selectSignupTab('inscription');document.getElementById('successBox').scrollIntoView({behavior:'smooth',block:'nearest'});});
document.getElementById('paymentLink')?.addEventListener('click',event=>{if(event.currentTarget.getAttribute('aria-disabled')==='true')event.preventDefault();});

const requestedTab=new URLSearchParams(location.search).get('tab');if(['inscription','paiement','partenaire'].includes(requestedTab))selectSignupTab(requestedTab);
