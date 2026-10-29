create table public.suzini_e3_controls(id boolean primary key default true check(id),pages text[] not null default '{}',club_blocked boolean not null default false);
insert into public.suzini_e3_controls default values;
alter table public.suzini_e3_controls enable row level security;
revoke all on public.suzini_e3_controls from public,anon,authenticated;
create or replace function public.suzini_e3_maintenance() returns jsonb language sql stable security definer set search_path='' as $$select jsonb_build_object('pages',pages,'club_blocked',club_blocked) from public.suzini_e3_controls;$$;
revoke all on function public.suzini_e3_maintenance() from public,anon,authenticated;
grant execute on function public.suzini_e3_maintenance() to anon,authenticated;
create or replace function public.suzini_e3_settings(p_data jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.organizers where user_id=auth.uid()) then raise exception 'Accès réservé à l’administrateur.' using errcode='42501';end if;
 if p_data is not null then
 if exists(select 1 from jsonb_array_elements_text(p_data->'pages') x where x not in ('index.html','inscriptions.html','equipes.html','programmation.html','restauration.html','infos.html')) then raise exception 'Page inconnue.';end if;
 update public.suzini_e3_controls set pages=array(select jsonb_array_elements_text(p_data->'pages')),club_blocked=(p_data->>'club_blocked')::boolean;
 end if;
 return public.suzini_e3_maintenance();
end;$$;
revoke all on function public.suzini_e3_settings(jsonb) from public,anon,authenticated;
grant execute on function public.suzini_e3_settings(jsonb) to authenticated;
create or replace function public.suzini_e3_club(p_action text default 'list',p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not (exists(select 1 from public.organizers where user_id=auth.uid()) or exists(select 1 from public.event_memberships where event_id='20261106-0000-4000-8000-000000000003' and user_id=auth.uid())) then raise exception 'Accès Club non attribué pour cette étape.' using errcode='42501';end if;
 if not exists(select 1 from public.organizers where user_id=auth.uid()) and exists(select 1 from public.suzini_e3_controls where club_blocked) then raise exception 'Espace Club temporairement en maintenance.';end if;
 if p_action='opening' and not exists(select 1 from public.organizers where user_id=auth.uid()) then raise exception 'Accès réservé à l’administrateur.' using errcode='42501';end if;
 if p_action='opening' then
  update public.events set registration_open=(p_data->>'open')::boolean where id='20261106-0000-4000-8000-000000000003';
 elsif p_action='payment' then
  update public.bt250_teams set payment_received=(p_data->>'paid')::boolean where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action='edit' then
  perform 1 from public.events where id='20261106-0000-4000-8000-000000000003' for update;
  if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and id<>p_id and division=p_data->>'division' and (p1_licence in(upper(btrim(p_data->>'p1_licence')),upper(btrim(p_data->>'p2_licence'))) or p2_licence in(upper(btrim(p_data->>'p1_licence')),upper(btrim(p_data->>'p2_licence'))))) then raise exception 'Un des joueurs est déjà inscrit dans cette épreuve.';end if;
  update public.bt250_teams set division=p_data->>'division',
  p1_first_name=btrim(p_data->>'p1_first_name'),p1_last_name=btrim(p_data->>'p1_last_name'),p1_licence=upper(btrim(p_data->>'p1_licence')),p1_phone=btrim(p_data->>'p1_phone'),
  p2_first_name=btrim(p_data->>'p2_first_name'),p2_last_name=btrim(p_data->>'p2_last_name'),p2_licence=upper(btrim(p_data->>'p2_licence')),p2_phone=btrim(p_data->>'p2_phone'),
  team_name=left(btrim(p_data->>'p1_first_name')||' / '||btrim(p_data->>'p2_first_name'),40)
  where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action<>'list' then raise exception 'Action inconnue.';end if;
 select jsonb_build_object('is_admin',exists(select 1 from public.organizers where user_id=auth.uid()),'open',(select registration_open from public.events where id='20261106-0000-4000-8000-000000000003'),'teams',coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb),'labels',public.suzini_e3_teams()) into result from public.bt250_teams t where event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$$;
revoke all on function public.suzini_e3_club(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.suzini_e3_club(text,uuid,jsonb) to authenticated;
create or replace function public.suzini_e3_register(p_team jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare event_open boolean; result uuid; l1 text; l2 text;
begin
 if exists(select 1 from public.suzini_e3_controls where 'inscriptions.html'=any(pages)) then raise exception 'Inscriptions temporairement en maintenance.';end if;
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
 values('20261106-0000-4000-8000-000000000003',p_team->>'epreuve',left(btrim(p_team->>'p1FirstName')||' / '||btrim(p_team->>'p2FirstName'),40),btrim(p_team->>'p1FirstName'),btrim(p_team->>'p1LastName'),l1,btrim(p_team->>'p1Phone'),btrim(p_team->>'p2FirstName'),btrim(p_team->>'p2LastName'),l2,btrim(p_team->>'p2Phone')) returning id into result;
 return result;
exception when check_violation or not_null_violation then raise exception 'Vérifiez les noms, licences FFT et téléphones des deux joueurs.';
end;$$;

