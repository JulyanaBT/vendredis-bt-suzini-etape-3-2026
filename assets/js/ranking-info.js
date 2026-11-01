export function hasRankingConflict(team){return ['p1','p2'].some(p=>team[p+'_rank_status']==='conflict');}
export function rankingCounts(teams){const counts={matched:0,unlisted:0,conflict:0,pending:0,manual:0};for(const t of teams)for(const p of ['p1','p2']){const status=t[p+'_rank_status']||'pending';if(status in counts)counts[status]++;}return counts;}
export function createRankingDetails(team,onManualRank){
 const el=(tag,text,className)=>{const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;return n;};
 const details=el('details','','ranking-details');const conflict=hasRankingConflict(team);details.classList.toggle('rank-conflict',conflict);details.open=conflict;details.append(el('summary',conflict?'⚠ Incohérence de nom ou de licence':['p1','p2'].some(p=>team[p+'_rank_status']==='manual')?'Classement validé manuellement':'Classements automatiques · fichier importé'));
 for(const p of ['p1','p2']){const block=el('section','','ranking-player');const name=`${team[p+'_first_name']} ${team[p+'_last_name']}`;block.append(el('strong',name));const status=team[p+'_rank_status'],issue=team[p+'_rank_issue'];
  if(status==='conflict'||status==='manual'){block.append(el('p',`Licence saisie : ${team[p+'_licence']}`),el('p',issue?.message||(status==='manual'?'Valeur validée manuellement par le Club.':'Identité et licence à vérifier.')));
   for(const expected of issue?.matches||[]){block.append(el('p',`Dans le fichier : ${expected.first_name} ${expected.last_name} · licence ${expected.licence} · rang ${expected.rank} (${expected.division==='DD'?'dames':'messieurs'}, page ${expected.page}).`,'ranking-reference'));}
   block.append(el('p',status==='manual'?`Classement ${team[p+'_rank']} validé manuellement par le Club.`:'Classement laissé vide. Corrigez les informations ou saisissez un classement manuel.'));if(onManualRank){const button=el('button',status==='manual'?'Modifier le classement manuel':'Saisir le classement manuel','manual-rank-action');button.type='button';button.addEventListener('click',()=>onManualRank(team,p==='p1'?1:2));block.append(button);}
  }else if(status==='matched'){block.append(el('p',`Licence et nom reconnus · classement ${team[p+'_rank']}.`));}
  else if(status==='unlisted'){block.append(el('p',`Absent des documents · rang attribué ${team[p+'_rank']} (dernier rang ${team[p+'_rank']-1} + 1).`));}
  else block.append(el('p','Classement en attente de vérification.'));
  details.append(block);
 }
 return details;
}
