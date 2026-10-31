create function suzini_e3_private.reopening_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.id='20261106-0000-4000-8000-000000000003'::uuid and new.registration_open and not old.registration_open then
  if exists(select 1 from suzini_e3_private.programmes where drawn_at is not null) then raise exception 'Le tirage est effectué : la réouverture des inscriptions est bloquée.';end if;
  update suzini_e3_private.programmes set validated_at=null,validated_by=null,team_count=null,team_ids='{}',pool_a='{}',pool_b='{}';
 end if;return new;
end;$$;
revoke all on function suzini_e3_private.reopening_guard() from public,anon,authenticated;
create trigger suzini_e3_reopening_guard before update of registration_open on public.events for each row execute function suzini_e3_private.reopening_guard();
