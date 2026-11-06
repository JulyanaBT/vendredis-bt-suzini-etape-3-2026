-- Run with a valid manager user in request.jwt.claim.sub. All changes are rolled back.
begin;
do $test$
declare s jsonb;p jsonb;n jsonb;real_before text;results_before text;
begin
perform public.suzini_e3_club();
select md5(plan::text) into real_before from suzini_e3_private.match_planning where simulation=false;
select md5(coalesce(jsonb_agg(to_jsonb(r))::text,'[]')) into results_before from suzini_e3_private.match_results r where simulation=false;
s:=public.suzini_e3_demo('reset');
if not (s->>'simulation')::boolean then raise exception 'Demo mode missing';end if;
if s->'teams' is distinct from public.suzini_e3_teams() then raise exception 'Teams not copied';end if;
p:=jsonb_set(s->'planning','{0,started_at}',to_jsonb(now()));
n:=public.suzini_e3_save_planning(true,p,(s->>'planning_revision')::int);
n:=public.suzini_e3_validate_result(true,'DM','POOL1','{"sets":[[4,0],[4,0]]}'::jsonb,0);
if not exists(select 1 from suzini_e3_private.match_results where simulation=true and division='DM' and match_id='POOL1') then raise exception 'Demo score not saved';end if;
if real_before is distinct from (select md5(plan::text) from suzini_e3_private.match_planning where simulation=false) then raise exception 'Real planning modified';end if;
if results_before is distinct from (select md5(coalesce(jsonb_agg(to_jsonb(r))::text,'[]')) from suzini_e3_private.match_results r where simulation=false) then raise exception 'Real results modified';end if;
if (public.suzini_e3_match_state(true)->>'simulation')::boolean then raise exception 'Demo leaked publicly';end if;
s:=public.suzini_e3_demo('reset');
if exists(select 1 from suzini_e3_private.match_results where simulation=true) then raise exception 'Reset retained demo results';end if;
end;$test$;
rollback;
