begin;do $test$ declare n int;i int;actor uuid;tid uuid;blocked boolean:=false;l1 text;l2 text;begin
select user_id into actor from public.organizers limit 1;perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
select count(*) into n from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division='DM';
for i in n+1..4 loop insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence,p1_rank_override,p2_rank_override)
values('20261106-0000-4000-8000-000000000003','DM','TEST poids','Test','Poids',lpad((9900000+i*2)::text,7,'0')||'Z','Autre','Poids',lpad((9900001+i*2)::text,7,'0')||'Z',600,600) returning id into tid;end loop;
select licence into l1 from suzini_e3_private.rankings where division='DM' order by rank,licence limit 1;
select licence into l2 from suzini_e3_private.rankings where division='DM' and licence<>l1 order by rank,licence limit 1;
update public.bt250_teams set p1_licence=l1||'Z',p2_licence=l2||'Z' where id=tid;
update public.bt250_teams set p1_rank_override=60,p2_rank_override=59,p1_rank=60,p2_rank=59 where id=tid;
if not exists(select 1 from public.bt250_teams where id=tid and p1_rank+p2_rank=119) then raise exception 'Fixture ranks not applied';end if;
update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
begin perform public.suzini_e3_programme_manage('validate','DM');exception when raise_exception then if sqlerrm like '%120%' then blocked:=true;else raise;end if;end;
if not blocked then raise exception 'Weight 119 must be rejected';end if;
update public.bt250_teams set p2_rank_override=60,p2_rank=60 where id=tid;perform public.suzini_e3_programme_manage('validate','DM');
end;$test$;rollback;
