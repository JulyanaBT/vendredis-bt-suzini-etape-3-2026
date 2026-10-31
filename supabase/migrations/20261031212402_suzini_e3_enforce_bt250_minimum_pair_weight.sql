create or replace function public.suzini_e3_programme_manage(p_action text,p_division text) returns jsonb language plpgsql security definer set search_path='' as $$
declare ids uuid[];n integer;p suzini_e3_private.programmes;closed boolean;layout jsonb;begin
 perform public.suzini_e3_club('list');
 if p_division not in ('DM','DD') or p_division is null then raise exception 'Épreuve inconnue.';end if;
 select not registration_open or now()>='2026-11-05 00:00:00-03'::timestamptz into closed from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 if not closed then raise exception 'Fermez les inscriptions avant de valider le format.';end if;
 select * into p from suzini_e3_private.programmes where division=p_division for update;
 select array_agg(id order by id),count(*) into ids,n from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
 if n<4 or n>8 then raise exception 'Il faut entre 4 et 8 équipes pour maintenir ce tableau.';end if;
 if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division and p1_rank is not null and p2_rank is not null and p1_rank::bigint+p2_rank::bigint<120) then raise exception 'Paire non admissible en BT250 : le poids doit être au moins égal à 120. Vérifiez les classements et la liste des équipes.';end if;
 if p_action='validate' then
  if p.drawn_at is not null then raise exception 'Le tirage de ce tableau est déjà effectué.';end if;
  update suzini_e3_private.programmes set team_count=n,team_ids=ids,validated_at=now(),validated_by=auth.uid() where division=p_division;
 elsif p_action='draw' then
  if now()<'2026-11-05 17:00:00+00'::timestamptz then raise exception 'Tirage prévu le 5 novembre à 14 h, heure de Guyane.';end if;
  if p.drawn_at is not null then raise exception 'Tirage déjà effectué.';end if;
  if p.validated_at is null or p.team_count<>n or p.team_ids is distinct from ids then raise exception 'Validez le format avec les équipes actuelles avant le tirage.';end if;
  if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division and (p1_rank is null or p2_rank is null or p1_rank<1 or p2_rank<1)) then raise exception 'Complétez les classements des joueurs avant le tirage des têtes de série.';end if;
  select array_agg(id order by (p1_rank::bigint+p2_rank::bigint),random()) into ids from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and division=p_division;
  layout:=suzini_e3_private.seeded_layout(ids);
  update suzini_e3_private.programmes set
   seeds=array(select jsonb_array_elements_text(layout->'seeds')::uuid),
   pool_a=array(select jsonb_array_elements_text(layout->'pool_a')::uuid),
   pool_b=array(select jsonb_array_elements_text(layout->'pool_b')::uuid),
   draw_order=array(select jsonb_array_elements_text(layout->'draw_order')::uuid),
   drawn_at=now() where division=p_division;
 else raise exception 'Action inconnue.';end if;
 return public.suzini_e3_programme();
end;$$;

