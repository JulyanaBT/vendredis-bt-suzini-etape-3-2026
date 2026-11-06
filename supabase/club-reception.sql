create table suzini_e3_private.reception_checks (
 team_id uuid not null references public.bt250_teams(id) on delete cascade,
 player smallint not null check(player in(1,2)),
 licence text not null, checked_at timestamptz, checked_by uuid references auth.users(id) on delete set null,
 primary key(team_id,player)
);
alter table suzini_e3_private.reception_checks enable row level security;
revoke all on suzini_e3_private.reception_checks from public,anon,authenticated;
create table suzini_e3_private.player_constraints (
 team_id uuid not null references public.bt250_teams(id) on delete cascade,
 player smallint not null check(player in(1,2)), note text not null,
 min_slot integer check(min_slot>=0), primary key(team_id,player)
);
alter table suzini_e3_private.player_constraints enable row level security;
revoke all on suzini_e3_private.player_constraints from public,anon,authenticated;
with players as (
 select t.id,n,case when n=1 then t.p1_first_name else t.p2_first_name end as first_name
 from suzini_e3_private.active_teams t cross join generate_series(1,2) n
 where t.event_id='20261106-0000-4000-8000-000000000003'
), rules(first_name,note,min_slot) as (values
('maite','Matchs 1, 2, 7 et 10. Indisponible de 19 h 45 à 21 h 30 (Guyane). Accord de récupération réduite sur les créneaux 1 à 3 ; battement de 5 min conservé.',null::integer),
('pierreolivier','Commencer au 2e créneau et terminer le plus tôt possible.',null::integer),
('quentin','Ne peut pas jouer au premier créneau.',1),
('guillaume','Ne peut pas jouer au premier créneau.',1),
('melanie','Ne peut pas jouer au premier créneau.',1),
('lucas','Ne peut pas jouer avant le 3e créneau.',2)
)
insert into suzini_e3_private.player_constraints(team_id,player,note,min_slot)
select p.id,p.n,r.note,r.min_slot from players p join rules r on suzini_e3_private.normalized_name(p.first_name)=r.first_name;
create or replace function public.suzini_e3_reception(p_action text default 'list',p_team uuid default null,p_player integer default null,p_checked boolean default null,p_expected timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $function$
declare target_team public.bt250_teams; l text;previous timestamptz; result jsonb;
begin
 perform public.suzini_e3_club();
 if p_action is null or p_action not in('list','check') then raise exception 'Action inconnue.';end if;
 if p_action='check' then
 if p_player is null or p_player not in(1,2) or p_checked is null then raise exception 'Joueur ou vérification invalide.';end if;
 select * into target_team from suzini_e3_private.active_teams where id=p_team and event_id='20261106-0000-4000-8000-000000000003' for update;
 if target_team.id is null then raise exception 'Joueur introuvable.';end if;
 l:=case when p_player=1 then target_team.p1_licence else target_team.p2_licence end;
 select checked_at into previous from suzini_e3_private.reception_checks where team_id=p_team and player=p_player and licence=l for update;
 if previous is distinct from p_expected then raise exception 'La vérification a changé. Actualisez la liste avant de réessayer.';end if;
 insert into suzini_e3_private.reception_checks(team_id,player,licence,checked_at,checked_by)
 values(p_team,p_player,l,case when p_checked then now() else null end,auth.uid())
 on conflict(team_id,player) do update set licence=excluded.licence,checked_at=excluded.checked_at,checked_by=excluded.checked_by;
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
 'team_id',t.id,'player',n,'division',t.division,'team_name',t.team_name,
 'first_name',case when n=1 then t.p1_first_name else t.p2_first_name end,
 'last_name',case when n=1 then t.p1_last_name else t.p2_last_name end,
 'licence',case when n=1 then t.p1_licence else t.p2_licence end,
 'licence_ok',case when n=1 then t.p1_licence_status in('verified','manual') else t.p2_licence_status in('verified','manual') end,
 'paid',case when n=1 then coalesce(pay.p1_paid,t.payment_received,false) else coalesce(pay.p2_paid,t.payment_received,false) end,
 'method',case when n=1 then pay.p1_method else pay.p2_method end,
 'checked_at',case when c.licence=case when n=1 then t.p1_licence else t.p2_licence end then c.checked_at else null end,
 'constraint',pc.note
 )),'[]'::jsonb) into result
 from suzini_e3_private.active_teams t cross join generate_series(1,2) n
 left join suzini_e3_private.payments pay on pay.team_id=t.id
 left join suzini_e3_private.reception_checks c on c.team_id=t.id and c.player=n
 left join suzini_e3_private.player_constraints pc on pc.team_id=t.id and pc.player=n
 where t.event_id='20261106-0000-4000-8000-000000000003';
 return result;
end;$function$;
revoke all on function public.suzini_e3_reception(text,uuid,integer,boolean,timestamptz) from public,anon;
grant execute on function public.suzini_e3_reception(text,uuid,integer,boolean,timestamptz) to authenticated;

CREATE OR REPLACE FUNCTION public.suzini_e3_save_planning(p_simulation boolean, p_plan jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb;j jsonb;k jsonb;m jsonb; dep text;rev int;
begin

perform public.suzini_e3_club();
insert into suzini_e3_private.match_planning(simulation) values(p_simulation) on conflict do nothing;
select revision into rev from suzini_e3_private.match_planning where simulation=p_simulation for update;
if rev<>p_revision then raise exception 'Le programme a changé. Actualisez avant de déplacer un match.';end if;
s:=public.suzini_e3_match_manager_state(p_simulation);
if jsonb_typeof(p_plan) is distinct from 'array' or jsonb_array_length(p_plan)<>jsonb_array_length(s->'matches') then raise exception 'Programme incomplet.';end if;
for j in select value from jsonb_array_elements(p_plan) loop
if j->>'court' not in ('DM','DD') or j->>'court' is null or j->>'slot' !~ '^[0-9]{1,3}$' then raise exception 'Créneau invalide.';end if;
select value into m from jsonb_array_elements(s->'matches') where value->>'id'=j->>'id' and value->>'division'=j->>'division';
if m is null then raise exception 'Rencontre inconnue.';end if;
if exists(select 1 from suzini_e3_private.player_constraints c where c.team_id::text in(m->>'a',m->>'b') and c.min_slot>(j->>'slot')::int) then
raise exception 'Cette équipe ne peut pas jouer avant le créneau %.',(select max(c.min_slot)+1 from suzini_e3_private.player_constraints c where c.team_id::text in(m->>'a',m->>'b'));
end if;
if j->>'court'<>j->>'division' and m->'result'='null'::jsonb
and exists(select 1 from jsonb_array_elements(s->'matches') other where other->>'division'<>j->>'division' and other->'result'='null'::jsonb) then
raise exception 'Le second terrain reste réservé à son épreuve jusqu’à sa fin complète.';end if;

-- A borrowed-court launch must follow the end of the other draw and
-- run alongside a match of this draw on its principal court.
if j->>'started_at' is not null and j->>'court'<>j->>'division'
and m->'result'='null'::jsonb
and not exists(select 1 from jsonb_array_elements(coalesce(s->'planning','[]')) old where old->>'id'=j->>'id' and old->>'division'=j->>'division' and old->>'started_at' is not null) then
 if exists(select 1 from jsonb_array_elements(s->'matches') other where other->>'division'<>j->>'division' and other->'result'='null'::jsonb) then
 raise exception 'Le second terrain est utilisable seulement après la fin complète de l’autre épreuve.';end if;
 if not exists(select 1 from jsonb_array_elements(s->'matches') principal where principal->>'division'=j->>'division' and principal->'result'='null'::jsonb and exists(select 1 from jsonb_array_elements(coalesce(s->'planning','[]')) active where active->>'id'=principal->>'id' and active->>'division'=j->>'division' and active->>'court'=j->>'division' and active->>'started_at' is not null)) then
 raise exception 'Le second terrain sert uniquement à jouer en parallèle d’un match sur le terrain principal.';end if;
end if;

if (select count(*) from jsonb_array_elements(p_plan) where value->>'id'=j->>'id' and value->>'division'=j->>'division')<>1 then raise exception 'Rencontre dupliquée.';end if;
if j->>'forced_at' is not null then perform (j->>'forced_at')::timestamptz;end if;
for k in select value from jsonb_array_elements(p_plan) where (value->>'slot')::int=(j->>'slot')::int and value<>j loop
if k->>'court'=j->>'court' then raise exception 'Deux matchs occupent le même terrain au même créneau.';end if;
if exists(select 1 from jsonb_array_elements(s->'matches') other where other->>'division'=k->>'division' and other->>'id'=k->>'id' and (other->>'a' in(m->>'a',m->>'b') or other->>'b' in(m->>'a',m->>'b')) and m->>'a' ~ '^[0-9a-f-]{36}$') then raise exception 'Une équipe ne peut pas jouer deux matchs au même créneau.';end if;
end loop;
for dep in select value from jsonb_array_elements_text(m->'deps') loop
if exists(select 1 from jsonb_array_elements(p_plan) where value->>'division'=j->>'division' and value->>'id'=dep and (value->>'slot')::int >= (j->>'slot')::int) then raise exception 'Ce déplacement précède un match nécessaire au tour suivant.';end if;
end loop;
end loop;
update suzini_e3_private.match_planning set plan=p_plan,revision=revision+1,updated_by=auth.uid(),updated_at=now() where simulation=p_simulation;
return public.suzini_e3_match_manager_state(p_simulation);
end;$function$
;
