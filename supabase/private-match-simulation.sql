
create table suzini_e3_private.match_simulation(singleton boolean primary key default true check(singleton),teams jsonb not null,programme jsonb not null,updated_at timestamptz not null default now(),updated_by uuid);
alter table suzini_e3_private.match_simulation enable row level security;
revoke all on suzini_e3_private.match_simulation from public,anon,authenticated;
insert into suzini_e3_private.match_simulation(singleton,teams,programme) values(true,(select jsonb_agg(value||jsonb_build_object('id',gen_random_uuid())) from jsonb_array_elements($teams$[{"id":"","division":"DM","p1_first_name":"A1","p1_last_name":"M","p2_first_name":"B1","p2_last_name":"M","team_name":"A1 M. / B1 M.","p1_rank":1100,"p2_rank":1100},{"id":"","division":"DM","p1_first_name":"A2","p1_last_name":"M","p2_first_name":"B2","p2_last_name":"M","team_name":"A2 M. / B2 M.","p1_rank":1200,"p2_rank":1200},{"id":"","division":"DM","p1_first_name":"A3","p1_last_name":"M","p2_first_name":"B3","p2_last_name":"M","team_name":"A3 M. / B3 M.","p1_rank":1300,"p2_rank":1300},{"id":"","division":"DM","p1_first_name":"A4","p1_last_name":"M","p2_first_name":"B4","p2_last_name":"M","team_name":"A4 M. / B4 M.","p1_rank":1400,"p2_rank":1400},{"id":"","division":"DD","p1_first_name":"F1","p1_last_name":"F","p2_first_name":"G1","p2_last_name":"F","team_name":"F1 F. / G1 F.","p1_rank":1100,"p2_rank":1100},{"id":"","division":"DD","p1_first_name":"F2","p1_last_name":"F","p2_first_name":"G2","p2_last_name":"F","team_name":"F2 F. / G2 F.","p1_rank":1200,"p2_rank":1200},{"id":"","division":"DD","p1_first_name":"F3","p1_last_name":"F","p2_first_name":"G3","p2_last_name":"F","team_name":"F3 F. / G3 F.","p1_rank":1300,"p2_rank":1300},{"id":"","division":"DD","p1_first_name":"F4","p1_last_name":"F","p2_first_name":"G4","p2_last_name":"F","team_name":"F4 F. / G4 F.","p1_rank":1400,"p2_rank":1400}]$teams$::jsonb)),$programme${"simulation":true,"registration_closed":true,"draw_at":"1970-01-01T00:00:00Z","divisions":[{"division":"DD","count":4,"validated_count":null,"validated_at":null,"drawn_at":null,"pool_a":[],"pool_b":[],"draw_order":[],"seeds":[]},{"division":"DM","count":4,"validated_count":null,"validated_at":null,"drawn_at":null,"pool_a":[],"pool_b":[],"draw_order":[],"seeds":[]}]}$programme$::jsonb);
create function public.suzini_e3_match_simulation(p_action text default 'list',p_division text default null) returns jsonb language plpgsql security definer set search_path='' as $f$
declare s suzini_e3_private.match_simulation; i integer; d jsonb; layout jsonb; ids uuid[];
begin
 perform public.suzini_e3_club();
 select * into s from suzini_e3_private.match_simulation where singleton is true for update;
 if p_action in('validate','draw') then
 if p_division is null or p_division not in('DM','DD') then raise exception 'Tableau inconnu.';end if;
 select (ordinality-1)::integer,value into i,d from jsonb_array_elements(s.programme->'divisions') with ordinality where value->>'division'=p_division;
 if p_action='validate' then d:=d||jsonb_build_object('validated_at',now(),'validated_count',4);
 else
 if d->>'validated_at' is null then raise exception 'Validez le format de simulation avant le tirage.';end if;
 if d->>'drawn_at' is not null then raise exception 'Tirage de simulation déjà effectué.';end if;
 select array_agg((value->>'id')::uuid order by (value->>'p1_rank')::int+(value->>'p2_rank')::int) into ids from jsonb_array_elements(s.teams) where value->>'division'=p_division;
 layout:=suzini_e3_private.seeded_layout(ids);
 d:=d||layout||jsonb_build_object('drawn_at',now());
 end if;
 s.programme:=jsonb_set(s.programme,array['divisions',i::text],d);
 update suzini_e3_private.match_simulation set programme=s.programme,updated_at=now(),updated_by=auth.uid() where singleton is true;
 elsif p_action='reset' then
 s.programme:=$programme${"simulation":true,"registration_closed":true,"draw_at":"1970-01-01T00:00:00Z","divisions":[{"division":"DD","count":4,"validated_count":null,"validated_at":null,"drawn_at":null,"pool_a":[],"pool_b":[],"draw_order":[],"seeds":[]},{"division":"DM","count":4,"validated_count":null,"validated_at":null,"drawn_at":null,"pool_a":[],"pool_b":[],"draw_order":[],"seeds":[]}]}$programme$::jsonb;
 update suzini_e3_private.match_simulation set programme=s.programme,updated_at=now(),updated_by=auth.uid() where singleton is true;
 elsif p_action<>'list' then raise exception 'Action inconnue.';end if;
 return s.programme||jsonb_build_object('teams',s.teams);
end;$f$;
revoke all on function public.suzini_e3_match_simulation(text,text) from public,anon;
grant execute on function public.suzini_e3_match_simulation(text,text) to authenticated;
