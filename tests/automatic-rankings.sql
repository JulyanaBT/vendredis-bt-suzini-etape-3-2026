-- Run on an isolated transaction. Every fixture and temporary opening is rolled back.
begin;
create function pg_temp.ready_doc(d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;begin t:=public.suzini_e3_form_token();update suzini_e3_private.form_tokens set issued_at=clock_timestamp()-interval '3 seconds' where id=t;return d||jsonb_build_object('_guard',t);end;$$;
do $$declare ref suzini_e3_private.rankings; other suzini_e3_private.rankings; r jsonb; fixture uuid; fallback integer;begin
 select * into ref from suzini_e3_private.rankings where division='DM' and rank>1 order by rank,licence limit 1;
 r:=suzini_e3_private.resolve_ranking('DM',lpad(ref.licence,7,'0')||'A',upper(ref.first_name),lower(ref.last_name));
 if r->>'status'<>'matched' or (r->>'rank')::integer<>ref.rank then raise exception 'Matching failed';end if;
 r:=suzini_e3_private.resolve_ranking('DM',lpad(ref.licence,7,'0')||'A','FixtureDifferent','FixtureDifferent');
 if r->>'status'<>'conflict' or r->>'rank' is not null then raise exception 'Identity mismatch must clear rank';end if;
 r:=suzini_e3_private.resolve_ranking('DM','9999999Z',ref.first_name,ref.last_name);
 if r#>>'{issue,code}'<>'licence_mismatch' then raise exception 'Wrong licence with known name must be flagged';end if;
 r:=suzini_e3_private.resolve_ranking('DD',ref.licence,ref.first_name,ref.last_name);
 if r#>>'{issue,code}'<>'division_mismatch' then raise exception 'Wrong division must be flagged';end if;
 if suzini_e3_private.normalized_name('Maïté - D’ŒUVRE')<>suzini_e3_private.normalized_name('MAITE D OEUVRE') then raise exception 'Accent/spacing normalization failed';end if;
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence,p1_rank,p2_rank)
 values('20261106-0000-4000-8000-000000000003','DM','Fixture','FixtureUnique','FixtureUnique','9999999Z','FixtureOther','FixtureOther','9999998Z',5,6) returning id into fixture;
 select max_rank+1 into fallback from suzini_e3_private.ranking_sources where division='DM';
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=fallback and p2_rank=fallback and p1_rank_status='unlisted') then raise exception 'Fallback trigger failed';end if;
 update public.bt250_teams set p1_first_name=ref.first_name,p1_last_name=ref.last_name,p1_licence=lpad(ref.licence,7,'0')||'A',p1_rank=9999 where id=fixture;
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=ref.rank and p1_rank_status='matched') then raise exception 'Automatic recheck did not override manual rank';end if;
 update public.bt250_teams set p1_last_name='FixtureConflict' where id=fixture;
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank is null and p1_rank_status='conflict' and p1_rank_issue->>'code'='identity_mismatch') then raise exception 'Conflict trigger did not clear rank';end if;
 update public.bt250_teams set p1_last_name=ref.last_name where id=fixture;
 if not exists(select 1 from public.bt250_teams where id=fixture and p1_rank=ref.rank and p1_rank_status='matched' and p1_rank_issue is null) then raise exception 'Correction did not clear conflict';end if;
 if exists(select 1 from jsonb_array_elements(public.suzini_e3_teams()) t where t->>'id'=fixture::text and (t ? 'p1_licence' or t ? 'p1_rank_issue')) then raise exception 'Private information exposed';end if;
 if has_schema_privilege('anon','suzini_e3_private','USAGE') or has_table_privilege('authenticated','suzini_e3_private.rankings','SELECT') then raise exception 'Private reference accessible';end if;
 -- Exercise the real anonymous registration RPC with source data held in a local setting.
 select * into other from suzini_e3_private.rankings where division='DM' and licence<>ref.licence order by rank desc,licence limit 1;
 perform set_config('test.registration',jsonb_build_object('epreuve','DM','p1FirstName',ref.first_name,'p1LastName',ref.last_name,'p1Licence',lpad(ref.licence,7,'0')||'Z','p2FirstName',other.first_name,'p2LastName',other.last_name,'p2Licence',lpad(other.licence,7,'0')||'Z')::text,true);
 delete from public.bt250_teams where id=fixture;
end$$;
update public.events set registration_open=true where id='20261106-0000-4000-8000-000000000003';
update public.suzini_e3_controls set pages='{}';
select set_config('test.registration',pg_temp.ready_doc(current_setting('test.registration')::jsonb)::text,true);
set local role anon;
select public.suzini_e3_register(current_setting('test.registration')::jsonb) is not null as anonymous_registration_with_automatic_ranks;
reset role;
do $$begin if not exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and p1_licence=current_setting('test.registration')::jsonb->>'p1Licence' and p1_rank_status='matched' and p2_rank_status='matched') then raise exception 'Anonymous RPC did not assign ranks';end if;end$$;
rollback;
