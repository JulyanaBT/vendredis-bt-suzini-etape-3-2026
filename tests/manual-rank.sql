begin;
do $$declare r suzini_e3_private.rankings; fixture uuid; actor uuid;begin
 select * into r from suzini_e3_private.rankings where division='DM' order by rank limit 1;
 select user_id into actor from public.organizers limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence)
 values('20261106-0000-4000-8000-000000000003','DM','Fixture','FixtureWrong','FixtureWrong',lpad(r.licence,7,'0')||'Z','FixtureOther','FixtureOther','9999999Z') returning id into fixture;
 perform public.suzini_e3_manual_rank(fixture,1,333);
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=333 and p1_rank_status='manual' and p1_rank_override_by=actor and p1_rank_issue is not null) then raise exception 'Manual override or audit failed';end if;
 update public.bt250_teams set payment_received=true where id=fixture;
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=333 and p1_rank_status='manual') then raise exception 'Manual rank lost on unrelated update';end if;
 perform public.suzini_e3_manual_rank(fixture,1,null);
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank is null and p1_rank_status='conflict' and p1_rank_override is null) then raise exception 'Reset to automatic failed';end if;
 perform public.suzini_e3_manual_rank(fixture,1,444);
 update public.bt250_teams set p1_first_name=r.first_name,p1_last_name=r.last_name where id=fixture;
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=r.rank and p1_rank_status='matched' and p1_rank_override is null) then raise exception 'Identity correction did not reset override';end if;
 begin perform public.suzini_e3_manual_rank(fixture,1,123);raise exception 'TEST FAILED matched override';exception when raise_exception then if sqlerrm<>'Le classement manuel est réservé aux incohérences.' then raise;end if;end;
 perform set_config('request.jwt.claims','{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}',true);
 begin perform public.suzini_e3_manual_rank(fixture,1,123);raise exception 'TEST FAILED unauthorized';exception when insufficient_privilege then null;end;
end$$;
rollback;
