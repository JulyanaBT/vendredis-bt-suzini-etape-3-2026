export const COURTS={DM:{name:'🐝 Manon Queen Bee',className:'court-manon'},DD:{name:'🌶️ Lisa de los pimentos',className:'court-lisa'}};
export const MATCH_MINUTES=25, TRANSITION_MINUTES=5;
export function formatFor(count){
 if(!Number.isInteger(count)||count<3||count>8)return null;
 const sizes=count<=5?[count]:count===6?[3,3]:[];
 const description=count<=5?'Une poule unique : chaque équipe rencontre toutes les autres. Le classement de la poule constitue le classement final.':count===6?'Deux poules de 3. Demi-finales croisées entre les 1ers et 2es, puis finale et match pour la 3e place. Les deux 3es jouent la 5e place.':count===7?'Trois quarts de finale et une équipe exemptée de quart, désignée au tirage. Les quatre qualifiés jouent les places 1 à 4. Les trois perdants des quarts disputent une poule pour les places 5 à 7. Trois matchs par équipe, sauf l’équipe exemptée qui en joue deux.':'Quatre quarts de finale. Les gagnants jouent les places 1 à 4 ; les perdants les places 5 à 8. Demi-finales et matchs de classement dans les deux branches : trois matchs par équipe.';
 return {count,sizes,title:count<=5?'Poule unique':count===6?'2 poules de 3':'Quarts et matchs de classement',description,poolMatches:sizes.reduce((n,s)=>n+s*(s-1)/2,0),totalMatches:count<=5?count*(count-1)/2:count===6?11:count===7?10:12};
}
export function roundRobin(teams,prefix='A'){
 const rotation=[...teams];if(rotation.length%2)rotation.push(null);
 const rounds=[];for(let r=0;r<rotation.length-1;r++){const matches=[];for(let i=0;i<rotation.length/2;i++){const a=rotation[i],b=rotation[rotation.length-1-i];if(a!==null&&b!==null)matches.push({a,b,stage:`Poule ${prefix} · rotation ${r+1}`});}rounds.push(matches);rotation.splice(1,0,rotation.pop());}return rounds;
}
export function poolFixtures(groups){if(!groups.length)return [];const rounds=groups.map((g,i)=>roundRobin(g,String.fromCharCode(65+i)));const result=[];for(let r=0;r<Math.max(...rounds.map(x=>x.length));r++)for(const pool of rounds)result.push(...(pool[r]||[]));return result;}
export function groupsFor(d){const f=formatFor(d.count);if(!f)return [];return d.drawn_at&&d.count<=6?[d.pool_a,...(d.count===6?[d.pool_b]:[])]:f.sizes.map((size,i)=>Array.from({length:size},(_,n)=>`${String.fromCharCode(65+i)}${n+1}`));}
export function fixturesFor(d){
 const f=formatFor(d.count);if(!f)return [];
 const jobs=[],add=(id,a,b,stage,deps=[],phase='finales')=>jobs.push({id,a,b,stage,deps,phase});
 if(d.count<=6){
  const pool=poolFixtures(groupsFor(d));pool.forEach((m,i)=>add('POOL'+(i+1),m.a,m.b,m.stage,[],'poules'));
  if(d.count<=5)return jobs;
  const deps=jobs.map(m=>m.id);
  add('DF1','1er poule A','2e poule B','Demi-finale · places 1–4',deps);
  add('DF2','1er poule B','2e poule A','Demi-finale · places 1–4',deps);
  add('P5','3e poule A','3e poule B','5e place',deps);
 }else{
  const order=d.drawn_at?d.draw_order:Array.from({length:d.count},(_,i)=>'T'+(i+1));
  const q=d.count===7?3:4;
  for(let i=0;i<q;i++)add('QF'+(i+1),order[i*2],order[i*2+1],'Quart de finale',[],'quarts');
  const deps=jobs.map(m=>m.id);
  add('DF1','Vainqueur QF1','Vainqueur QF2','Demi-finale · places 1–4',deps);
  add('DF2','Vainqueur QF3',d.count===7?order[6]:'Vainqueur QF4','Demi-finale · places 1–4',deps);
  if(d.count===7){
   [['Perdant QF1','Perdant QF2'],['Perdant QF1','Perdant QF3'],['Perdant QF2','Perdant QF3']].forEach(([a,b],i)=>add('C'+(i+1),a,b,'Poule de classement · places 5–7',deps,'classement'));
  }else{
   add('DC1','Perdant QF1','Perdant QF2','Demi-finale · places 5–8',deps);
   add('DC2','Perdant QF3','Perdant QF4','Demi-finale · places 5–8',deps);
   add('P7','Perdant DC1','Perdant DC2','7e place',['DC1','DC2']);
   add('P5','Vainqueur DC1','Vainqueur DC2','5e place',['DC1','DC2']);
  }
 }
 add('P3','Perdant DF1','Perdant DF2','3e place',['DF1','DF2']);
 add('F','Vainqueur DF1','Vainqueur DF2','Finale · 1re place',['DF1','DF2']);return jobs;
}
// Deterministic forecast: one court per draw until the other has finished.
// Each slot closes before the next begins; dependent matches cannot overlap.
export function scheduleDraws(divisions){
 const types=['DM','DD'],plans=Object.fromEntries(types.map(v=>[v,fixturesFor(divisions.find(d=>d.division===v)||{count:0})]));
 const done={DM:new Set(),DD:new Set()},result=[];
 for(let slot=0;slot<80;slot++){
  const remaining=Object.fromEntries(types.map(v=>[v,plans[v].filter(m=>!done[v].has(m.id))]));
  if(!remaining.DM.length&&!remaining.DD.length)return result;
  const batch=[];
  for(const v of types){
   const other=v==='DM'?'DD':'DM';if(!remaining[v].length)continue;
   const ready=remaining[v].filter(m=>m.deps.every(id=>done[v].has(id)));
   let selected=ready.slice(0,1);
   if(plans[other].length&&!remaining[other].length){
    outer:for(let i=0;i<ready.length;i++)for(let j=i+1;j<ready.length;j++)if(![ready[i].a,ready[i].b].some(t=>[ready[j].a,ready[j].b].includes(t))){selected=[ready[i],ready[j]];break outer;}
   }
   selected.forEach((m,i)=>batch.push({...m,division:v,slot,court:i===0?v:other}));
  }
  if(!batch.length)throw Error('Programme incohérent');
  for(const m of batch){done[m.division].add(m.id);result.push(m);}
 }
 throw Error('Programme trop long');
}
export function slotFor(index){
 if(!Number.isInteger(index)||index<0)throw new RangeError('Créneau invalide');
 const start=18*60+index*(MATCH_MINUTES+TRANSITION_MINUTES),end=start+MATCH_MINUTES;
 const label=minutes=>`${String(Math.floor(minutes/60)%24).padStart(2,'0')} h ${String(minutes%60).padStart(2,'0')}`;
 return {start:label(start),end:label(end),day:Math.floor(start/1440),endDay:Math.floor(end/1440),date:Math.floor(start/1440)>0?'sam. 7 nov.':'ven. 6 nov.'};
}
