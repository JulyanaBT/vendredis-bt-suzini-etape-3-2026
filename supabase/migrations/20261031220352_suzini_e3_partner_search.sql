create table suzini_e3_private.partner_profiles (
 id uuid primary key default gen_random_uuid(), owner_token uuid not null default gen_random_uuid(),
 first_name text not null check(length(first_name) between 1 and 60), last_name text not null check(length(last_name) between 1 and 60),
 licence text not null check(licence ~ '^[0-9]{7}[A-Z]$'), division text not null check(division in ('DD','DM')),
 phone text not null check(phone ~ '^[0-9]{10,15}$'), description text not null check(length(description) between 10 and 600),
 active boolean not null default true, created_at timestamptz not null default now()
);
create unique index suzini_e3_partner_active_licence on suzini_e3_private.partner_profiles(licence) where active;
alter table suzini_e3_private.partner_profiles enable row level security;
revoke all on suzini_e3_private.partner_profiles from public,anon,authenticated;
create table suzini_e3_private.partner_invites (
 id uuid primary key default gen_random_uuid(), profile_id uuid not null references suzini_e3_private.partner_profiles(id),
 proposer jsonb not null, status text not null default 'pending' check(status in ('pending','accepted','refused')),
 created_at timestamptz not null default now()
);
create index suzini_e3_partner_invite_profile on suzini_e3_private.partner_invites(profile_id);
alter table suzini_e3_private.partner_invites enable row level security;
revoke all on suzini_e3_private.partner_invites from public,anon,authenticated;
create function public.suzini_e3_partners(p_action text,p_data jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare pr suzini_e3_private.partner_profiles; iv suzini_e3_private.partner_invites; result jsonb; player jsonb;
 fn text;ln text;lic text;dv text;ph text;descr text; team jsonb;
begin
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
  if ph !~ '^[0-9]{10,15}$' or coalesce(length(descr),0) not between 10 and 600 or p_data->>'consent'<>'true' then raise exception 'Vérifiez le numéro WhatsApp, la description et votre accord de publication.';end if;
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
  team:=jsonb_build_object('epreuve',pr.division,'p1FirstName',pr.first_name,'p1LastName',pr.last_name,'p1Licence',pr.licence,'p2FirstName',player->>'first_name','p2LastName',player->>'last_name','p2Licence',player->>'licence');
  result:=public.suzini_e3_register_payment(team);
  update suzini_e3_private.partner_invites set status='accepted' where id=iv.id;
  update suzini_e3_private.partner_profiles set active=false where licence in(pr.licence,player->>'licence');
  return result;
 end if;
 raise exception 'Action inconnue.';
exception when unique_violation then raise exception 'Une recherche est déjà active pour cette licence.';
end;$$;
revoke all on function public.suzini_e3_partners(text,jsonb) from public;
grant execute on function public.suzini_e3_partners(text,jsonb) to anon,authenticated;
