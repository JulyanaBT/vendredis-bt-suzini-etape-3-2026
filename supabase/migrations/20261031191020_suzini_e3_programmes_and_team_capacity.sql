create table suzini_e3_private.programmes(
 division text primary key check(division in ('DM','DD')),
 team_count integer check(team_count between 3 and 8),
 team_ids uuid[] not null default '{}',
 validated_at timestamptz, validated_by uuid,drawn_at timestamptz,
 pool_a uuid[] not null default '{}',pool_b uuid[] not null default '{}');
alter table suzini_e3_private.programmes enable row level security;
revoke all on suzini_e3_private.programmes from public,anon,authenticated;
insert into suzini_e3_private.programmes(division) values('DM'),('DD');
create function suzini_e3_private.roster_guard() returns trigger language plpgsql security definer set search_path='' as $$
declare eid constant uuid:='20261106-0000-4000-8000-000000000003';newdiv text;olddiv text;changed boolean;begin
 if TG_OP<>'DELETE' then if new.event_id=eid then newdiv:=new.division;end if;end if;
 if TG_OP<>'INSERT' then if old.event_id=eid then olddiv:=old.division;end if;end if;
 if newdiv is null and olddiv is null then if TG_OP='DELETE' then return old;else return new;end if;end if;
 perform 1 from public.events where id=eid for update;
 changed:=TG_OP<>'UPDATE' or newdiv is distinct from olddiv;
 if changed and exists(select 1 from suzini_e3_private.programmes where division in(newdiv,olddiv) and drawn_at is not null) then raise exception 'Le tirage est effectué : les équipes du tableau sont verrouillées.';end if;
 if newdiv is not null and changed and (select count(*) from public.bt250_teams where event_id=eid and division=newdiv)>=8 then raise exception 'Tableau complet : 8 équipes maximum par épreuve.';end if;
 if changed then update suzini_e3_private.programmes set team_count=null,team_ids='{}',validated_at=null,validated_by=null,pool_a='{}',pool_b='{}' where division in(newdiv,olddiv);end if;
 if TG_OP='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function suzini_e3_private.roster_guard() from public,anon,authenticated;
create trigger suzini_e3_roster_guard before insert or update or delete on public.bt250_teams for each row execute function suzini_e3_private.roster_guard();
create function public.suzini_e3_programme() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('registration_closed',not registration_open or now()>='2026-11-05 00:00:00-03'::timestamptz,'draw_at','2026-11-05T17:00:00Z','divisions',(select jsonb_agg(jsonb_build_object('division',p.division,'count',(select count(*) from public.bt250_teams t where t.event_id=e.id and t.division=p.division),'validated_count',p.team_count,'validated_at',p.validated_at,'drawn_at',p.drawn_at,'pool_a',p.pool_a,'pool_b',p.pool_b) order by p.division) from suzini_e3_private.programmes p)) from public.events e where id='20261106-0000-4000-8000-000000000003';
$$;
revoke all on function public.suzini_e3_programme() from public;
grant execute on function public.suzini_e3_programme() to anon,authenticated;
create function public.suzini_e3_programme_manage(p_action text,p_division text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];n integer;p suzini_e3_private.programmes;closed boolean;begin
 perform public.suzini_e3_club('list');
 if p_division not in ('DM','DD') or p_division is null then raise exception 'Épreuve inconnue.';end if;
 select not registration_open or now()>='2026-11-05 00:00:00-03'::timestamptz into closed from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 if not closed then raise exception 'Fermez les inscriptions avant de valider le format.';end if;
 select * into p from suzini_e3_private.programmes where division=p_division for update;
 select array_agg(id order by id),count(*) into ids,n from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
 if n<3 or n>8 then raise exception 'Il faut entre 3 et 8 équipes pour valider ce tableau.';end if;
 if p_action='validate' then
  if p.drawn_at is not null then raise exception 'Le tirage de ce tableau est déjà effectué.';end if;
  update suzini_e3_private.programmes set team_count=n,team_ids=ids,validated_at=now(),validated_by=auth.uid() where division=p_division;
 elsif p_action='draw' then
  if now()<'2026-11-05 17:00:00+00'::timestamptz then raise exception 'Tirage prévu le 5 novembre à 14 h, heure de Guyane.';end if;
  if p.drawn_at is not null then raise exception 'Tirage déjà effectué.';end if;
  if p.validated_at is null or p.team_count<>n or p.team_ids is distinct from ids then raise exception 'Validez le format avec les équipes actuelles avant le tirage.';end if;
  select array_agg(id order by random()) into ids from unnest(ids) id;
  update suzini_e3_private.programmes set pool_a=case when n<=5 then ids else ids[1:3+(n/8)] end,pool_b=case when n<=5 then '{}'::uuid[] else ids[4+(n/8):n] end,drawn_at=now() where division=p_division;
 else raise exception 'Action inconnue.';end if;
 return public.suzini_e3_programme();
end;$$;
revoke all on function public.suzini_e3_programme_manage(text,text) from public,anon;
grant execute on function public.suzini_e3_programme_manage(text,text) to authenticated;
