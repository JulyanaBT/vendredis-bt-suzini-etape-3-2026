CREATE OR REPLACE FUNCTION public.suzini_e3_programme()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select suzini_e3_private.draw_presentation(jsonb_build_object('registration_closed',(public.suzini_e3_status()->>'registration_state')='closed','registration_state',public.suzini_e3_status()->>'registration_state','draw_at','2026-11-05T17:00:00Z','divisions',(select jsonb_agg(jsonb_build_object('division',p.division,'count',(select count(*) from suzini_e3_private.active_teams t where t.event_id=e.id and t.division=p.division),'validated_count',p.team_count,'validated_at',p.validated_at,'drawn_at',p.drawn_at,'draw_published_at',p.draw_published_at,'pool_a',p.pool_a,'pool_b',p.pool_b,'draw_order',p.draw_order,'seeds',p.seeds) order by p.division) from suzini_e3_private.programmes p)) ) from public.events e where id='20261106-0000-4000-8000-000000000003';
$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_programme_manage(p_action text, p_division text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids uuid[];n integer;p suzini_e3_private.programmes;closed boolean;layout jsonb;begin
 perform public.suzini_e3_club('list');
 if p_division not in ('DM','DD') or p_division is null then raise exception 'Épreuve inconnue.';end if;
 select (public.suzini_e3_status()->>'registration_state')='closed' into closed from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 if not closed then raise exception 'Clôturez définitivement les inscriptions avant de valider le format. Une suspension ne suffit pas.';end if;
 select * into p from suzini_e3_private.programmes where division=p_division for update;
 select array_agg(id order by id),count(*) into ids,n from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
 if n<4 or n>8 then raise exception 'Il faut entre 4 et 8 équipes pour maintenir ce tableau.';end if;
 if exists(select 1 from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division and p1_rank is not null and p2_rank is not null and p1_rank::bigint+p2_rank::bigint<120) then raise exception 'Paire non admissible en BT250 : le poids doit être au moins égal à 120. Vérifiez les classements et la liste des équipes.';end if;
 if p_action='draw' and n in (4,5) then raise exception 'Quatre ou cinq équipes : poule unique sans tirage.';end if;
if p_action='validate' then
  if p.drawn_at is not null then raise exception 'Le tirage de ce tableau est déjà effectué.';end if;
  update suzini_e3_private.programmes set team_count=n,team_ids=ids,validated_at=now(),validated_by=auth.uid() where division=p_division;
 if n in (4,5) then update suzini_e3_private.programmes set pool_a=(select array_agg(id order by coalesce(p1_rank,999999)+coalesce(p2_rank,999999),id) from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division),pool_b='{}'::uuid[] where division=p_division;end if;
elsif p_action='draw' then
  
  if p.drawn_at is not null then raise exception 'Tirage déjà effectué.';end if;
  if p.validated_at is null or p.team_count<>n or p.team_ids is distinct from ids then raise exception 'Validez le format avec les équipes actuelles avant le tirage.';end if;
  if exists(select 1 from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division and (p1_rank is null or p2_rank is null or p1_rank<1 or p2_rank<1)) then raise exception 'Complétez les classements des joueurs avant le tirage des têtes de série.';end if;
  select array_agg(id order by (p1_rank::bigint+p2_rank::bigint),random()) into ids from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
  layout:=suzini_e3_private.seeded_layout(ids);
  update suzini_e3_private.programmes set
   seeds=array(select jsonb_array_elements_text(layout->'seeds')::uuid),
   pool_a=array(select jsonb_array_elements_text(layout->'pool_a')::uuid),
   pool_b=array(select jsonb_array_elements_text(layout->'pool_b')::uuid),
   draw_order=array(select jsonb_array_elements_text(layout->'draw_order')::uuid),
   drawn_at=now(),draw_published_at=null where division=p_division;
 else raise exception 'Action inconnue.';end if;
 return public.suzini_e3_programme();
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_draw_manage(p_action text, p_division text, p_simulation boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s suzini_e3_private.match_simulation;p suzini_e3_private.programmes;d jsonb;idx int;ids uuid[];n int;is_admin boolean;
begin
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
CREATE OR REPLACE FUNCTION public.suzini_e3_match_state(p_simulation boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare state jsonb; teams jsonb; ds jsonb:='[]';d jsonb; rs jsonb;ids jsonb;job jsonb;jobs jsonb;matches jsonb:='[]';a text;b text; division_code text;filtered jsonb;
begin
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
end;$function$
;