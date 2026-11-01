
create table suzini_e3_private.site_info(singleton boolean primary key default true check(singleton),data jsonb not null,revision integer not null default 1,updated_at timestamptz not null default now(),updated_by uuid);
alter table suzini_e3_private.site_info enable row level security;
revoke all on suzini_e3_private.site_info from public,anon,authenticated;
insert into suzini_e3_private.site_info(singleton,data) values(true,$seed${"access":{"venue":"Tennis Club de Suzini","address":"217 Route de Suzini\n97354 Rémire-Montjoly · Guyane française","welcome":"Accueil et contrôle des licences pour tous à 17 h 45, heure de Guyane."},"flyer":{"image":"../assets/img/flyer-vendredis-suzini-etape-3.jpg","document":"../assets/docs/flyer-vendredis-suzini-etape-3.pdf"},"contacts":{"organisation_email":"tcsuzini.beachtennis@gmail.com","group":"https://chat.whatsapp.com/Kk8uAXuZplX1Tw0g2rHtp6","people":[{"id":"quentin","section":"organisation","name":"Quentin","phone":"+33 6 60 06 36 92","email":""},{"id":"melanie","section":"organisation","name":"Mélanie","phone":"+33 6 13 25 54 75","email":""},{"id":"lucas","section":"organisation","name":"Lucas","phone":"+594 694 37 21 40","email":""},{"id":"jules","section":"ja","name":"Jules","phone":"+594 694 40 60 99","email":""},{"id":"support","section":"support","name":"Jul’Yana","phone":"+594 694 40 60 99","email":"contact@julyanabt.fr"}]}}$seed$::jsonb);
create function public.suzini_e3_info() returns jsonb language sql stable security definer set search_path='' as $f$
 select data||jsonb_build_object('revision',revision) from suzini_e3_private.site_info where singleton is true
$f$;
revoke all on function public.suzini_e3_info() from public;
grant execute on function public.suzini_e3_info() to anon,authenticated;
create function public.suzini_e3_info_save(p_section text,p_data jsonb,p_revision integer) returns jsonb language plpgsql security definer set search_path='' as $f$
declare v_revision integer; v_person jsonb; v_field text;
begin
 perform public.suzini_e3_club();
 if p_section not in('access','contacts','flyer') or jsonb_typeof(p_data)<>'object' then raise exception 'Informations invalides.';end if;
 select revision into v_revision from suzini_e3_private.site_info where singleton is true for update;
 if p_revision is distinct from v_revision then raise exception 'Ces informations ont été modifiées ailleurs. Rechargez la page avant de réessayer.';end if;
 if p_section='access' then
 foreach v_field in array array['venue','address','welcome'] loop
 if coalesce(length(btrim(p_data->>v_field)),0) not between 1 and 3000 then raise exception 'Renseignez le lieu, l’adresse et les informations d’accueil.';end if;
 end loop;
 elsif p_section='contacts' then
 if jsonb_typeof(p_data->'people') is distinct from 'array' or jsonb_array_length(p_data->'people')>50 then raise exception 'Liste de contacts invalide.';end if;
 if coalesce(p_data->>'organisation_email','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_data->>'organisation_email')>254 then raise exception 'Adresse e-mail invalide.';end if;
 if coalesce(p_data->>'group','')!~'^https://chat\.whatsapp\.com/[A-Za-z0-9]+$' then raise exception 'Lien du groupe WhatsApp invalide.';end if;
 for v_person in select value from jsonb_array_elements(p_data->'people') loop
 if coalesce(v_person->>'section','') not in('organisation','ja','support') or coalesce(length(btrim(v_person->>'name')),0) not between 1 and 100 or coalesce(v_person->>'id','')!~'^[a-zA-Z0-9-]{1,50}$' then raise exception 'Contact invalide.';end if;
 if coalesce(v_person->>'email','')<>'' and (v_person->>'email'!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(v_person->>'email')>254) then raise exception 'Adresse e-mail invalide.';end if;
 if coalesce(v_person->>'phone','')<>'' and (v_person->>'phone'!~'^\+?[0-9 ().-]{6,30}$') then raise exception 'Téléphone invalide.';end if;
 end loop;
 if (select count(*)<>count(distinct value->>'id') from jsonb_array_elements(p_data->'people')) then raise exception 'Contacts en double.';end if;
 else
 if coalesce(p_data->>'image','')!~'^https://qbtjtdfpwkkgezpncdnf\.supabase\.co/storage/v1/object/public/suzini-e3-flyers/[a-f0-9-]+\.(jpg|png|webp)$' then raise exception 'Image du flyer invalide.';end if;
 if coalesce(p_data->>'document','')<>'' and p_data->>'document'!~'^https://qbtjtdfpwkkgezpncdnf\.supabase\.co/storage/v1/object/public/suzini-e3-flyers/[a-f0-9-]+\.pdf$' then raise exception 'Document du flyer invalide.';end if;
 end if;
 update suzini_e3_private.site_info set data=jsonb_set(data,array[p_section],p_data),revision=revision+1,updated_at=now(),updated_by=auth.uid() where singleton is true;
 return public.suzini_e3_info();
end;$f$;
revoke all on function public.suzini_e3_info_save(text,jsonb,integer) from public,anon;
grant execute on function public.suzini_e3_info_save(text,jsonb,integer) to authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('suzini-e3-flyers','suzini-e3-flyers',true,20971520,array['image/jpeg','image/png','image/webp','application/pdf']);
create function suzini_e3_private.can_edit_info() returns boolean language sql stable security definer set search_path='' as $f$
select auth.uid() is not null and (exists(select 1 from public.organizers where user_id=auth.uid()) or (exists(select 1 from public.event_memberships where event_id='20261106-0000-4000-8000-000000000003' and user_id=auth.uid()) and not exists(select 1 from public.suzini_e3_controls where club_blocked)));
$f$;
revoke all on function suzini_e3_private.can_edit_info() from public,anon;
grant execute on function suzini_e3_private.can_edit_info() to authenticated;
create policy suzini_e3_flyer_upload on storage.objects for insert to authenticated with check(bucket_id='suzini-e3-flyers' and name~'^[a-f0-9-]+\.(jpg|png|webp|pdf)$' and suzini_e3_private.can_edit_info());
