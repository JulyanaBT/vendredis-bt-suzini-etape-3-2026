export const displayFirstName=value=>String(value??'').trim().toLocaleLowerCase('fr-FR').replace(/(^|[\s’'\-])(\p{L})/gu,(_,sep,c)=>sep+c.toLocaleUpperCase('fr-FR'));
export const displayPlayerName=(last,first)=>`${String(last??'').trim().toLocaleUpperCase('fr-FR')} ${displayFirstName(first)}`.trim();
export function individualRank(value){return Number.isInteger(value)&&value>0?value:null;}
export function teamRank(team){const a=individualRank(team.p1_rank),b=individualRank(team.p2_rank);return a===null||b===null?null:a+b;}
export function rankTeams(teams){return [...teams].sort((a,b)=>{const ar=teamRank(a),br=teamRank(b);if(ar===null&&br!==null)return 1;if(br===null&&ar!==null)return -1;return (ar??0)-(br??0);});}
export function createTeamCard(team,index){
 const el=(tag,text,className)=>{const node=document.createElement(tag);node.textContent=text;if(className)node.className=className;return node;};
 const card=el('article','','team-card'),left=el('div','','team-left'),title=el('h2','','team-line1');title.append(el('span','#'+index,'team-num'),el('span',team.team_name||`${team.player1||'Joueur 1'} / ${team.player2||'Joueur 2'}`,'team-name'));left.append(title);
 for(const [name,rank] of [[team.p1_last_name?displayPlayerName(team.p1_last_name,team.p1_first_name):team.player1_name||team.player1||'Joueur 1',team.p1_rank],[team.p2_last_name?displayPlayerName(team.p2_last_name,team.p2_first_name):team.player2_name||team.player2||'Joueur 2',team.p2_rank]])left.append(el('p',`${name} (${individualRank(rank)??'—'})`,'team-player'));
 const total=teamRank(team),badge=el('div','','team-rank');badge.setAttribute('aria-label','Classement global : '+(total??'non renseigné'));badge.append(el('small','GLOBAL'),el('strong',total??'—'));card.append(left,badge);return card;
}
