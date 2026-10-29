create or replace function public.suzini_e3_teams() returns jsonb
language sql stable security definer set search_path='' as $$
with players as (
 select p1_first_name as first_name,p1_last_name as last_name,p1_licence as licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select p2_first_name,p2_last_name,p2_licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
), homonyms as (select lower(btrim(first_name)) as name from players group by 1 having count(distinct licence)>1), labels as (
 select t.*, t.p1_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p1_first_name))) then ' '||left(t.p1_last_name,1)||'.' else '' end as player1,
 t.p2_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p2_first_name))) then ' '||left(t.p2_last_name,1)||'.' else '' end as player2
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published where t.event_id='20261106-0000-4000-8000-000000000003'
) select coalesce(jsonb_agg(jsonb_build_object('id',id,'division',division,'team_name',player1||' / '||player2,'player1',player1,'player2',player2,'player1_name',p1_first_name||' '||p1_last_name,'player2_name',p2_first_name||' '||p2_last_name,'p1_rank',p1_rank,'p2_rank',p2_rank,'team_rank',p1_rank+p2_rank) order by created_at),'[]'::jsonb) from labels;
$$;

