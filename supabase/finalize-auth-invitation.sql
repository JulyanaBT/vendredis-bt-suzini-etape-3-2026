
create function public.suzini_e3_finalize_invite(p_user uuid) returns boolean language plpgsql security definer set search_path='' as $f$
declare u auth.users; a public.club_accounts;
begin
 select * into u from auth.users where id=p_user;
 if not found then raise exception 'Compte introuvable.';end if;
 if u.raw_app_meta_data->>'club_invitation_id' is not null then
 select * into a from public.club_accounts where id=(u.raw_app_meta_data->>'club_invitation_id')::uuid for update;
 if not found or a.event_ids<>array['20261106-0000-4000-8000-000000000003'::uuid] or a.invitation_hash is null or a.invitation_hash is distinct from u.raw_app_meta_data->>'club_invitation_hash' then raise exception 'Preuve d’invitation invalide.';end if;
 perform public.suzini_e3_attach_existing_invite(a.invitation_hash,p_user);
 update auth.users set raw_app_meta_data=raw_app_meta_data-'club_invitation_id'-'club_invitation_hash' where id=p_user;
 end if;
 if not exists(select 1 from public.club_accounts where (user_id=p_user or linked_user_id=p_user) and enabled and activated_at is not null and event_ids @> array['20261106-0000-4000-8000-000000000003'::uuid]) or not exists(select 1 from public.event_memberships where user_id=p_user and event_id='20261106-0000-4000-8000-000000000003') then raise exception 'Accès Club non finalisé.';end if;
 return true;
end;$f$;
revoke all on function public.suzini_e3_finalize_invite(uuid) from public,anon,authenticated;
grant execute on function public.suzini_e3_finalize_invite(uuid) to service_role;
