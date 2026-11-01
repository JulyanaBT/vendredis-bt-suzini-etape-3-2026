
create function public.suzini_e3_preview_role() returns jsonb language sql stable security definer set search_path='' as $f$
 select jsonb_build_object(
 'admin',auth.uid() is not null and exists(select 1 from public.organizers where user_id=auth.uid()),
 'manager',auth.uid() is not null and exists(select 1 from public.event_memberships where user_id=auth.uid() and event_id='20261106-0000-4000-8000-000000000003') and exists(select 1 from public.club_accounts where (user_id=auth.uid() or linked_user_id=auth.uid()) and enabled and activated_at is not null)
 )
$f$;
revoke all on function public.suzini_e3_preview_role() from public;
grant execute on function public.suzini_e3_preview_role() to anon,authenticated;
