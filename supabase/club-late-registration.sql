CREATE OR REPLACE FUNCTION public.suzini_e3_club_register(p_team jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
declare new_id uuid; receipt uuid; is_late boolean; d text; l1 text; l2 text;
begin
 perform public.suzini_e3_club();
 perform 1 from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 is_late:=not coalesce((public.suzini_e3_status()->>'open')::boolean,false);
 d:=p_team->>'epreuve';
 if d is null or d not in ('DM','DD') then raise exception 'Choisissez une épreuve.';end if;
 if coalesce(p_team->>'_website','')<>'' then raise exception 'Envoi refusé.';end if;
 l1:=upper(regexp_replace(coalesce(p_team->>'p1Licence',''),'[[:space:]]','','g'));
 l2:=upper(regexp_replace(coalesce(p_team->>'p2Licence',''),'[[:space:]]','','g'));
 if l1 !~ '^[0-9]{1,7}[A-Z]?$' or l2 !~ '^[0-9]{1,7}[A-Z]?$' then raise exception 'Vérifiez les licences FFT.';end if;
 if is_late then
 -- Invalidate the affected draw before inserting: the roster trigger also
 -- clears its format/pools. Preserve recorded scores and the old plan for JA review.
 update suzini_e3_private.programmes set drawn_at=null,draw_published_at=null,
 draw_order='{}',seeds='{}' where division=d;
 end if;
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence)
 values('20261106-0000-4000-8000-000000000003',d,
 left(btrim(p_team->>'p1FirstName')||' / '||btrim(p_team->>'p2FirstName'),40),
 btrim(p_team->>'p1FirstName'),btrim(p_team->>'p1LastName'),l1,
 btrim(p_team->>'p2FirstName'),btrim(p_team->>'p2LastName'),l2) returning id into new_id;
 insert into suzini_e3_private.payments(team_id) values(new_id) returning receipt_token into receipt;
 if is_late then
 update public.suzini_e3_controls set pages=array(select distinct x from unnest(coalesce(pages,'{}'::text[])||array['programmation.html']) x) where id=true;
 end if;
 return jsonb_build_object('id',new_id,'token',receipt,'matches_maintenance',is_late);
exception when check_violation or not_null_violation then
 raise exception 'Vérifiez les noms et licences FFT des deux joueurs.';
end;$function$;
revoke all on function public.suzini_e3_club_register(jsonb) from public,anon;
grant execute on function public.suzini_e3_club_register(jsonb) to authenticated;
