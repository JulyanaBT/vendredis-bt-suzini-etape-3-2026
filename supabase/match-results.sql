
create table suzini_e3_private.match_results(
 simulation boolean not null,division text not null check(division in('DM','DD')),match_id text not null,
 team_a uuid not null,team_b uuid not null,winner uuid not null,score jsonb not null,
 sets_a int not null,sets_b int not null,games_a int not null,games_b int not null,
 validated_at timestamptz not null default now(),validated_by uuid,revision int not null default 1,
 primary key(simulation,division,match_id),check(team_a<>team_b),check(winner in(team_a,team_b)));
alter table suzini_e3_private.match_results enable row level security;
revoke all on suzini_e3_private.match_results from public,anon,authenticated;
create function suzini_e3_private.pool_table(p_ids jsonb,p_results jsonb) returns jsonb language sql immutable set search_path='' as $f$
with ids as(select value::text as id from jsonb_array_elements_text(p_ids)),r as(select value x from jsonb_array_elements(p_results) where p_ids ? (value->>'team_a') and p_ids ? (value->>'team_b')),
stats as(select i.id,
 count(r.x) as played, count(r.x) filter(where r.x->>'winner'=i.id) as wins,
 coalesce(sum(case when r.x->>'winner'=i.id then 2 else 1 end),0)::int as points,
 coalesce(sum(case when r.x->>'team_a'=i.id then (r.x->>'sets_a')::int else (r.x->>'sets_b')::int end),0)::int as sw,
 coalesce(sum(case when r.x->>'team_a'=i.id then (r.x->>'sets_b')::int else (r.x->>'sets_a')::int end),0)::int as sl,
 coalesce(sum(case when r.x->>'team_a'=i.id then (r.x->>'games_a')::int else (r.x->>'games_b')::int end),0)::int as gw,
 coalesce(sum(case when r.x->>'team_a'=i.id then (r.x->>'games_b')::int else (r.x->>'games_a')::int end),0)::int as gl
 from ids i left join r on i.id in(r.x->>'team_a',r.x->>'team_b') group by i.id),
mini as(select s.*,coalesce((select sum(case when r.x->>'team_a'=s.id then (r.x->>'sets_a')::int-(r.x->>'sets_b')::int else (r.x->>'sets_b')::int-(r.x->>'sets_a')::int end) from r where s.id in(r.x->>'team_a',r.x->>'team_b') and exists(select 1 from stats other where other.id<>s.id and other.id in(r.x->>'team_a',r.x->>'team_b') and other.points=s.points and other.sw-other.sl=s.sw-s.sl and other.gw-other.gl=s.gw-s.gl)),0)::int as mini_sets,
 coalesce((select sum(case when r.x->>'team_a'=s.id then (r.x->>'games_a')::int-(r.x->>'games_b')::int else (r.x->>'games_b')::int-(r.x->>'games_a')::int end) from r where s.id in(r.x->>'team_a',r.x->>'team_b') and exists(select 1 from stats other where other.id<>s.id and other.id in(r.x->>'team_a',r.x->>'team_b') and other.points=s.points and other.sw-other.sl=s.sw-s.sl and other.gw-other.gl=s.gw-s.gl)),0)::int as mini_games from stats s),
ranked as(select *,dense_rank() over(order by points desc,sw-sl desc,gw-gl desc,mini_sets desc,mini_games desc) as position,count(*) over(partition by points,sw-sl,gw-gl,mini_sets,mini_games)>1 as tied from mini)
select coalesce(jsonb_agg(to_jsonb(ranked) order by position,id),'[]') from ranked;
$f$;
create function suzini_e3_private.match_jobs(d jsonb) returns jsonb language plpgsql immutable set search_path='' as $f$
declare n int:=(d->>'count')::int; jobs jsonb:='[]'; pools jsonb;rot text[];ln int;r int;i int;k int;g int;pair jsonb;last_pair jsonb;pool_jobs jsonb:='[]';pool_count int:=0;pooldeps jsonb; q int;ord jsonb;seed1 text;seed2 text;dep jsonb;
begin
 if n<4 or n>8 then return jobs;end if;
 if not coalesce((d->>'no_draw')::boolean,false) and d->>'drawn_at' is null then return jobs;end if;
 if n<=6 then
 pools:=jsonb_build_array(d->'pool_a');if n=6 then pools:=pools||jsonb_build_array(d->'pool_b');end if;
 for g in 0..jsonb_array_length(pools)-1 loop
 select array_agg(value) into rot from jsonb_array_elements_text(pools->g);
 if cardinality(rot)%2=1 then rot:=array_append(rot,null);end if;ln:=cardinality(rot);
 for r in 0..ln-2 loop
 for i in 1..ln/2 loop
 if rot[i] is not null and rot[ln+1-i] is not null then pool_jobs:=pool_jobs||jsonb_build_array(jsonb_build_object('a',rot[i],'b',rot[ln+1-i],'round',r,'group',g));end if;
 end loop;
 rot:=array[rot[1],rot[ln]]||rot[2:ln-1];
 end loop;
 end loop;
 for pair in select value from jsonb_array_elements(pool_jobs) order by (value->>'round')::int,(value->>'group')::int loop
 if n<=5 and (d->'seeds') ? (pair->>'a') and (d->'seeds') ? (pair->>'b') then last_pair:=pair;continue;end if;
 pool_count:=pool_count+1;jobs:=jobs||jsonb_build_array(jsonb_build_object('id','POOL'||pool_count,'a',pair->>'a','b',pair->>'b','stage','Poule '||chr(65+(pair->>'group')::int),'phase','poules','format',3,'deps','[]'::jsonb));
 end loop;
 select coalesce(jsonb_agg(value->>'id'),'[]') into pooldeps from jsonb_array_elements(jobs);
 if n<=5 then return jobs||jsonb_build_array(jsonb_build_object('id','TS-FINAL','a',last_pair->>'a','b',last_pair->>'b','stage','Poule unique · TS1 / TS2','phase','poules','format',3,'deps',pooldeps));end if;
 jobs:=jobs||jsonb_build_array(
 jsonb_build_object('id','DF1','a','1er poule A','b','2e poule B','stage','Demi-finale 1–4','phase','finales','format',3,'deps',pooldeps),
 jsonb_build_object('id','DF2','a','1er poule B','b','2e poule A','stage','Demi-finale 1–4','phase','finales','format',3,'deps',pooldeps),
 jsonb_build_object('id','P5','a','3e poule A','b','3e poule B','stage','5e place','phase','finales','format',3,'deps',pooldeps));
 else
 ord:=d->'draw_order';q:=case when n=7 then 3 else 4 end;
 for k in 0..q-1 loop jobs:=jobs||jsonb_build_array(jsonb_build_object('id','QF'||(k+1),'a',ord->> (k*2),'b',ord->> (k*2+1),'stage','Quart de finale','phase','quarts','format',3,'deps','[]'::jsonb));end loop;
 select jsonb_agg(value->>'id') into dep from jsonb_array_elements(jobs);
 jobs:=jobs||jsonb_build_array(
 jsonb_build_object('id','DF1','a','Vainqueur QF1','b','Vainqueur QF2','stage','Demi-finale 1–4','phase','finales','format',3,'deps',dep),
 jsonb_build_object('id','DF2','a','Vainqueur QF3','b',case when n=7 then ord->>6 else 'Vainqueur QF4' end,'stage','Demi-finale 1–4','phase','finales','format',3,'deps',dep));
 if n=7 then
 jobs:=jobs||jsonb_build_array(
 jsonb_build_object('id','C1','a','Perdant QF1','b','Perdant QF2','stage','Poule 5–7','phase','classement','format',3,'deps',dep),
 jsonb_build_object('id','C2','a','Perdant QF1','b','Perdant QF3','stage','Poule 5–7','phase','classement','format',3,'deps',dep),
 jsonb_build_object('id','C3','a','Perdant QF2','b','Perdant QF3','stage','Poule 5–7','phase','classement','format',3,'deps',dep));
 else
 jobs:=jobs||jsonb_build_array(
 jsonb_build_object('id','DC1','a','Perdant QF1','b','Perdant QF2','stage','Demi-finale 5–8','phase','finales','format',3,'deps',dep),
 jsonb_build_object('id','DC2','a','Perdant QF3','b','Perdant QF4','stage','Demi-finale 5–8','phase','finales','format',3,'deps',dep),
 jsonb_build_object('id','P7','a','Perdant DC1','b','Perdant DC2','stage','7e place','phase','finales','format',3,'deps','["DC1","DC2"]'::jsonb),
 jsonb_build_object('id','P5','a','Vainqueur DC1','b','Vainqueur DC2','stage','5e place','phase','finales','format',3,'deps','["DC1","DC2"]'::jsonb));
 end if;
 end if;
 return jobs||jsonb_build_array(
 jsonb_build_object('id','P3','a','Perdant DF1','b','Perdant DF2','stage','3e place','phase','finales','format',3,'deps','["DF1","DF2"]'::jsonb),
 jsonb_build_object('id','F','a','Vainqueur DF1','b','Vainqueur DF2','stage','Finale','phase','finales','format',4,'deps','["DF1","DF2"]'::jsonb));
end;$f$;
create function suzini_e3_private.resolve_opponent(label text,d jsonb,results jsonb) returns text language plpgsql immutable set search_path='' as $f$
declare r jsonb; rank int; pool jsonb; standings jsonb;
begin
 if label ~ '^[0-9a-f-]{36}$' then return label;end if;
 if label like 'Vainqueur %' or label like 'Perdant %' then
 select value into r from jsonb_array_elements(results) where value->>'match_id'=split_part(label,' ',2);
 if r is null then return label;end if;
 if label like 'Vainqueur %' then return r->>'winner';end if;
 return case when r->>'winner'=r->>'team_a' then r->>'team_b' else r->>'team_a' end;
 end if;
 if label ~ '^[123](er|e) poule [AB]$' then
 rank:=left(label,1)::int;pool:=case when right(label,1)='A' then d->'pool_a' else d->'pool_b' end;
 if (select count(*) from jsonb_array_elements(results) x where pool ? (x->>'team_a') and pool ? (x->>'team_b'))<>jsonb_array_length(pool)*(jsonb_array_length(pool)-1)/2 then return label;end if;
 standings:=suzini_e3_private.pool_table(pool,results);
 if exists(select 1 from jsonb_array_elements(standings) x where (x->>'tied')::boolean) then return label;end if;
 return standings->(rank-1)->>'id';
 end if;
 return label;
end;$f$;
create function public.suzini_e3_match_state(p_simulation boolean default false) returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare state jsonb; teams jsonb; ds jsonb:='[]';d jsonb; rs jsonb;ids jsonb;job jsonb;jobs jsonb;matches jsonb:='[]';a text;b text; division_code text;filtered jsonb;
begin
 if p_simulation then perform public.suzini_e3_club();select programme,s.teams into state,teams from suzini_e3_private.match_simulation s where singleton is true;
 else state:=public.suzini_e3_programme();teams:=public.suzini_e3_teams();end if;
 for d in select value from jsonb_array_elements(state->'divisions') loop
 division_code:=d->>'division';
 if (d->>'count')::int=4 then
 if p_simulation then select jsonb_agg(value->>'id' order by (value->>'p1_rank')::int+(value->>'p2_rank')::int,value->>'id') into ids from jsonb_array_elements(teams) where value->>'division'=division_code;
 else select jsonb_agg(id order by coalesce(p1_rank,999999)+coalesce(p2_rank,999999),id) into ids from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=division_code;end if;
 if jsonb_array_length(coalesce(d->'pool_a','[]'))=4 and d->>'validated_at' is not null then ids:=d->'pool_a';end if;
 d:=d||jsonb_build_object('no_draw',true,'pool_a',ids,'pool_b','[]'::jsonb,'seeds',jsonb_build_array(ids->0,ids->1));
 end if;
 select coalesce(jsonb_agg(to_jsonb(r)-'validated_by' order by validated_at),'[]') into rs from suzini_e3_private.match_results r where simulation=p_simulation and division=division_code;
 jobs:=suzini_e3_private.match_jobs(d);filtered:='[]';
 for job in select value from jsonb_array_elements(jobs) loop
 a:=suzini_e3_private.resolve_opponent(job->>'a',d,rs);b:=suzini_e3_private.resolve_opponent(job->>'b',d,rs);
 job:=job||jsonb_build_object('a',a,'b',b,'division',division_code);
 select to_jsonb(r)-'validated_by' into filtered from suzini_e3_private.match_results r where simulation=p_simulation and division=division_code and match_id=job->>'id' and team_a::text=a and team_b::text=b;
 job:=job||jsonb_build_object('result',filtered);
 matches:=matches||jsonb_build_array(job);
 end loop;
 d:=d||jsonb_build_object('standings_a',suzini_e3_private.pool_table(coalesce(d->'pool_a','[]'),rs),'standings_b',suzini_e3_private.pool_table(coalesce(d->'pool_b','[]'),rs));
 ds:=ds||jsonb_build_array(d);
 end loop;
 return state||jsonb_build_object('divisions',ds,'teams',teams,'matches',matches,'simulation',p_simulation,'server_now',now());
end;$f$;
revoke all on function public.suzini_e3_match_state(boolean) from public;
grant execute on function public.suzini_e3_match_state(boolean) to anon,authenticated;
create function public.suzini_e3_validate_result(p_simulation boolean,p_division text,p_match text,p_score jsonb,p_revision int default 0) returns jsonb language plpgsql security definer set search_path='' as $f$
declare state jsonb;d jsonb;m jsonb;s jsonb;st jsonb;va int;vb int;sa int:=0;sb int:=0;ga int:=0;gb int:=0;target int;super_a int;super_b int;w uuid;existing suzini_e3_private.match_results;dep text;
begin
 perform public.suzini_e3_club();
 if p_division not in('DM','DD') or p_division is null then raise exception 'Tableau invalide.';end if;
 if p_simulation then perform 1 from suzini_e3_private.match_simulation where singleton is true for update;
 else perform 1 from suzini_e3_private.programmes where division=p_division for update;end if;
 state:=public.suzini_e3_match_state(p_simulation);
 select value into d from jsonb_array_elements(state->'divisions') where value->>'division'=p_division;
 if not p_simulation and ((public.suzini_e3_status()->>'open')::boolean or d->>'validated_at' is null) then raise exception 'Clôturez les inscriptions et validez le format avant de saisir les résultats réels.';end if;
 select value into m from jsonb_array_elements(state->'matches') where value->>'division'=p_division and value->>'id'=p_match;
 if m is null or m->>'a' !~ '^[0-9a-f-]{36}$' or m->>'b' !~ '^[0-9a-f-]{36}$' then raise exception 'Les équipes de ce match ne sont pas encore déterminées.';end if;
 for dep in select value from jsonb_array_elements_text(m->'deps') loop
 if not exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=dep) then raise exception 'Validez d’abord les matchs précédents de cette phase.';end if;
 end loop;
 select * into existing from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=p_match for update;
 if coalesce(existing.revision,0)<>p_revision then raise exception 'Ce résultat a changé. Actualisez avant de le modifier.';end if;
 if existing.match_id is not null and exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id<>p_match and match_id not like 'POOL%' and match_id<>'TS-FINAL') then raise exception 'Un tour suivant est déjà joué. Faites corriger la progression par le juge-arbitre.';end if;
 if jsonb_typeof(p_score->'sets') is distinct from 'array' or jsonb_array_length(p_score->'sets')<>2 then raise exception 'Renseignez les deux sets.';end if;
 target:=case when (m->>'format')::int=4 then 6 else 4 end;
 for st in select value from jsonb_array_elements(p_score->'sets') loop
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,2}$' or st->>1 !~ '^[0-9]{1,2}$' then raise exception 'Score de set invalide.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;
 if not ((greatest(va,vb)=target and least(va,vb)<=target-2) or (greatest(va,vb)=target+1 and least(va,vb) in(target-1,target))) then raise exception 'Set incomplet ou incompatible avec le format de match.';end if;
 if va>vb then sa:=sa+1;else sb:=sb+1;end if;ga:=ga+va;gb:=gb+vb;
 end loop;
 if sa=1 and sb=1 then
 if jsonb_typeof(p_score->'super') is distinct from 'array' or jsonb_array_length(p_score->'super')<>2 or p_score->'super'->>0 !~ '^[0-9]{1,3}$' or p_score->'super'->>1 !~ '^[0-9]{1,3}$' then raise exception 'À un set partout, renseignez le super tie-break.';end if;
 super_a:=(p_score->'super'->>0)::int;super_b:=(p_score->'super'->>1)::int;
 if not ((greatest(super_a,super_b)=10 and least(super_a,super_b)<=8) or (greatest(super_a,super_b)>10 and abs(super_a-super_b)=2)) then raise exception 'Super tie-break : 10 points minimum et deux points d’écart.';end if;
 if super_a>super_b then sa:=sa+1;ga:=ga+1;else sb:=sb+1;gb:=gb+1;end if;
 elsif p_score ? 'super' and p_score->'super'<>'null'::jsonb then raise exception 'Pas de super tie-break après deux sets gagnés.';end if;
 w:=case when sa>sb then (m->>'a')::uuid else (m->>'b')::uuid end;
 insert into suzini_e3_private.match_results(simulation,division,match_id,team_a,team_b,winner,score,sets_a,sets_b,games_a,games_b,validated_by) values(p_simulation,p_division,p_match,(m->>'a')::uuid,(m->>'b')::uuid,w,p_score,sa,sb,ga,gb,auth.uid())
 on conflict(simulation,division,match_id) do update set score=excluded.score,winner=excluded.winner,sets_a=excluded.sets_a,sets_b=excluded.sets_b,games_a=excluded.games_a,games_b=excluded.games_b,validated_at=now(),validated_by=auth.uid(),revision=match_results.revision+1;
 return public.suzini_e3_match_state(p_simulation);
end;$f$;
revoke all on function public.suzini_e3_validate_result(boolean,text,text,jsonb,integer) from public,anon;
grant execute on function public.suzini_e3_validate_result(boolean,text,text,jsonb,integer) to authenticated;
revoke all on function suzini_e3_private.pool_table(jsonb,jsonb),suzini_e3_private.match_jobs(jsonb),suzini_e3_private.resolve_opponent(text,jsonb,jsonb) from public,anon,authenticated;
