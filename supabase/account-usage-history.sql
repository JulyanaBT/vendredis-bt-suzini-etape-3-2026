
create function public.suzini_e3_usage_history(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $f$
declare result jsonb;
begin
 if not public.suzini_e3_is_admin() then raise exception 'Accès réservé à l’administrateur.' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=p_user) then raise exception 'Compte introuvable.';end if;
 select coalesce(jsonb_agg(jsonb_build_object('at',occurred_at,'label',label) order by occurred_at desc),'[]'::jsonb) into result from (
 select distinct occurred_at,label from (
 select created_at as occurred_at,'Compte créé'::text as label from auth.users where id=p_user
 union all select last_sign_in_at,'Dernière connexion connue' from auth.users where id=p_user and last_sign_in_at is not null
 union all select min(first_sign_in_at),'Première connexion enregistrée' from public.club_accounts where (user_id=p_user or linked_user_id=p_user) and first_sign_in_at is not null
 union all select max(last_activity_at),'Dernier accès Club enregistré' from public.club_accounts where (user_id=p_user or linked_user_id=p_user) and last_activity_at is not null
 union all select changed_at,case entity when 'payments' then 'Paiement mis à jour' when 'bt250_teams' then case operation when 'INSERT' then 'Équipe inscrite' when 'DELETE' then 'Équipe supprimée' else 'Équipe modifiée' end else 'Modification dans l’espace Club' end from suzini_e3_private.change_log where actor=p_user
 ) events where occurred_at is not null order by occurred_at desc limit 50
 ) recent;
 return jsonb_build_object('events',result,'limit',50);
end;$f$;
revoke all on function public.suzini_e3_usage_history(uuid) from public,anon;
grant execute on function public.suzini_e3_usage_history(uuid) to authenticated;
