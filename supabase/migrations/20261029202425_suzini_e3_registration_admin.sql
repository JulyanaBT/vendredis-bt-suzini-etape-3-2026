alter table public.bt250_teams add column if not exists payment_received boolean not null default false;
create or replace function public.suzini_e3_teams() returns jsonb
language sql stable security definer set search_path='' as $$
with players as (
 select p1_first_name as first_name,p1_last_name as last_name,p1_licence as licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select p2_first_name,p2_last_name,p2_licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
), homonyms as (select lower(btrim(first_name)) as name from players group by 1 having count(distinct licence)>1), labels as (
 select t.*, t.p1_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p1_first_name))) then ' '||left(t.p1_last_name,1)||'.' else '' end as player1,
 t.p2_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p2_first_name))) then ' '||left(t.p2_last_name,1)||'.' else '' end as player2
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published where t.event_id='20261106-0000-4000-8000-000000000003'
) select coalesce(jsonb_agg(jsonb_build_object('id',id,'division',division,'team_name',player1||' / '||player2,'player1',player1,'player2',player2) order by created_at),'[]'::jsonb) from labels;
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
 values('20261106-0000-4000-8000-000000000003',p_team->>'epreuve',left(btrim(p_team->>'p1FirstName')||' / '||btrim(p_team->>'p2FirstName'),40),btrim(p_team->>'p1FirstName'),btrim(p_team->>'p1LastName'),l1,btrim(p_team->>'p1Phone'),btrim(p_team->>'p2FirstName'),btrim(p_team->>'p2LastName'),l2,btrim(p_team->>'p2Phone')) returning id into result;
 return result;
exception when check_violation or not_null_violation then raise exception 'Vérifiez les noms, licences FFT et téléphones des deux joueurs.';
end;$$;

create or replace function public.suzini_e3_admin(p_action text default 'list',p_id uuid default null,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.organizers where user_id=auth.uid()) then raise exception 'Accès réservé aux organisateurs.' using errcode='42501'; end if;
 if p_action='opening' then
  update public.events set registration_open=(p_data->>'open')::boolean where id='20261106-0000-4000-8000-000000000003';
 elsif p_action='payment' then
  update public.bt250_teams set payment_received=(p_data->>'paid')::boolean where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action='edit' then
  update public.bt250_teams set division=p_data->>'division',
  p1_first_name=btrim(p_data->>'p1_first_name'),p1_last_name=btrim(p_data->>'p1_last_name'),p1_licence=upper(btrim(p_data->>'p1_licence')),p1_phone=btrim(p_data->>'p1_phone'),
  p2_first_name=btrim(p_data->>'p2_first_name'),p2_last_name=btrim(p_data->>'p2_last_name'),p2_licence=upper(btrim(p_data->>'p2_licence')),p2_phone=btrim(p_data->>'p2_phone'),
  team_name=left(btrim(p_data->>'p1_first_name')||' / '||btrim(p_data->>'p2_first_name'),40)
  where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action<>'list' then raise exception 'Action inconnue.';end if;
 select jsonb_build_object('open',(select registration_open from public.events where id='20261106-0000-4000-8000-000000000003'),'teams',coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb),'labels',public.suzini_e3_teams()) into result from public.bt250_teams t where event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$$;
revoke all on function public.suzini_e3_admin(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.suzini_e3_admin(text,uuid,jsonb) to authenticated;
