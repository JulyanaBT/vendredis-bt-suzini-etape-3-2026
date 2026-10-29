begin;
-- Add this event to the existing October Rose Supabase project; do not replay its migrations.
insert into public.events(id,title,event_date,location,published,registration_open)
values ('20261106-0000-4000-8000-000000000003','Les Vendredis du BT Suzini — Étape 3','2026-11-06','TC Suzini',true,false)
on conflict(id) do nothing;
create table if not exists public.bt250_teams (
 id uuid primary key default gen_random_uuid(),
 event_id uuid not null references public.events(id),
 division text not null check(division in ('DD','DM')),
 team_name text not null check(length(btrim(team_name)) between 1 and 40),
 p1_first_name text not null check(length(btrim(p1_first_name)) between 1 and 60),
 p1_last_name text not null check(length(btrim(p1_last_name)) between 1 and 60),
 p1_licence text not null check(p1_licence ~ '^[0-9]{7}[A-Z]$'),
 p1_phone text not null check(p1_phone ~ '^[+0-9 ().-]{8,24}$'),
 p2_first_name text not null check(length(btrim(p2_first_name)) between 1 and 60),
 p2_last_name text not null check(length(btrim(p2_last_name)) between 1 and 60),
 p2_licence text not null check(p2_licence ~ '^[0-9]{7}[A-Z]$'),
 p2_phone text not null check(p2_phone ~ '^[+0-9 ().-]{8,24}$'),
 created_at timestamptz not null default now(),
 check(p1_licence<>p2_licence)
);
create index if not exists bt250_teams_event_division_created_idx on public.bt250_teams(event_id,division,created_at);
alter table public.bt250_teams enable row level security;
revoke all on public.bt250_teams from public,anon,authenticated;
grant select on public.bt250_teams to authenticated;
drop policy if exists bt250_organizer_read on public.bt250_teams;
create policy bt250_organizer_read on public.bt250_teams for select to authenticated using (
 exists(select 1 from public.organizers where user_id=(select auth.uid())) or
 exists(select 1 from public.event_memberships m where m.event_id=bt250_teams.event_id and m.user_id=(select auth.uid()))
);
create or replace function public.suzini_e3_status() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('event_id',id,'open',registration_open and now()<'2026-11-05 00:00:00-03'::timestamptz,'title',title)
 from public.events where id='20261106-0000-4000-8000-000000000003' and published;
$$;
create or replace function public.suzini_e3_teams() returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'division',t.division,'team_name',t.team_name,
 'player1',t.p1_first_name||' '||left(t.p1_last_name,1)||'.','player2',t.p2_first_name||' '||left(t.p2_last_name,1)||'.') order by t.created_at),'[]'::jsonb)
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published
 where t.event_id='20261106-0000-4000-8000-000000000003';
$$;
create or replace function public.suzini_e3_register(p_team jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare event_open boolean; result uuid; l1 text; l2 text;
begin
 select registration_open and published into event_open from public.events
 where id='20261106-0000-4000-8000-000000000003' for update;
 if not coalesce(event_open,false) then raise exception 'Les inscriptions ne sont pas encore ouvertes.';end if;
 if now()>='2026-11-05 00:00:00-03'::timestamptz then raise exception 'Les inscriptions sont closes depuis le 4 novembre.';end if;
 l1:=upper(regexp_replace(coalesce(p_team->>'p1Licence',''),'\s','','g'));
 l2:=upper(regexp_replace(coalesce(p_team->>'p2Licence',''),'\s','','g'));
 if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 and division=p_team->>'epreuve' and (p1_licence in(l1,l2) or p2_licence in(l1,l2)))
 then raise exception 'Un des joueurs est déjà inscrit dans cette épreuve. Contactez le club.';end if;
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p1_phone,p2_first_name,p2_last_name,p2_licence,p2_phone)
 values('20261106-0000-4000-8000-000000000003',p_team->>'epreuve',btrim(p_team->>'teamName'),btrim(p_team->>'p1FirstName'),btrim(p_team->>'p1LastName'),l1,btrim(p_team->>'p1Phone'),btrim(p_team->>'p2FirstName'),btrim(p_team->>'p2LastName'),l2,btrim(p_team->>'p2Phone')) returning id into result;
 return result;
exception when check_violation or not_null_violation then raise exception 'Vérifiez les noms, licences FFT et téléphones des deux joueurs.';
end;$$;
revoke all on function public.suzini_e3_status(),public.suzini_e3_teams(),public.suzini_e3_register(jsonb) from public,anon,authenticated;
grant execute on function public.suzini_e3_status(),public.suzini_e3_teams(),public.suzini_e3_register(jsonb) to anon,authenticated;
commit;
