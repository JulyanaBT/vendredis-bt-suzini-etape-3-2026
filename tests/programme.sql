begin;
do $test$
declare n int;i int;tid uuid;actor uuid;result jsonb;blocked boolean;
begin
 select user_id into actor from public.organizers limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
 select count(*) into n from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division='DM';
 for i in n+1..8 loop
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence)
 values('20261106-0000-4000-8000-000000000003','DM','TEST programme '||i,'Test'||i,'Programme',lpad((9900000+i*2)::text,7,'0')||'Z','Autre'||i,'Programme',lpad((9900001+i*2)::text,7,'0')||'Z') returning id into tid;
 end loop;
 blocked:=false;
 begin
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence)
 values('20261106-0000-4000-8000-000000000003','DM','TEST neuvieme','Neuvieme','Programme','9999998Z','NeuviemeBis','Programme','9999999Z');
 exception when raise_exception then if sqlerrm like '%8 équipes%' then blocked:=true;else raise;end if;end;
 if not blocked then raise exception 'Capacity guard failed';end if;
 update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
 result:=public.suzini_e3_programme_manage('validate','DM');
 if not exists(select 1 from suzini_e3_private.programmes where division='DM' and team_count=8 and cardinality(team_ids)=8 and validated_at is not null) then raise exception 'Validation failed';end if;
 blocked:=false;begin perform public.suzini_e3_programme_manage('draw','DM');exception when raise_exception then if sqlerrm like '%5 novembre%' then blocked:=true;else raise;end if;end;
 if not blocked then raise exception 'Early draw guard failed';end if;
 update public.events set registration_open=true where id='20261106-0000-4000-8000-000000000003';
 if exists(select 1 from suzini_e3_private.programmes where validated_at is not null) then raise exception 'Reopening invalidation failed';end if;
 update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
 perform public.suzini_e3_programme_manage('validate','DM');
 delete from public.bt250_teams where id=tid;
 if exists(select 1 from suzini_e3_private.programmes where division='DM' and validated_at is not null) then raise exception 'Roster invalidation failed';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin perform public.suzini_e3_programme_manage('validate','DM');raise exception 'Unauthorized validation permitted';exception when insufficient_privilege then null;end;
end;$test$;
rollback;
