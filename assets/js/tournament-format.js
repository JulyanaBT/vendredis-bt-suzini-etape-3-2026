export const COURTS={DM:{name:'🐝 Manon Queen Bee',className:'court-manon'},DD:{name:'🌶️ Lisa de los pimentos',className:'court-lisa'}};
export function formatFor(count){
 if(!Number.isInteger(count)||count<3||count>8)return null;
 const sizes=count<=5?[count]:count===6?[3,3]:count===7?[3,4]:[4,4];
 const description=count<=5?'Une poule unique : chaque équipe rencontre toutes les autres. Le classement de la poule constitue le classement final.':count===6?'Deux poules de 3. Demi-finales croisées entre les 1ers et 2es, puis finale et match pour la 3e place. Les deux 3es jouent la 5e place.':count===7?'Une poule de 3 et une poule de 4. Demi-finales croisées entre les 1ers et 2es, puis finale et match pour la 3e place. Les 3es et le 4e jouent une poule de classement pour les places 5 à 7.':'Deux poules de 4. Les 1ers et 2es jouent les demi-finales croisées du tableau 1–4 ; les 3es et 4es celles du tableau 5–8. Matchs de classement pour toutes les places.';
 return {count,sizes,title:count<=5?'Poule unique':`2 poules de ${sizes.join(' et ')}`,description,poolMatches:sizes.reduce((n,s)=>n+s*(s-1)/2,0),totalMatches:count<=5?count*(count-1)/2:count===6?11:count===7?16:20};
}
// Circle rotation: every pair once, with at most one match per team in a round.
export function roundRobin(teams,prefix='A'){
 const rotation=[...teams];if(rotation.length%2)rotation.push(null);
 const rounds=[];for(let r=0;r<rotation.length-1;r++){const matches=[];for(let i=0;i<rotation.length/2;i++){const a=rotation[i],b=rotation[rotation.length-1-i];if(a!==null&&b!==null)matches.push({a,b,stage:`Poule ${prefix} · rotation ${r+1}`});}rounds.push(matches);rotation.splice(1,0,rotation.pop());}return rounds;
}
export function poolFixtures(groups){const rounds=groups.map((g,i)=>roundRobin(g,String.fromCharCode(65+i)));const result=[];for(let r=0;r<Math.max(...rounds.map(x=>x.length));r++)for(const pool of rounds)result.push(...(pool[r]||[]));return result;}
export function finalFixtures(count){
 if(count<=5)return [];
 const result=[{id:'DF1',a:'1er poule A',b:'2e poule B',stage:'Demi-finale 1 · places 1–4'},{id:'DF2',a:'1er poule B',b:'2e poule A',stage:'Demi-finale 2 · places 1–4'}];
 if(count===6)result.push({id:'P5',a:'3e poule A',b:'3e poule B',stage:'5e place'});
 if(count===7)for(const [a,b] of [['3e poule A','3e poule B'],['3e poule B','4e poule B'],['4e poule B','3e poule A']])result.push({a,b,stage:'Poule de classement · places 5–7'});
 if(count===8)result.push({id:'DC1',a:'3e poule A',b:'4e poule B',stage:'Demi-finale 1 · places 5–8'},{id:'DC2',a:'3e poule B',b:'4e poule A',stage:'Demi-finale 2 · places 5–8'},{a:'Perdant DC1',b:'Perdant DC2',stage:'7e place'},{a:'Vainqueur DC1',b:'Vainqueur DC2',stage:'5e place'});
 result.push({a:'Perdant DF1',b:'Perdant DF2',stage:'3e place'},{a:'Vainqueur DF1',b:'Vainqueur DF2',stage:'Finale · 1re place'});return result;
}
