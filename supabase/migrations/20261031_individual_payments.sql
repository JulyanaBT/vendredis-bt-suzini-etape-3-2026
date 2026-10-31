create table suzini_e3_private.payments(
team_id uuid primary key references public.bt250_teams(id) on delete cascade,
receipt_token uuid not null unique default gen_random_uuid(),
choice text check(choice in ('online_now','online_later','cash')),
p1_paid boolean not null default false,p2_paid boolean not null default false);
alter table suzini_e3_private.payments enable row level security;
revoke all on suzini_e3_private.payments from public,anon,authenticated;
insert into suzini_e3_private.payments(team_id,p1_paid,p2_paid)
select id,payment_received,payment_received from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003';
create or replace function public.suzini_e3_register_payment(p_team jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_token uuid;
begin
v_id:=public.suzini_e3_register(p_team);
insert into suzini_e3_private.payments(team_id) values(v_id) returning receipt_token into v_token;
return jsonb_build_object('id',v_id,'token',v_token);
end;$$;
create or replace function public.suzini_e3_payment_choice(p_token uuid,p_choice text) returns boolean
language plpgsql security definer set search_path='' as $$
begin
if p_choice is null or p_choice not in ('online_now','online_later','cash') then raise exception 'Choix de paiement invalide.';end if;
update suzini_e3_private.payments set choice=p_choice where receipt_token=p_token;
if not found then raise exception 'Inscription introuvable. Contactez le club.';end if;
return true;
end;$$;
revoke all on function public.suzini_e3_register_payment(jsonb),public.suzini_e3_payment_choice(uuid,text) from public;
grant execute on function public.suzini_e3_register_payment(jsonb),public.suzini_e3_payment_choice(uuid,text) to anon,authenticated;
CREATE OR REPLACE FUNCTION public.suzini_e3_club(p_action text DEFAULT 'list'::text, p_id uuid DEFAULT NULL::uuid, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare result jsonb;
begin
 if auth.uid() is null or not (exists(select 1 from public.organizers where user_id=auth.uid()) or exists(select 1 from public.event_memberships where event_id='20261106-0000-4000-8000-000000000003' and user_id=auth.uid())) then raise exception 'Accès Club non attribué pour cette étape.' using errcode='42501';end if;
 if not exists(select 1 from public.organizers where user_id=auth.uid()) and exists(select 1 from public.suzini_e3_controls where club_blocked) then raise exception 'Espace Club temporairement en maintenance.';end if;
 if p_action='opening' and not exists(select 1 from public.organizers where user_id=auth.uid()) then raise exception 'Accès réservé à l’administrateur.' using errcode='42501';end if;
 if p_action='opening' then
  update public.events set registration_open=(p_data->>'open')::boolean where id='20261106-0000-4000-8000-000000000003';
 elsif p_action='payment' then
  if not exists(select 1 from public.bt250_teams where id=p_id and event_id='20261106-0000-4000-8000-000000000003') then raise exception 'Équipe introuvable.';end if;
  insert into suzini_e3_private.payments(team_id) values(p_id) on conflict do nothing;
  if p_data ? 'player' and (p_data->>'player') not in ('1','2') then raise exception 'Joueur invalide.';end if;
  update suzini_e3_private.payments set
   p1_paid=case when not p_data ? 'player' or p_data->>'player'='1' then coalesce((p_data->>'paid')::boolean,false) else p1_paid end,
   p2_paid=case when not p_data ? 'player' or p_data->>'player'='2' then coalesce((p_data->>'paid')::boolean,false) else p2_paid end
  where team_id=p_id;
  update public.bt250_teams set payment_received=(select p1_paid and p2_paid from suzini_e3_private.payments where team_id=p_id) where id=p_id;
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
 select jsonb_build_object('is_admin',exists(select 1 from public.organizers where user_id=auth.uid()),'open',(select registration_open from public.events where id='20261106-0000-4000-8000-000000000003'),'teams',coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('p1_paid',coalesce(pay.p1_paid,t.payment_received),'p2_paid',coalesce(pay.p2_paid,t.payment_received),'payment_choice',pay.choice) order by t.created_at),'[]'::jsonb),'labels',public.suzini_e3_teams()) into result from public.bt250_teams t left join suzini_e3_private.payments pay on pay.team_id=t.id where event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$function$;

CREATE OR REPLACE FUNCTION public.suzini_e3_teams()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with players as (
 select p1_first_name as first_name,p1_last_name as last_name,p1_licence as licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select p2_first_name,p2_last_name,p2_licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
), homonyms as (select lower(btrim(first_name)) as name from players group by 1 having count(distinct licence)>1), labels as (
 select t.*, t.p1_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p1_first_name))) then ' '||left(t.p1_last_name,1)||'.' else '' end as player1,
 t.p2_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p2_first_name))) then ' '||left(t.p2_last_name,1)||'.' else '' end as player2
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published where t.event_id='20261106-0000-4000-8000-000000000003'
) select coalesce(jsonb_agg(jsonb_build_object('id',id,'division',division,'team_name',player1||' / '||player2,'player1',player1,'player2',player2,'p1_first_name',p1_first_name,'p1_last_name',p1_last_name,'p2_first_name',p2_first_name,'p2_last_name',p2_last_name,'player1_name',p1_first_name||' '||p1_last_name,'player2_name',p2_first_name||' '||p2_last_name,'p1_rank',p1_rank,'p2_rank',p2_rank,'team_rank',p1_rank+p2_rank,'paid_players',coalesce((select p.p1_paid::int+p.p2_paid::int from suzini_e3_private.payments p where p.team_id=labels.id),case when payment_received then 2 else 0 end)) order by created_at),'[]'::jsonb) from labels;
$function$;
