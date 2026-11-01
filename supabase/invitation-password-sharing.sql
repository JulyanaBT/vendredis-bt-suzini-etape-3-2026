
alter table suzini_e3_private.invitation_defaults add column password_secret uuid;
create function public.suzini_e3_invite_initial_password() returns text language sql stable security definer set search_path='' as $f$
 select v.decrypted_secret from suzini_e3_private.invitation_defaults d join vault.decrypted_secrets v on v.id=d.password_secret where d.singleton is true
$f$;
revoke all on function public.suzini_e3_invite_initial_password() from public,anon,authenticated;
grant execute on function public.suzini_e3_invite_initial_password() to service_role;
