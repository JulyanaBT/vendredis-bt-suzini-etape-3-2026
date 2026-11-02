CREATE OR REPLACE FUNCTION suzini_e3_private.draw_presentation(p_state jsonb,p_now timestamptz DEFAULT now())
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path='' AS $$
declare d jsonb; ds jsonb:='[]'; ids jsonb; steps jsonb; visible_steps jsonb; step jsonb; started timestamptz; n int; total int; shown int; i int; team_id jsonb; label text;
begin
for d in select value from jsonb_array_elements(p_state->'divisions') loop
n:=(d->>'count')::int;
if n>=6 and d->>'drawn_at' is not null then
started:=(d->>'drawn_at')::timestamptz;total:=n-2;steps:='[]';visible_steps:='[]';
for i in 1..total loop
if n=6 then
team_id:=case when i<=2 then d->'pool_a'->i else d->'pool_b'->(i-2) end;
label:=case when i<=2 then 'Poule A · place '||(i+1)::text else 'Poule B · place '||(i-1)::text end;
else team_id:=d->'draw_order'->i;label:='Position '||(i+1)::text;end if;
step:=jsonb_build_object('team_id',team_id,'label',label,'number',i,'reveal_at',started+make_interval(secs=>60*i));
steps:=steps||jsonb_build_array(step);
if p_now>=started+make_interval(secs=>60*i) then visible_steps:=visible_steps||jsonb_build_array(step);end if;
end loop;
shown:=jsonb_array_length(visible_steps);
d:=d||jsonb_build_object('draw_started_at',started,'draw_finished_at',started+make_interval(secs=>60*total),'draw_total',total,'draw_reveal_count',shown,'draw_complete',shown=total,'draw_reveals',visible_steps);
if shown<total then d:=d||jsonb_build_object('drawn_at',null,'pool_a','[]'::jsonb,'pool_b','[]'::jsonb,'draw_order','[]'::jsonb);end if;
end if;
ds:=ds||jsonb_build_array(d);
end loop;
return p_state||jsonb_build_object('divisions',ds);
end;$$;
REVOKE ALL ON FUNCTION suzini_e3_private.draw_presentation(jsonb,timestamptz) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.suzini_e3_programme()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select suzini_e3_private.draw_presentation(jsonb_build_object('registration_closed',not registration_open or now()>='2026-11-05 00:00:00-03'::timestamptz,'draw_at','2026-11-05T17:00:00Z','divisions',(select jsonb_agg(jsonb_build_object('division',p.division,'count',(select count(*) from suzini_e3_private.active_teams t where t.event_id=e.id and t.division=p.division),'validated_count',p.team_count,'validated_at',p.validated_at,'drawn_at',p.drawn_at,'pool_a',p.pool_a,'pool_b',p.pool_b,'draw_order',p.draw_order,'seeds',p.seeds) order by p.division) from suzini_e3_private.programmes p)) ) from public.events e where id='20261106-0000-4000-8000-000000000003';
$function$;

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
