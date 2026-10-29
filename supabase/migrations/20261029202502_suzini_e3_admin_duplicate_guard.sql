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
