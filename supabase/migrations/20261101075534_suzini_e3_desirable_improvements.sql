create table suzini_e3_private.form_tokens(id uuid primary key default gen_random_uuid(),origin_hash text not null,issued_at timestamptz not null default now(),used_at timestamptz);
create index suzini_e3_form_origin_time on suzini_e3_private.form_tokens(origin_hash,issued_at);
alter table suzini_e3_private.form_tokens enable row level security;
revoke all on suzini_e3_private.form_tokens from public,anon,authenticated;
create function suzini_e3_private.form_origin() returns text language sql stable set search_path='' as $$
select md5(coalesce(nullif((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'cf-connecting-ip',''),nullif((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'x-real-ip',''),split_part((coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb)->>'x-forwarded-for',',',1),'internal'));
$$;
revoke all on function suzini_e3_private.form_origin() from public,anon,authenticated;
create function public.suzini_e3_form_token() returns uuid language plpgsql security definer set search_path='' as $$
declare origin text:=suzini_e3_private.form_origin(); token uuid;
begin
 perform pg_advisory_xact_lock(hashtextextended(origin,0));
 if (select count(*) from suzini_e3_private.form_tokens where origin_hash=origin and issued_at>now()-interval '10 minutes')>=60 then raise exception 'Trop de tentatives. Patientez quelques minutes ou contactez le club.';end if;
 insert into suzini_e3_private.form_tokens(origin_hash) values(origin) returning id into token;return token;
end;$$;
revoke all on function public.suzini_e3_form_token() from public;
grant execute on function public.suzini_e3_form_token() to anon,authenticated;
create function suzini_e3_private.check_form(p_data jsonb) returns void language plpgsql security definer set search_path='' as $$
declare origin text:=suzini_e3_private.form_origin();tok suzini_e3_private.form_tokens;
begin
 if coalesce(p_data->>'_website','')<>'' then raise exception 'Envoi refusé. Contactez le club si le problème persiste.';end if;
 perform pg_advisory_xact_lock(hashtextextended(origin,0));
 if (select count(*) from suzini_e3_private.form_tokens where origin_hash=origin and used_at>now()-interval '10 minutes')>=10 then raise exception 'Trop d’envois rapprochés. Patientez dix minutes ou contactez le club.';end if;
 begin select * into tok from suzini_e3_private.form_tokens where id=(p_data->>'_guard')::uuid and origin_hash=origin for update;exception when invalid_text_representation then raise exception 'Actualisez le formulaire avant de réessayer.';end;
 if tok.id is null or tok.used_at is not null or tok.issued_at<now()-interval '2 hours' then raise exception 'Actualisez le formulaire avant de réessayer.';end if;
 if tok.issued_at>clock_timestamp()-interval '2 seconds' then raise exception 'Patientez deux secondes puis réessayez.';end if;
 update suzini_e3_private.form_tokens set used_at=clock_timestamp() where id=tok.id;
end;$$;
revoke all on function suzini_e3_private.check_form(jsonb) from public,anon,authenticated;
create table suzini_e3_private.change_log(id bigint generated always as identity primary key,changed_at timestamptz not null default now(),actor uuid,entity text not null,entity_id uuid,operation text not null,before_data jsonb,after_data jsonb);
alter table suzini_e3_private.change_log enable row level security;
revoke all on suzini_e3_private.change_log from public,anon,authenticated;
create function suzini_e3_private.record_change() returns trigger language plpgsql security definer set search_path='' as $$
declare b jsonb; a jsonb; eid uuid;
begin
 if TG_OP<>'INSERT' then b:=to_jsonb(old)-'receipt_token'-'owner_token';end if;
 if TG_OP<>'DELETE' then a:=to_jsonb(new)-'receipt_token'-'owner_token';end if;
 if TG_TABLE_NAME='bt250_teams' and coalesce(a->>'event_id',b->>'event_id')<>'20261106-0000-4000-8000-000000000003' then return null;end if;
 if b is not distinct from a then return null;end if;
 eid:=coalesce(a->>'team_id',a->>'id',b->>'team_id',b->>'id')::uuid;
 insert into suzini_e3_private.change_log(actor,entity,entity_id,operation,before_data,after_data) values(auth.uid(),TG_TABLE_NAME,eid,TG_OP,b,a);
 return null;
end;$$;
revoke all on function suzini_e3_private.record_change() from public,anon,authenticated;
create trigger suzini_e3_audit_teams after insert or update or delete on public.bt250_teams for each row execute function suzini_e3_private.record_change();
create trigger suzini_e3_audit_payments after insert or update or delete on suzini_e3_private.payments for each row execute function suzini_e3_private.record_change();
create trigger suzini_e3_audit_partners after insert or update or delete on suzini_e3_private.partner_profiles for each row execute function suzini_e3_private.record_change();
create function public.suzini_e3_club_tools(p_action text,p_id uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform public.suzini_e3_club(); -- Existing membership and maintenance checks.
 if p_action='partners' then
  select coalesce(jsonb_agg(to_jsonb(p)-'owner_token' order by p.created_at desc),'[]'::jsonb) into result from suzini_e3_private.partner_profiles p;return result;
 elsif p_action='close_partner' then
  update suzini_e3_private.partner_profiles set active=false where id=p_id;
  if not found then raise exception 'Recherche introuvable.';end if;return '{"ok":true}'::jsonb;
 elsif p_action='history' then
  select coalesce(jsonb_agg(x order by x.changed_at desc,x.id desc),'[]'::jsonb) into result from (
   select l.id,l.changed_at,l.entity,l.entity_id,l.operation,l.before_data,l.after_data,
   coalesce((select c.username from public.club_accounts c where c.user_id=l.actor limit 1),case when l.actor is null then 'Automatique / public' when exists(select 1 from public.organizers o where o.user_id=l.actor) then 'Administrateur' else 'Gestionnaire' end) as actor
   from suzini_e3_private.change_log l where p_id is null or l.entity_id=p_id order by l.changed_at desc,l.id desc limit 200
  ) x;return result;
 end if;
 raise exception 'Action inconnue.';
end;$$;
revoke all on function public.suzini_e3_club_tools(text,uuid) from public,anon;
grant execute on function public.suzini_e3_club_tools(text,uuid) to authenticated;

CREATE OR REPLACE FUNCTION public.suzini_e3_teams()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
with players as (
 select p1_first_name as first_name,p1_last_name as last_name,p1_licence as licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select p2_first_name,p2_last_name,p2_licence from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
), homonyms as (select lower(btrim(first_name)) as name from players group by 1 having count(distinct licence)>1), labels as (
 select t.*, t.p1_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p1_first_name))) then ' '||left(t.p1_last_name,1)||'.' else '' end as player1,
 t.p2_first_name||case when exists(select 1 from homonyms where name=lower(btrim(t.p2_first_name))) then ' '||left(t.p2_last_name,1)||'.' else '' end as player2
 from public.bt250_teams t join public.events e on e.id=t.event_id and e.published where t.event_id='20261106-0000-4000-8000-000000000003'
) select coalesce(jsonb_agg(jsonb_build_object('id',id,'division',division,'team_name',player1||' / '||player2,'player1',player1,'player2',player2,'p1_first_name',p1_first_name,'p1_last_name',upper(left(btrim(p1_last_name),1)),'p2_first_name',p2_first_name,'p2_last_name',upper(left(btrim(p2_last_name),1)),'player1_name',p1_first_name||' '||upper(left(btrim(p1_last_name),1))||'.','player2_name',p2_first_name||' '||upper(left(btrim(p2_last_name),1))||'.','p1_rank',p1_rank,'p2_rank',p2_rank,'team_rank',p1_rank+p2_rank,'paid_players',coalesce((select p.p1_paid::int+p.p2_paid::int from suzini_e3_private.payments p where p.team_id=labels.id),case when payment_received then 2 else 0 end)) order by created_at),'[]'::jsonb) from labels;
$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_register(p_team jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare event_open boolean; result uuid; l1 text; l2 text;
begin
 perform suzini_e3_private.check_form(p_team);
 if exists(select 1 from public.suzini_e3_controls where 'inscriptions.html'=any(pages)) then raise exception 'Inscriptions temporairement en maintenance.';end if;
 select registration_open and published into event_open from public.events
 where id='20261106-0000-4000-8000-000000000003' for update;
 if not coalesce(event_open,false) then raise exception 'Les inscriptions ne sont pas encore ouvertes.';end if;
 if now()>='2026-11-05 00:00:00-03'::timestamptz then raise exception 'Les inscriptions sont closes depuis le 4 novembre.';end if;
 l1:=upper(regexp_replace(coalesce(p_team->>'p1Licence',''),'\s','','g'));
 l2:=upper(regexp_replace(coalesce(p_team->>'p2Licence',''),'\s','','g'));
 if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 and division=p_team->>'epreuve' and (p1_licence in(l1,l2) or p2_licence in(l1,l2)))
 then raise exception 'Un des joueurs est déjà inscrit dans cette épreuve. Contactez le club.';end if;
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p1_phone,p2_first_name,p2_last_name,p2_licence,p2_phone)
 values('20261106-0000-4000-8000-000000000003',p_team->>'epreuve',left(btrim(p_team->>'p1FirstName')||' / '||btrim(p_team->>'p2FirstName'),40),btrim(p_team->>'p1FirstName'),btrim(p_team->>'p1LastName'),l1,null,btrim(p_team->>'p2FirstName'),btrim(p_team->>'p2LastName'),l2,null) returning id into result;
 return result;
exception when check_violation or not_null_violation then raise exception 'Vérifiez les noms et licences FFT des deux joueurs.';
end;$function$;
CREATE OR REPLACE FUNCTION public.suzini_e3_partners(p_action text, p_data jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare pr suzini_e3_private.partner_profiles; iv suzini_e3_private.partner_invites; result jsonb; player jsonb;
 fn text;ln text;lic text;dv text;ph text;descr text; team jsonb;
begin
 if p_action in ('post','propose') then perform suzini_e3_private.check_form(p_data);end if;
 if p_action='list' then
  select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'first_name',p.first_name,'division',p.division,'description',p.description) order by p.created_at desc),'[]'::jsonb) into result
  from suzini_e3_private.partner_profiles p where p.active and now()<'2026-11-05 00:00:00-03'::timestamptz
  and not exists(select 1 from public.bt250_teams t where t.event_id='20261106-0000-4000-8000-000000000003' and (t.p1_licence=p.licence or t.p2_licence=p.licence));return result;
 end if;
 if p_action='withdraw' then
  update suzini_e3_private.partner_profiles set active=false where id=(p_data->>'id')::uuid and owner_token=(p_data->>'token')::uuid;
  if not found then raise exception 'Lien de gestion invalide.';end if;return '{"ok":true}'::jsonb;
 end if;
 if p_action='view_invite' then
  select * into iv from suzini_e3_private.partner_invites where id=(p_data->>'id')::uuid;
  if not found then raise exception 'Proposition introuvable.';end if;
  select * into pr from suzini_e3_private.partner_profiles where id=iv.profile_id;
  return jsonb_build_object('status',iv.status,'active',pr.active,'first_name',pr.first_name,'division',pr.division,'proposer_first',iv.proposer->>'first_name','proposer_last',iv.proposer->>'last_name');
 end if;
 if p_action='refuse' then
  update suzini_e3_private.partner_invites set status='refused' where id=(p_data->>'id')::uuid and status='pending';
  if not found then raise exception 'Proposition déjà traitée ou introuvable.';end if;return '{"ok":true}'::jsonb;
 end if;
 -- Same event lock as team registration serializes acceptance and capacity checks.
 perform 1 from public.events where id='20261106-0000-4000-8000-000000000003' for update;
 if not coalesce((public.suzini_e3_status()->>'open')::boolean,false) or exists(select 1 from public.suzini_e3_controls where 'inscriptions.html'=any(pages)) then raise exception 'Les inscriptions et recherches sont fermées.';end if;
 if p_action='post' or p_action='propose' then
  fn:=btrim(p_data->>'first_name');ln:=btrim(p_data->>'last_name');lic:=upper(btrim(p_data->>'licence'));dv:=p_data->>'division';
  if coalesce(length(fn),0) not between 1 and 60 or coalesce(length(ln),0) not between 1 and 60 or coalesce(lic,'') !~ '^[0-9]{7}[A-Z]$' or coalesce(dv,'') not in ('DD','DM') then raise exception 'Vérifiez les noms, la licence FFT et le tableau.';end if;
  if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and (p1_licence=lic or p2_licence=lic)) then raise exception 'Ce joueur est déjà inscrit. Contactez le club.';end if;
 end if;
 if p_action='post' then
  ph:=regexp_replace(coalesce(p_data->>'phone',''),'[^0-9]','','g');if left(ph,2)='00' then ph:=substr(ph,3);end if;if left(ph,1)='0' then ph:='594'||substr(ph,2);end if;
  descr:=btrim(p_data->>'description');
  if ph !~ '^[0-9]{10,15}$' or coalesce(length(descr),0) not between 10 and 600 or coalesce(p_data->>'consent','false')<>'true' then raise exception 'Vérifiez le numéro WhatsApp, la description et votre accord de publication.';end if;
  if (select count(*) from suzini_e3_private.partner_profiles where active)>=100 then raise exception 'Contactez le club pour publier votre recherche.';end if;
  insert into suzini_e3_private.partner_profiles(first_name,last_name,licence,division,phone,description) values(fn,ln,lic,dv,ph,descr) returning * into pr;
  return jsonb_build_object('id',pr.id,'token',pr.owner_token);
 end if;
 if p_action='contact' or p_action='propose' then
  select * into pr from suzini_e3_private.partner_profiles where id=(p_data->>'id')::uuid and active for update;
  if not found then raise exception 'Cette recherche n’est plus disponible.';end if;
  if exists(select 1 from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003' and (p1_licence=pr.licence or p2_licence=pr.licence)) then raise exception 'Cette personne est déjà inscrite.';end if;
  if p_action='contact' then return jsonb_build_object('phone',pr.phone,'first_name',pr.first_name);end if;
  if dv<>pr.division or lic=pr.licence then raise exception 'Choisissez un partenaire du même tableau, avec une autre licence.';end if;
  if (select count(*) from suzini_e3_private.partner_invites where profile_id=pr.id and created_at>now()-interval '1 hour')>=10 then raise exception 'Trop de propositions. Contactez cette personne en privé.';end if;
  insert into suzini_e3_private.partner_invites(profile_id,proposer) values(pr.id,jsonb_build_object('first_name',fn,'last_name',ln,'licence',lic)) returning * into iv;
  return jsonb_build_object('id',iv.id,'phone',pr.phone,'first_name',pr.first_name);
 end if;
 if p_action='accept' then
  select * into iv from suzini_e3_private.partner_invites where id=(p_data->>'id')::uuid for update;
  if not found or iv.status<>'pending' then raise exception 'Proposition déjà traitée ou introuvable.';end if;
  select * into pr from suzini_e3_private.partner_profiles where id=iv.profile_id and active for update;
  if not found then raise exception 'Cette recherche n’est plus disponible.';end if;
  player:=iv.proposer;
  team:=jsonb_build_object('epreuve',pr.division,'p1FirstName',pr.first_name,'p1LastName',pr.last_name,'p1Licence',pr.licence,'p2FirstName',player->>'first_name','p2LastName',player->>'last_name','p2Licence',player->>'licence','_guard',p_data->>'_guard','_website',p_data->>'_website');
  result:=public.suzini_e3_register_payment(team);
  update suzini_e3_private.partner_invites set status='accepted' where id=iv.id;
  update suzini_e3_private.partner_profiles set active=false where licence in(pr.licence,player->>'licence');
  return result;
 end if;
 raise exception 'Action inconnue.';
exception when unique_violation then raise exception 'Une recherche est déjà active pour cette licence.';
end;$function$;

