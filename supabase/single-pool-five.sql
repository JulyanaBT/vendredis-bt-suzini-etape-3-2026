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
 for d in select value from jsonb_array_elements(state->'divisions') loop
 division_code:=d->>'division';
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
 return state||jsonb_build_object('divisions',ds,'teams',teams,'matches',matches,'simulation',p_simulation,'server_now',now());
end;$function$;

CREATE OR REPLACE FUNCTION public.suzini_e3_programme_manage(p_action text, p_division text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ids uuid[];n integer;p suzini_e3_private.programmes;closed boolean;layout jsonb;begin
 perform public.suzini_e3_club('list');
 if p_division not in ('DM','DD') or p_division is null then raise exception 'Épreuve inconnue.';end if;
 select not registration_open or now()>='2026-11-05 00:00:00-03'::timestamptz into closed from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 if not closed then raise exception 'Fermez les inscriptions avant de valider le format.';end if;
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
  if now()<'2026-11-05 17:00:00+00'::timestamptz then raise exception 'Tirage prévu le 5 novembre à 14 h, heure de Guyane.';end if;
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
   drawn_at=now() where division=p_division;
 else raise exception 'Action inconnue.';end if;
 return public.suzini_e3_programme();
end;$function$;