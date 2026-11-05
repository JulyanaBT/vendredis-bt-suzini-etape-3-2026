export function exchangeMatchSlots(plan,source,target,matches){
 if(source.division!==target.division)throw Error('Choisissez un match de la même épreuve.');
 if(source.id==='TS-FINAL'||target.id==='TS-FINAL')throw Error('Le dernier match est réservé à TS1 contre TS2.');
 if(source.id===target.id)throw Error('Choisissez un autre match.');
 for(const ref of [source,target]){
 const match=matches.find(m=>m.id===ref.id&&m.division===ref.division);
 if(!match)throw Error('Rencontre introuvable.');
 if(match.result||match.started_at)throw Error('Un match lancé ou terminé ne peut plus être inversé.');
 }
 const next=plan.map(p=>({...p})),a=next.find(p=>p.id===source.id&&p.division===source.division),b=next.find(p=>p.id===target.id&&p.division===target.division);
 if(!a||!b)throw Error('Créneau introuvable.');
 const pa={slot:a.slot,court:a.court,forced_at:a.forced_at},pb={slot:b.slot,court:b.court,forced_at:b.forced_at};
 for(const [match,position] of [[a,pb],[b,pa]]){
 match.slot=position.slot;match.court=position.court;delete match.forced_at;if(position.forced_at)match.forced_at=position.forced_at;
 }
 return next;
}
