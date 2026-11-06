-- Entire test is rolled back; set request.jwt.claim.sub to an authorized manager.
begin;
do $test$
declare team jsonb:='{"epreuve":"DD","p1FirstName":"Test","p1LastName":"Temporaire Un","p1Licence":"9999901Z","p2FirstName":"Test","p2LastName":"Temporaire Deux","p2Licence":"9999902Z"}';r jsonb;n int;before_state jsonb;before_plan text;before_results text;v int;i int;
begin
perform public.suzini_e3_club();
before_state:=public.suzini_e3_status();
select plan::text into before_plan from suzini_e3_private.match_planning where simulation=false;
select coalesce(jsonb_agg(to_jsonb(x))::text,'[]') into before_results from suzini_e3_private.match_results x where simulation=false;
update suzini_e3_private.registration_control set state='closed',deadline_override=false where singleton;
update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
update public.suzini_e3_controls set pages=array_remove(pages,'programmation.html') where id=true;
update suzini_e3_private.programmes set drawn_at=now(),draw_published_at=now() where division='DD';
select count(*) into n from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division='DD';
r:=public.suzini_e3_club_register(team);
if not (r->>'matches_maintenance')::boolean then raise exception 'Missing maintenance response';end if;
if not exists(select 1 from public.suzini_e3_controls where 'programmation.html'=any(pages)) then raise exception 'Maintenance not enabled';end if;
if (public.suzini_e3_status()->>'open')::boolean then raise exception 'Public registrations reopened';end if;
if exists(select 1 from suzini_e3_private.programmes where division='DD' and (drawn_at is not null or validated_at is not null)) then raise exception 'Old draw not invalidated';end if;
if (select count(*) from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003' and division='DD')<>n+1 then raise exception 'Team missing';end if;
begin perform public.suzini_e3_club_register(team);raise exception 'Duplicate accepted' using errcode='P9999';exception when sqlstate 'P9999' then raise;when others then null;end;
for i in 1..(7-n) loop
team:=team||jsonb_build_object('p1Licence',(9999903+2*i)::text||'Z','p2Licence',(9999904+2*i)::text||'Z');
perform public.suzini_e3_club_register(team);
end loop;
team:=team||jsonb_build_object('p1Licence','9999971Z','p2Licence','9999972Z');
begin perform public.suzini_e3_club_register(team);raise exception 'Ninth team accepted' using errcode='P9999';exception when sqlstate 'P9999' then raise;when others then null;end;
if before_plan is distinct from (select plan::text from suzini_e3_private.match_planning where simulation=false) then raise exception 'Existing plan modified';end if;
if before_results is distinct from (select coalesce(jsonb_agg(to_jsonb(x))::text,'[]') from suzini_e3_private.match_results x where simulation=false) then raise exception 'Existing scores modified';end if;
end;$test$;
select 'closed_club_add_maintenance_draw_invalidation_duplicates_capacity_scores_passed' as verification;
rollback;
