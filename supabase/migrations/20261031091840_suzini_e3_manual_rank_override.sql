alter table public.bt250_teams
 add column p1_rank_override integer check(p1_rank_override between 1 and 10000000),add column p2_rank_override integer check(p2_rank_override between 1 and 10000000),
 add column p1_rank_override_by uuid,add column p2_rank_override_by uuid,
 add column p1_rank_override_at timestamptz,add column p2_rank_override_at timestamptz;
alter table public.bt250_teams drop constraint bt250_teams_p1_rank_status_check,drop constraint bt250_teams_p2_rank_status_check;
alter table public.bt250_teams add constraint bt250_teams_p1_rank_status_check check(p1_rank_status in ('pending','matched','unlisted','conflict','manual')),
 add constraint bt250_teams_p2_rank_status_check check(p2_rank_status in ('pending','matched','unlisted','conflict','manual'));
create or replace function suzini_e3_private.assign_rankings() returns trigger language plpgsql security invoker set search_path='' as $$
declare a jsonb;b jsonb;
begin
 if new.event_id<>'20261106-0000-4000-8000-000000000003' then return new;end if;
 a:=suzini_e3_private.resolve_ranking(new.division,new.p1_licence,new.p1_first_name,new.p1_last_name);
 b:=suzini_e3_private.resolve_ranking(new.division,new.p2_licence,new.p2_first_name,new.p2_last_name);

 if tg_op='UPDATE' then
  if new.division is distinct from old.division or upper(new.p1_licence) is distinct from upper(old.p1_licence) or suzini_e3_private.normalized_name(new.p1_first_name) is distinct from suzini_e3_private.normalized_name(old.p1_first_name) or suzini_e3_private.normalized_name(new.p1_last_name) is distinct from suzini_e3_private.normalized_name(old.p1_last_name) then new.p1_rank_override:=null;end if;
 end if;
 if a->>'status'<>'conflict' then new.p1_rank_override:=null;end if;
 new.p1_rank_issue:=nullif(a->'issue','null'::jsonb);
 if new.p1_rank_override is not null then
  new.p1_rank:=new.p1_rank_override;new.p1_rank_status:='manual';
 else
  new.p1_rank:=(a->>'rank')::integer;new.p1_rank_status:=a->>'status';new.p1_rank_override_by:=null;new.p1_rank_override_at:=null;
 end if;

 if tg_op='UPDATE' then
  if new.division is distinct from old.division or upper(new.p2_licence) is distinct from upper(old.p2_licence) or suzini_e3_private.normalized_name(new.p2_first_name) is distinct from suzini_e3_private.normalized_name(old.p2_first_name) or suzini_e3_private.normalized_name(new.p2_last_name) is distinct from suzini_e3_private.normalized_name(old.p2_last_name) then new.p2_rank_override:=null;end if;
 end if;
 if b->>'status'<>'conflict' then new.p2_rank_override:=null;end if;
 new.p2_rank_issue:=nullif(b->'issue','null'::jsonb);
 if new.p2_rank_override is not null then
  new.p2_rank:=new.p2_rank_override;new.p2_rank_status:='manual';
 else
  new.p2_rank:=(b->>'rank')::integer;new.p2_rank_status:=b->>'status';new.p2_rank_override_by:=null;new.p2_rank_override_at:=null;
 end if;
return new;end;$$;
create function public.suzini_e3_manual_rank(p_id uuid,p_player integer,p_rank integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.bt250_teams;current_status text;
begin
 if auth.uid() is null or not (exists(select 1 from public.organizers where user_id=auth.uid()) or exists(select 1 from public.event_memberships where event_id='20261106-0000-4000-8000-000000000003' and user_id=auth.uid())) then raise exception 'Accès Club non attribué pour cette étape.' using errcode='42501';end if;
 if not exists(select 1 from public.organizers where user_id=auth.uid()) and exists(select 1 from public.suzini_e3_controls where club_blocked) then raise exception 'Espace Club temporairement en maintenance.';end if;
 if p_player not in (1,2) or p_player is null then raise exception 'Joueur invalide.';end if;
 if p_rank is not null and (p_rank<1 or p_rank>10000000) then raise exception 'Saisissez un classement entier positif.';end if;
 select * into t from public.bt250_teams where id=p_id and event_id='20261106-0000-4000-8000-000000000003' for update;
 if not found then raise exception 'Inscription introuvable.';end if;
 current_status:=case when p_player=1 then t.p1_rank_status else t.p2_rank_status end;
 if current_status not in ('conflict','manual') then raise exception 'Le classement manuel est réservé aux incohérences.';end if;
 if p_player=1 then update public.bt250_teams set p1_rank_override=p_rank,p1_rank_override_by=auth.uid(),p1_rank_override_at=now() where id=p_id;
 else update public.bt250_teams set p2_rank_override=p_rank,p2_rank_override_by=auth.uid(),p2_rank_override_at=now() where id=p_id;end if;
 return public.suzini_e3_club();
end;$$;
revoke all on function public.suzini_e3_manual_rank(uuid,integer,integer) from public,anon,authenticated;
grant execute on function public.suzini_e3_manual_rank(uuid,integer,integer) to authenticated;
