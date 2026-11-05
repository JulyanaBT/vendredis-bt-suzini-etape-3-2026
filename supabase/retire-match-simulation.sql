CREATE OR REPLACE FUNCTION public.suzini_e3_match_state(p_simulation boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare state jsonb; teams jsonb; ds jsonb:='[]';d jsonb; rs jsonb;ids jsonb;job jsonb;jobs jsonb;matches jsonb:='[]';a text;b text; division_code text;filtered jsonb;
begin
 p_simulation:=false;
 if p_simulation then perform public.suzini_e3_club();select programme,s.teams into state,teams from suzini_e3_private.match_simulation s where singleton is true;
 else state:=public.suzini_e3_programme();teams:=public.suzini_e3_teams();end if;
 state:=suzini_e3_private.draw_presentation(state);
 for d in select value from jsonb_array_elements(state->'divisions') loop
 division_code:=d->>'division';
 d:=d||jsonb_build_object('matches_ready',coalesce((state->>'registration_closed')::boolean,false) and
 ((d->>'count')::int in (4,5) or
 ((d->>'count')::int>=6 and coalesce((d->>'draw_public_complete')::boolean,false) and d->>'drawn_at' is not null)));
 if not coalesce((d->>'matches_ready')::boolean,false) then
 if not coalesce((state->>'registration_closed')::boolean,false) then
 d:=d||jsonb_build_object('pool_a','[]'::jsonb,'pool_b','[]'::jsonb,'draw_order','[]'::jsonb,'seeds','[]'::jsonb);
 end if;
 d:=d||jsonb_build_object('standings_a','[]'::jsonb,'standings_b','[]'::jsonb,'standings_c','[]'::jsonb);
 ds:=ds||jsonb_build_array(d);continue;
 end if;
 if (d->>'count')::int in (4,5) then
 if p_simulation then select jsonb_agg(value->>'id' order by (value->>'p1_rank')::int+(value->>'p2_rank')::int,value->>'id') into ids from jsonb_array_elements(teams) where value->>'division'=division_code;
 else select jsonb_agg(id order by coalesce(p1_rank,999999)+coalesce(p2_rank,999999),id) into ids from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=division_code;end if;
 if jsonb_array_length(coalesce(d->'pool_a','[]'))=(d->>'count')::int and d->>'validated_at' is not null then ids:=d->'pool_a';end if;
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
 if (d->>'count')::int=7 then
 select coalesce(jsonb_agg(case when r.winner=r.team_a then r.team_b else r.team_a end order by match_id),'[]') into ids from suzini_e3_private.match_results r where simulation=p_simulation and division=division_code and match_id in ('QF1','QF2','QF3');
 d:=d||jsonb_build_object('standings_c',suzini_e3_private.pool_table(ids,rs));
 end if;
 ds:=ds||jsonb_build_array(d);
 end loop;
 return state||jsonb_build_object('divisions',ds,'teams',teams,'matches',matches,'simulation',p_simulation,'server_now',now(),'planning',coalesce((select plan from suzini_e3_private.match_planning where simulation=p_simulation),'[]'::jsonb),'planning_revision',coalesce((select revision from suzini_e3_private.match_planning where simulation=p_simulation),0));
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_match_manager_state(p_simulation boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare state jsonb; teams jsonb; ds jsonb:='[]';d jsonb; rs jsonb;ids jsonb;job jsonb;jobs jsonb;matches jsonb:='[]';a text;b text; division_code text;filtered jsonb;
begin
 p_simulation:=false;
 perform public.suzini_e3_club();
 if p_simulation then perform public.suzini_e3_club();select programme,s.teams into state,teams from suzini_e3_private.match_simulation s where singleton is true;
 else state:=public.suzini_e3_programme();teams:=public.suzini_e3_teams();end if;
 if not p_simulation then
 state:=state||jsonb_build_object('divisions',(select jsonb_agg(jsonb_build_object('division',p.division,'count',(select count(*) from suzini_e3_private.active_teams t where t.event_id='20261106-0000-4000-8000-000000000003' and t.division=p.division),'validated_count',p.team_count,'validated_at',p.validated_at,'drawn_at',p.drawn_at,'draw_published_at',p.draw_published_at,'pool_a',p.pool_a,'pool_b',p.pool_b,'draw_order',p.draw_order,'seeds',p.seeds) order by p.division) from suzini_e3_private.programmes p));
 end if;
 state:=suzini_e3_private.draw_presentation(state||jsonb_build_object('draw_manager',true),now());
 for d in select value from jsonb_array_elements(state->'divisions') loop
 division_code:=d->>'division';
 d:=d||jsonb_build_object('matches_ready',coalesce((state->>'registration_closed')::boolean,false) and
 ((d->>'count')::int in (4,5) or
 ((d->>'count')::int>=6 and coalesce((d->>'draw_public_complete')::boolean,false) and d->>'drawn_at' is not null)));
 if not coalesce((d->>'matches_ready')::boolean,false) then
 if not coalesce((state->>'registration_closed')::boolean,false) then
 d:=d||jsonb_build_object('pool_a','[]'::jsonb,'pool_b','[]'::jsonb,'draw_order','[]'::jsonb,'seeds','[]'::jsonb);
 end if;
 d:=d||jsonb_build_object('standings_a','[]'::jsonb,'standings_b','[]'::jsonb,'standings_c','[]'::jsonb);
 ds:=ds||jsonb_build_array(d);continue;
 end if;
 if (d->>'count')::int in (4,5) then
 if p_simulation then select jsonb_agg(value->>'id' order by (value->>'p1_rank')::int+(value->>'p2_rank')::int,value->>'id') into ids from jsonb_array_elements(teams) where value->>'division'=division_code;
 else select jsonb_agg(id order by coalesce(p1_rank,999999)+coalesce(p2_rank,999999),id) into ids from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=division_code;end if;
 if jsonb_array_length(coalesce(d->'pool_a','[]'))=(d->>'count')::int and d->>'validated_at' is not null then ids:=d->'pool_a';end if;
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
 if (d->>'count')::int=7 then
 select coalesce(jsonb_agg(case when r.winner=r.team_a then r.team_b else r.team_a end order by match_id),'[]') into ids from suzini_e3_private.match_results r where simulation=p_simulation and division=division_code and match_id in ('QF1','QF2','QF3');
 d:=d||jsonb_build_object('standings_c',suzini_e3_private.pool_table(ids,rs));
 end if;
 ds:=ds||jsonb_build_array(d);
 end loop;
 return state||jsonb_build_object('divisions',ds,'teams',teams,'matches',matches,'simulation',p_simulation,'server_now',now(),'planning',coalesce((select plan from suzini_e3_private.match_planning where simulation=p_simulation),'[]'::jsonb),'planning_revision',coalesce((select revision from suzini_e3_private.match_planning where simulation=p_simulation),0));
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_draw_manage(p_action text, p_division text, p_simulation boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s suzini_e3_private.match_simulation;p suzini_e3_private.programmes;d jsonb;idx int;ids uuid[];n int;is_admin boolean;
begin
 if p_simulation then raise exception 'Les simulations sont terminées. Actualisez la page pour utiliser le tournoi réel.';end if;
perform public.suzini_e3_club();
is_admin:=exists(select 1 from public.organizers where user_id=auth.uid());
if p_division is null or p_division not in('DM','DD') then raise exception 'Épreuve inconnue.';end if;
if p_action not in('list','prepare','publish','reset') then raise exception 'Action inconnue.';end if;
if p_action='reset' and not is_admin then raise exception 'Réinitialisation réservée à l’administrateur.' using errcode='42501';end if;
if p_action='list' then return public.suzini_e3_match_manager_state(p_simulation);end if;
if p_simulation then
select * into s from suzini_e3_private.match_simulation where singleton is true for update;
select (ordinality-1)::int,value into idx,d from jsonb_array_elements(s.programme->'divisions') with ordinality where value->>'division'=p_division;
if p_action='prepare' then perform public.suzini_e3_match_simulation('validate',p_division);perform public.suzini_e3_match_simulation('draw',p_division);
elsif p_action='publish' then
if d->>'drawn_at' is null then raise exception 'Préparez le tirage avant de le diffuser.';end if;
if d->>'draw_published_at' is not null then raise exception 'Ce tirage a déjà été diffusé. Utilisez le replay.';end if;
update suzini_e3_private.match_simulation set programme=jsonb_set(programme,array['divisions',idx::text],d||jsonb_build_object('draw_published_at',now())),updated_at=now(),updated_by=auth.uid() where singleton is true;
else
d:=(d-'draw_started_at'-'draw_finished_at'-'draw_total'-'draw_reveal_count'-'draw_complete'-'draw_reveals')||jsonb_build_object('drawn_at',null,'draw_published_at',null,'pool_a','[]'::jsonb,'pool_b','[]'::jsonb,'draw_order','[]'::jsonb,'seeds','[]'::jsonb,'validated_at',null,'validated_count',null);
update suzini_e3_private.match_simulation set programme=jsonb_set(programme,array['divisions',idx::text],d),updated_at=now(),updated_by=auth.uid() where singleton is true;
end if;
else
if p_action in ('prepare','publish') and (public.suzini_e3_status()->>'registration_state') is distinct from 'closed' then raise exception 'Clôturez définitivement les inscriptions avant de préparer ou diffuser le tirage. Une suspension ne suffit pas.';end if;
select * into p from suzini_e3_private.programmes where division=p_division for update;
if p_action='prepare' then perform public.suzini_e3_programme_manage('validate',p_division);perform public.suzini_e3_programme_manage('draw',p_division);
elsif p_action='publish' then
if p.drawn_at is null then raise exception 'Préparez le tirage avant de le diffuser.';end if;
if p.draw_published_at is not null then raise exception 'Ce tirage a déjà été diffusé. Utilisez le replay.';end if;
if now()<'2026-11-05 17:00:00+00'::timestamptz then raise exception 'Diffusion prévue le 5 novembre à 14 h, heure de Guyane.';end if;
select array_agg(id order by id),count(*) into ids,n from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
if p.team_count<>n or p.team_ids is distinct from ids then raise exception 'Les équipes ont changé : demandez une réinitialisation avant de préparer un nouveau tirage.';end if;
update suzini_e3_private.programmes set draw_published_at=now() where division=p_division;
else
update suzini_e3_private.programmes set drawn_at=null,draw_published_at=null,pool_a='{}',pool_b='{}',draw_order='{}',seeds='{}',validated_at=null,validated_by=null,team_count=null,team_ids='{}' where division=p_division;
end if;
end if;
if p_action='reset' then
delete from suzini_e3_private.match_results where simulation=p_simulation and division=p_division;
update suzini_e3_private.match_planning mp set plan=(select coalesce(jsonb_agg(x),'[]'::jsonb) from jsonb_array_elements(mp.plan) x where x->>'division'<>p_division),revision=revision+1,updated_at=now(),updated_by=auth.uid() where simulation=p_simulation;
end if;
return public.suzini_e3_match_manager_state(p_simulation);
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_save_planning(p_simulation boolean, p_plan jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb;j jsonb;k jsonb;m jsonb; dep text;rev int;
begin
 if p_simulation then raise exception 'Les simulations sont terminées. Actualisez la page pour utiliser le tournoi réel.';end if;
perform public.suzini_e3_club();
insert into suzini_e3_private.match_planning(simulation) values(p_simulation) on conflict do nothing;
select revision into rev from suzini_e3_private.match_planning where simulation=p_simulation for update;
if rev<>p_revision then raise exception 'Le programme a changé. Actualisez avant de déplacer un match.';end if;
s:=public.suzini_e3_match_manager_state(p_simulation);
if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_array_length(p_plan)<>jsonb_array_length(s->'matches') then raise exception 'Programme incomplet.';end if;
for j in select value from jsonb_array_elements(p_plan) loop
if j->>'court' not in ('DM','DD') or j->>'court' is null or j->>'slot' !~ '^[0-9]{1,3}$' then raise exception 'Créneau invalide.';end if;
select value into m from jsonb_array_elements(s->'matches') where value->>'id'=j->>'id' and value->>'division'=j->>'division';
if m is null then raise exception 'Rencontre inconnue.';end if;
if (select count(*) from jsonb_array_elements(p_plan) where value->>'id'=j->>'id' and value->>'division'=j->>'division')<>1 then raise exception 'Rencontre dupliquée.';end if;
if j->>'forced_at' is not null then perform (j->>'forced_at')::timestamptz;end if;
for k in select value from jsonb_array_elements(p_plan) where (value->>'slot')::int=(j->>'slot')::int and value<>j loop
if k->>'court'=j->>'court' then raise exception 'Deux matchs occupent le même terrain au même créneau.';end if;
if exists(select 1 from jsonb_array_elements(s->'matches') other where other->>'division'=k->>'division' and other->>'id'=k->>'id' and (other->>'a' in(m->>'a',m->>'b') or other->>'b' in(m->>'a',m->>'b')) and m->>'a' ~ '^[0-9a-f-]{36}$') then raise exception 'Une équipe ne peut pas jouer deux matchs au même créneau.';end if;
end loop;
for dep in select value from jsonb_array_elements_text(m->'deps') loop
if exists(select 1 from jsonb_array_elements(p_plan) where value->>'division'=j->>'division' and value->>'id'=dep and (value->>'slot')::int >= (j->>'slot')::int) then raise exception 'Ce déplacement précède un match nécessaire au tour suivant.';end if;
end loop;
end loop;
update suzini_e3_private.match_planning set plan=p_plan,revision=revision+1,updated_by=auth.uid(),updated_at=now() where simulation=p_simulation;
return public.suzini_e3_match_manager_state(p_simulation);
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_validate_result(p_simulation boolean, p_division text, p_match text, p_score jsonb, p_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare state jsonb;d jsonb;m jsonb;s jsonb;st jsonb;va int;vb int;sa int:=0;sb int:=0;ga int:=0;gb int:=0;target int;super_a int;super_b int;w uuid;existing suzini_e3_private.match_results;dep text;
begin
 if p_simulation then raise exception 'Les simulations sont terminées. Actualisez la page pour utiliser le tournoi réel.';end if;
 perform public.suzini_e3_club();
 if p_division not in('DM','DD') or p_division is null then raise exception 'Tableau invalide.';end if;
 if p_simulation then perform 1 from suzini_e3_private.match_simulation where singleton is true for update;
 else perform 1 from suzini_e3_private.programmes where division=p_division for update;end if;
 state:=public.suzini_e3_match_manager_state(p_simulation);
 select value into d from jsonb_array_elements(state->'divisions') where value->>'division'=p_division;
 if not p_simulation and (public.suzini_e3_status()->>'open')::boolean then raise exception 'Clôturez les inscriptions avant de saisir les résultats réels.';end if;
 if not p_simulation and d->>'validated_at' is null then perform public.suzini_e3_programme_manage('validate',p_division);end if;
 select value into m from jsonb_array_elements(state->'matches') where value->>'division'=p_division and value->>'id'=p_match;
 if m is null or m->>'a' !~ '^[0-9a-f-]{36}$' or m->>'b' !~ '^[0-9a-f-]{36}$' then raise exception 'Les équipes de ce match ne sont pas encore déterminées.';end if;
 for dep in select value from jsonb_array_elements_text(m->'deps') loop
 if not exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=dep) then raise exception 'Validez d’abord les matchs précédents de cette phase.';end if;
 end loop;
 select * into existing from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=p_match for update;
 if coalesce(existing.revision,0)<>p_revision then raise exception 'Ce résultat a changé. Actualisez avant de le modifier.';end if;
 if existing.match_id is not null and exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id<>p_match and match_id not like 'POOL%' and match_id<>'TS-FINAL') then raise exception 'Un tour suivant est déjà joué. Faites corriger la progression par le juge-arbitre.';end if;
 if coalesce((p_score->>'override')::boolean,false) then
 if jsonb_typeof(p_score->'sets') is distinct from 'array' or jsonb_array_length(p_score->'sets') not between 1 and 3 then raise exception 'Renseignez les scores.';end if;
 for st in select value from jsonb_array_elements(p_score->'sets') loop
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,8}$' or st->>1 !~ '^[0-9]{1,8}$' then raise exception 'Scores entiers positifs ou nuls requis.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;ga:=ga+va;gb:=gb+vb;
 if va>vb then sa:=sa+1;elsif vb>va then sb:=sb+1;end if;
 end loop;
 if p_score ? 'super' then
 st:=p_score->'super';
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,8}$' or st->>1 !~ '^[0-9]{1,8}$' then raise exception 'Score du super tie-break invalide.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;
 if va>vb then sa:=sa+1;ga:=ga+1;elsif vb>va then sb:=sb+1;gb:=gb+1;end if;
 end if;
 if ga+gb=0 then raise exception 'Renseignez au moins un score.';end if;
 if p_score->>'winner' not in ('a','b') or p_score->>'winner' is null then raise exception 'Indiquez l’équipe gagnante.';end if;
 w:=case when p_score->>'winner'='a' then (m->>'a')::uuid else (m->>'b')::uuid end;
 else
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
 end if;
 if existing.match_id is not null then
 if (w<>existing.winner or ((d->>'count')::int=6 and m->>'phase'='poules')) and exists(
 with recursive affected as (
 select value as job from jsonb_array_elements(state->'matches') where value->>'division'=p_division and (value->'deps') ? p_match
 union
 select next_job.value from affected a cross join lateral jsonb_array_elements(state->'matches') next_job(value)
 where next_job.value->>'division'=p_division and (next_job.value->'deps') ? (a.job->>'id')
 )
 select 1 from affected a cross join lateral jsonb_array_elements(coalesce(state->'planning','[]')) plan(value)
 where plan.value->>'division'=p_division and plan.value->>'id'=a.job->>'id'
 and plan.value->>'started_at' is not null and a.job->'result'='null'::jsonb
 ) then raise exception 'Cette correction pourrait modifier les équipes d’un match déjà en cours. Contactez le juge-arbitre.';end if;
 p_score:=p_score||jsonb_build_object('corrected_at',now());
 end if;
 insert into suzini_e3_private.match_results(simulation,division,match_id,team_a,team_b,winner,score,sets_a,sets_b,games_a,games_b,validated_by) values(p_simulation,p_division,p_match,(m->>'a')::uuid,(m->>'b')::uuid,w,p_score,sa,sb,ga,gb,auth.uid())
 on conflict(simulation,division,match_id) do update set score=excluded.score,winner=excluded.winner,sets_a=excluded.sets_a,sets_b=excluded.sets_b,games_a=excluded.games_a,games_b=excluded.games_b,validated_by=auth.uid(),revision=match_results.revision+1;
 return public.suzini_e3_match_manager_state(p_simulation);
end;$function$;
create or replace function public.suzini_e3_match_simulation(p_action text default 'list',p_division text default null) returns jsonb language plpgsql security definer set search_path='' as $f$ begin perform public.suzini_e3_club();raise exception 'Les simulations sont terminées. Utilisez les participants réels.';end;$f$;