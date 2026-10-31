export function hasRankingConflict(team){return ['p1','p2'].some(p=>team[p+'_rank_status']==='conflict');}
export function rankingCounts(teams){const counts={matched:0,unlisted:0,conflict:0,pending:0};for(const t of teams)for(const p of ['p1','p2']){const status=t[p+'_rank_status']||'pending';if(status in counts)counts[status]++;}return counts;}
export function createRankingDetails(team){
 const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
 const details=el('details','','ranking-details');const conflict=hasRankingConflict(team);details.classList.toggle('rank-conflict',conflict);details.open=conflict;details.append(el('summary',conflict?'⚠ Incohérence de nom ou de licence':'Classements automatiques · Octobre 2026'));
 for(const p of ['p1','p2']){const block=el('section','','ranking-player');const name=`${team[p+'_first_name']} ${team[p+'_last_name']}`;block.append(el('strong',name));const status=team[p+'_rank_status'],issue=team[p+'_rank_issue'];
  if(status==='conflict'){block.append(el('p',`Licence saisie : ${team[p+'_licence']}`),el('p',issue?.message||'Identité et licence à vérifier.'));
   for(const expected of issue?.matches||[]){block.append(el('p',`Dans le fichier : ${expected.first_name} ${expected.last_name} · licence ${expected.licence} · rang ${expected.rank} (${expected.division==='DD'?'dames':'messieurs'}, page ${expected.page}).`,'ranking-reference'));}
   block.append(el('p','Classement laissé vide. Corrigez les informations avec « Modifier » pour relancer la vérification.'));
  }else if(status==='matched'){block.append(el('p',`Licence et nom reconnus · classement ${team[p+'_rank']}.`));}
  else if(status==='unlisted'){block.append(el('p',`Absent des documents · rang attribué ${team[p+'_rank']} (dernier rang ${team[p+'_rank']-1} + 1).`));}
  else block.append(el('p','Classement en attente de vérification.'));
  details.append(block);
 }
 return details;
}
