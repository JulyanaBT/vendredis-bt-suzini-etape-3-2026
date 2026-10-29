const tabs=[...document.querySelectorAll('[data-programme]')];
const messages={chrono:'Programmation prochainement disponible.',resultats:'Les résultats seront disponibles après les premiers matchs.',poules:'Les poules seront disponibles après le tirage.',finales:'Le tableau final sera disponible après les poules.'};
function select(tab){for(const button of tabs){const active=button===tab;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;}document.getElementById('programme-panel').setAttribute('aria-labelledby',tab.id);document.getElementById('programmeMessage').textContent=messages[tab.dataset.programme];}
for(const tab of tabs){tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',event=>{let next=tabs.indexOf(tab);if(event.key==='ArrowRight')next=(next+1)%tabs.length;else if(event.key==='ArrowLeft')next=(next+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();select(tabs[next]);tabs[next].focus();});}
function division(value){document.getElementById('programmeDivision').textContent=value==='DD'?'Double dames':'Double hommes';}
try{division(localStorage.getItem('suzini_etape3_public_epreuve'));}catch{}
document.addEventListener('publicZoneChange',event=>division(event.detail.epreuve));
