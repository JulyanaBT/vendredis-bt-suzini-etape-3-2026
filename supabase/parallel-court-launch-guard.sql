CREATE OR REPLACE FUNCTION public.suzini_e3_save_planning(p_simulation boolean, p_plan jsonb, p_revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s jsonb;j jsonb;k jsonb;m jsonb; dep text;rev int;
begin
 if p_simulation then raise exception 'Les simulations sont terminées. Actualisez la page pour utiliser le tournoi réel.';end if;
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
end;$function$;