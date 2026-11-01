
create table suzini_e3_private.invitation_defaults(singleton boolean primary key default true check(singleton),password_hash text not null);
alter table suzini_e3_private.invitation_defaults enable row level security;
revoke all on suzini_e3_private.invitation_defaults from public,anon,authenticated;
create function public.suzini_e3_invite_password_matches(p_password text) returns boolean language sql stable security definer set search_path='' as $f$
 select coalesce((select password_hash=extensions.crypt(p_password,password_hash) from suzini_e3_private.invitation_defaults where singleton is true),false)
$f$;
revoke all on function public.suzini_e3_invite_password_matches(text) from public,anon,authenticated;
grant execute on function public.suzini_e3_invite_password_matches(text) to service_role;
create function public.suzini_e3_is_admin() returns boolean language sql stable security definer set search_path='' as $f$
 select auth.uid() is not null and exists(select 1 from public.organizers where user_id=auth.uid())
$f$;
revoke all on function public.suzini_e3_is_admin() from public;
grant execute on function public.suzini_e3_is_admin() to anon,authenticated;
create or replace function public.suzini_e3_settings(p_data jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $f$
begin
 if not public.suzini_e3_is_admin() then raise exception 'Accès réservé à l’administrateur.' using errcode='42501';end if;
 if p_data is not null then
 if jsonb_typeof(p_data->'pages') is distinct from 'array' or jsonb_typeof(p_data->'club_blocked') is distinct from 'boolean' then raise exception 'Réglages invalides.';end if;
 if exists(select 1 from jsonb_array_elements_text(p_data->'pages') x where x not in('index.html','inscriptions.html','equipes.html','programmation.html','restauration.html','infos.html')) then raise exception 'Page inconnue.';end if;
 update public.suzini_e3_controls set pages=array(select distinct jsonb_array_elements_text(p_data->'pages')),club_blocked=(p_data->>'club_blocked')::boolean where id is true;
 end if;
 return public.suzini_e3_maintenance();
end;$f$;
