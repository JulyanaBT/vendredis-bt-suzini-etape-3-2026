alter table public.bt250_teams add column p1_rank integer check(p1_rank between 1 and 10000000), add column p2_rank integer check(p2_rank between 1 and 10000000);
create or replace function public.suzini_e3_teams() returns jsonb
language sql stable security definer set search_path='' as $$
with players as (
 select p1_first_name as first_name,p1_last_name as last_name,p1_licence as licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select p2_first_name,p2_last_name,p2_licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
), homonyms as (select lower(btrim(first_name)) as name from players group by 1 having count(distinct licence)>1), labels as (
 select t.*, t.p1_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p1_first_name))) then ' '||left(t.p1_last_name,1)||'.' else '' end as player1,
 t.p2_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p2_first_name))) then ' '||left(t.p2_last_name,1)||'.' else '' end as player2
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published where t.event_id='20261106-0000-4000-8000-000000000003'
) select coalesce(jsonb_agg(jsonb_build_object('id',id,'division',division,'team_name',player1||' / '||player2,'player1',player1,'player2',player2,'player1_name',p1_first_name||' '||left(p1_last_name,1)||'.','player2_name',p2_first_name||' '||left(p2_last_name,1)||'.','p1_rank',p1_rank,'p2_rank',p2_rank,'team_rank',p1_rank+p2_rank) order by created_at),'[]'::jsonb) from labels;
$$;

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
  perform 1 from public.events where id='20261106-0000-4000-8000-000000000003' for update;
  if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and id<>p_id and division=p_data->>'division' and (p1_licence in(upper(btrim(p_data->>'p1_licence')),upper(btrim(p_data->>'p2_licence'))) or p2_licence in(upper(btrim(p_data->>'p1_licence')),upper(btrim(p_data->>'p2_licence'))))) then raise exception 'Un des joueurs est déjà inscrit dans cette épreuve.';end if;
  update public.bt250_teams set division=p_data->>'division',
  p1_first_name=btrim(p_data->>'p1_first_name'),p1_last_name=btrim(p_data->>'p1_last_name'),p1_licence=upper(btrim(p_data->>'p1_licence')),
  p2_first_name=btrim(p_data->>'p2_first_name'),p2_last_name=btrim(p_data->>'p2_last_name'),p2_licence=upper(btrim(p_data->>'p2_licence')),
  p1_rank=case when p_data ? 'p1_rank' then nullif(p_data->>'p1_rank','')::integer else p1_rank end,
  p2_rank=case when p_data ? 'p2_rank' then nullif(p_data->>'p2_rank','')::integer else p2_rank end,
  team_name=left(btrim(p_data->>'p1_first_name')||' / '||btrim(p_data->>'p2_first_name'),40)
  where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action<>'list' then raise exception 'Action inconnue.';end if;
 select jsonb_build_object('open',(select registration_open from public.events where id='20261106-0000-4000-8000-000000000003'),'teams',coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb),'labels',public.suzini_e3_teams()) into result from public.bt250_teams t where event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$$;


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
  p1_first_name=btrim(p_data->>'p1_first_name'),p1_last_name=btrim(p_data->>'p1_last_name'),p1_licence=upper(btrim(p_data->>'p1_licence')),
  p2_first_name=btrim(p_data->>'p2_first_name'),p2_last_name=btrim(p_data->>'p2_last_name'),p2_licence=upper(btrim(p_data->>'p2_licence')),
  p1_rank=case when p_data ? 'p1_rank' then nullif(p_data->>'p1_rank','')::integer else p1_rank end,
  p2_rank=case when p_data ? 'p2_rank' then nullif(p_data->>'p2_rank','')::integer else p2_rank end,
  team_name=left(btrim(p_data->>'p1_first_name')||' / '||btrim(p_data->>'p2_first_name'),40)
  where id=p_id and event_id='20261106-0000-4000-8000-000000000003';
 elsif p_action<>'list' then raise exception 'Action inconnue.';end if;
 select jsonb_build_object('is_admin',exists(select 1 from public.organizers where user_id=auth.uid()),'open',(select registration_open from public.events where id='20261106-0000-4000-8000-000000000003'),'teams',coalesce(jsonb_agg(to_jsonb(t) order by t.created_at),'[]'::jsonb),'labels',public.suzini_e3_teams()) into result from public.bt250_teams t where event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$$;

