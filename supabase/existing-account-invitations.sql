
alter table public.club_accounts add column if not exists linked_user_id uuid references auth.users(id) on delete set null;
create function public.suzini_e3_attach_existing_invite(p_hash text,p_user uuid) returns void language plpgsql security definer set search_path='' as $f$
declare invitation public.club_accounts; existing public.club_accounts; email_value text;
begin
 select * into invitation from public.club_accounts where invitation_hash=p_hash for update;
 if not found or not invitation.enabled or invitation.user_id is not null or invitation.activated_at is not null or invitation.invite_expires_at is null or invitation.invite_expires_at<=now() or invitation.event_ids<>array['20261106-0000-4000-8000-000000000003'::uuid] then raise exception 'Invitation indisponible.';end if;
 select email into email_value from auth.users where id=p_user;
 if email_value is null then raise exception 'Compte introuvable.';end if;
 select * into existing from public.club_accounts where user_id=p_user for update;
 if found then
 if not existing.enabled then raise exception 'Ce compte est suspendu. Contactez l’administrateur.';end if;
 update public.club_accounts set linked_user_id=p_user,activated_at=now(),invitation_hash=null,invite_expires_at=null,first_sign_in_at=now(),last_activity_at=now() where id=invitation.id;
 else
 update public.club_accounts set user_id=p_user,email=lower(email_value),activated_at=now(),invitation_hash=null,invite_expires_at=null,first_sign_in_at=now(),last_activity_at=now() where id=invitation.id;
 end if;
 insert into public.event_memberships(event_id,user_id) values('20261106-0000-4000-8000-000000000003',p_user) on conflict do nothing;
end;$f$;
revoke all on function public.suzini_e3_attach_existing_invite(text,uuid) from public,anon,authenticated;
grant execute on function public.suzini_e3_attach_existing_invite(text,uuid) to service_role;
create function public.suzini_e3_linked_access(p_id uuid,p_enabled boolean) returns void language plpgsql security definer set search_path='' as $f$
declare a public.club_accounts;
begin
 select * into a from public.club_accounts where id=p_id for update;
 if not found or a.linked_user_id is null or a.event_ids<>array['20261106-0000-4000-8000-000000000003'::uuid] then raise exception 'Compte introuvable.';end if;
 if exists(select 1 from public.organizers where user_id=a.linked_user_id) then raise exception 'Compte administrateur protégé.';end if;
 update public.club_accounts set enabled=p_enabled where id=p_id;
 if p_enabled then insert into public.event_memberships(event_id,user_id) values('20261106-0000-4000-8000-000000000003',a.linked_user_id) on conflict do nothing;
 else delete from public.event_memberships where event_id='20261106-0000-4000-8000-000000000003' and user_id=a.linked_user_id;end if;
end;$f$;
revoke all on function public.suzini_e3_linked_access(uuid,boolean) from public,anon,authenticated;
grant execute on function public.suzini_e3_linked_access(uuid,boolean) to service_role;
