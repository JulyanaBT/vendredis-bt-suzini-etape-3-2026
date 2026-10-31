create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;
create table suzini_e3_private.mail_config(
 singleton boolean primary key default true check(singleton),
 enabled boolean not null default false, password_secret uuid, cron_secret uuid,
 started_at timestamptz, last_uid bigint not null default 0, uid_validity text,
 lease_until timestamptz, last_attempt timestamptz,last_success timestamptz,last_error text,
 product_name text not null default '', updated_at timestamptz not null default now());
alter table suzini_e3_private.mail_config enable row level security;
revoke all on suzini_e3_private.mail_config from public,anon,authenticated;
insert into suzini_e3_private.mail_config(cron_secret) values(vault.create_secret(gen_random_uuid()::text||gen_random_uuid()::text,'suzini_e3_mail_cron'));
create table suzini_e3_private.mail_orders(
 id uuid primary key default gen_random_uuid(), order_key text not null unique,
 order_number text, message_id text, received_at timestamptz not null,
 buyer_name text, amount_cents integer, product_name text,
 verified boolean not null default false, details text, reason text,
 state text not null default 'pending' check(state in ('pending','matched','ignored')),
 team_id uuid references public.bt250_teams(id), players integer[],
 reviewed_by uuid, reviewed_at timestamptz,created_at timestamptz not null default now());
alter table suzini_e3_private.mail_orders enable row level security;
revoke all on suzini_e3_private.mail_orders from public,anon,authenticated;
create function public.suzini_e3_mail_manage(p_action text default 'status',p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare cfg suzini_e3_private.mail_config; sid uuid; oid uuid;tid uuid;pl integer[];o suzini_e3_private.mail_orders;actor uuid:=auth.uid();begin
 perform public.suzini_e3_club('list');
 select * into cfg from suzini_e3_private.mail_config where singleton;
 if p_action in ('configure','pause') then
  if not exists(select 1 from public.organizers where user_id=actor) then raise exception 'Configuration réservée à l’administrateur.' using errcode='42501';end if;
  if p_action='configure' then
   if length(btrim(coalesce(p_data->>'password','')))<8 or length(btrim(coalesce(p_data->>'product','')))<5 then raise exception 'Indiquez le mot de passe d’appareil et le libellé exact de l’article.';end if;
   if cfg.password_secret is null then sid:=vault.create_secret(p_data->>'password','suzini_e3_mail_password');else sid:=cfg.password_secret;perform vault.update_secret(sid,p_data->>'password');end if;
   update suzini_e3_private.mail_config set password_secret=sid,product_name=btrim(p_data->>'product'),enabled=true,started_at=coalesce(started_at,now()),last_error=null,updated_at=now() where singleton;
  else update suzini_e3_private.mail_config set enabled=false,updated_at=now() where singleton;end if;
 elsif p_action in ('assign','ignore') then
  oid:=(p_data->>'id')::uuid;select * into o from suzini_e3_private.mail_orders where id=oid for update;
  if not found or o.state<>'pending' then raise exception 'Confirmation déjà traitée ou introuvable.';end if;
  if p_action='ignore' then update suzini_e3_private.mail_orders set state='ignored',reviewed_by=actor,reviewed_at=now() where id=oid;
  else
   tid:=(p_data->>'team_id')::uuid;select array_agg(x::integer order by x::integer) into pl from jsonb_array_elements_text(p_data->'players') x;
   if pl is null or not (pl=ARRAY[1] or pl=ARRAY[2] or pl=ARRAY[1,2]) then raise exception 'Sélectionnez un joueur ou les deux.';end if;
   if o.amount_cents is null or o.amount_cents<>1000*cardinality(pl) then raise exception 'Le montant ne correspond pas aux joueurs sélectionnés.';end if;
   perform public.suzini_e3_club('payment',tid,jsonb_build_object('player',pl[1],'paid',true));
   if cardinality(pl)=2 then perform public.suzini_e3_club('payment',tid,'{"player":2,"paid":true}'::jsonb);end if;
   update suzini_e3_private.mail_orders set state='matched',team_id=tid,players=pl,reviewed_by=actor,reviewed_at=now(),reason='Validé par le Club' where id=oid;
  end if;
 elsif p_action<>'status' then raise exception 'Action inconnue.';end if;
 select * into cfg from suzini_e3_private.mail_config where singleton;
 return jsonb_build_object('is_admin',exists(select 1 from public.organizers where user_id=actor),'configured',cfg.password_secret is not null,'enabled',cfg.enabled,'started_at',cfg.started_at,'last_attempt',cfg.last_attempt,'last_success',cfg.last_success,'last_error',cfg.last_error,'product',cfg.product_name,'orders',(select coalesce(jsonb_agg(to_jsonb(t)-'message_id' order by t.created_at desc),'[]'::jsonb) from (select * from suzini_e3_private.mail_orders order by created_at desc limit 100)t));
end;$$;
revoke all on function public.suzini_e3_mail_manage(text,jsonb) from public,anon;
grant execute on function public.suzini_e3_mail_manage(text,jsonb) to authenticated;
create function public.suzini_e3_mail_claim(p_token text default null,p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c suzini_e3_private.mail_config;secret text;begin
 if auth.role()<>'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 select * into c from suzini_e3_private.mail_config where singleton for update;
 select decrypted_secret into secret from vault.decrypted_secrets where id=c.cron_secret;
 if not (coalesce(p_token=secret,false) or exists(select 1 from public.organizers where user_id=p_actor)) then raise exception 'Accès refusé.' using errcode='42501';end if;
 if not c.enabled or c.password_secret is null then return jsonb_build_object('ready',false);end if;
 if c.lease_until>now() then return jsonb_build_object('ready',false,'busy',true);end if;
 update suzini_e3_private.mail_config set lease_until=now()+interval '100 seconds',last_attempt=now() where singleton;
 return jsonb_build_object('ready',true,'password',(select decrypted_secret from vault.decrypted_secrets where id=c.password_secret),'started_at',c.started_at,'last_uid',c.last_uid,'uid_validity',c.uid_validity,'product',c.product_name);
end;$$;
create function public.suzini_e3_mail_finish(p_uid bigint,p_validity text,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$begin
 if auth.role()<>'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 update suzini_e3_private.mail_config set last_uid=case when p_validity=uid_validity then greatest(last_uid,p_uid) else p_uid end,uid_validity=p_validity,lease_until=null,last_success=case when p_error is null then now() else last_success end,last_error=p_error where singleton;
end;$$;
create function public.suzini_e3_mail_ingest(p_order jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare cfg suzini_e3_private.mail_config;oid uuid;matches integer;tid uuid;player integer;already boolean;begin
 if auth.role()<>'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(6112026);
 select * into cfg from suzini_e3_private.mail_config where singleton;
 if not cfg.enabled or (p_order->>'received_at')::timestamptz<cfg.started_at then return 'ignored';end if;
 if p_order->>'order_key' is null or length(p_order->>'order_key')>160 then raise exception 'Référence invalide.';end if;
 insert into suzini_e3_private.mail_orders(order_key,order_number,message_id,received_at,buyer_name,amount_cents,product_name,verified,details,reason)
 values(p_order->>'order_key',p_order->>'order_number',p_order->>'message_id',(p_order->>'received_at')::timestamptz,left(p_order->>'buyer_name',160),nullif(p_order->>'amount_cents','')::int,left(p_order->>'product_name',300),coalesce((p_order->>'verified')::boolean,false),left(p_order->>'details',10000),left(p_order->>'reason',500)) on conflict(order_key) do nothing returning id into oid;
 if oid is null then return 'duplicate';end if;
 if not coalesce((p_order->>'verified')::boolean,false) or not coalesce((p_order->>'eligible')::boolean,false) or (p_order->>'amount_cents')::int<>1000 or p_order->>'product_name'<>cfg.product_name then return 'pending';end if;
 with people as (
 select id,1 n,p1_first_name f,p1_last_name l from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003'
 union all select id,2,p2_first_name,p2_last_name from public.bt250_teams where event_id='20261106-0000-4000-8000-000000000003')
 select count(*),min(id::text)::uuid,min(n) into matches,tid,player from people
 where suzini_e3_private.normalized_name(f||' '||l)=suzini_e3_private.normalized_name(p_order->>'buyer_name') or suzini_e3_private.normalized_name(l||' '||f)=suzini_e3_private.normalized_name(p_order->>'buyer_name');
 if matches<>1 then update suzini_e3_private.mail_orders set reason=case when matches=0 then 'Aucun joueur correspondant : vérifier le bénéficiaire' else 'Plusieurs joueurs correspondent au nom' end where id=oid;return 'pending';end if;
 perform 1 from public.bt250_teams where id=tid for update;
 insert into suzini_e3_private.payments(team_id) values(tid) on conflict do nothing;
 select case when player=1 then p1_paid else p2_paid end into already from suzini_e3_private.payments where team_id=tid for update;
 if already then update suzini_e3_private.mail_orders set reason='Ce joueur est déjà marqué payé : vérifier avant attribution' where id=oid;return 'pending';end if;
 update suzini_e3_private.payments set p1_paid=p1_paid or player=1,p2_paid=p2_paid or player=2 where team_id=tid;
 update public.bt250_teams set payment_received=(select p1_paid and p2_paid from suzini_e3_private.payments where team_id=tid) where id=tid;
 update suzini_e3_private.mail_orders set state='matched',team_id=tid,players=array[player],reviewed_at=now(),reason='Correspondance automatique : nom unique et paiement de 10 €' where id=oid;
 return 'matched';end;$$;
revoke all on function public.suzini_e3_mail_claim(text,uuid),public.suzini_e3_mail_finish(bigint,text,text),public.suzini_e3_mail_ingest(jsonb) from public,anon,authenticated;
grant execute on function public.suzini_e3_mail_claim(text,uuid),public.suzini_e3_mail_finish(bigint,text,text),public.suzini_e3_mail_ingest(jsonb) to service_role;
select cron.schedule('suzini-e3-mail-sync','*/5 * * * *',$cron$
 select net.http_post(url:='https://qbtjtdfpwkkgezpncdnf.supabase.co/functions/v1/suzini-e3-mail-sync',headers:=jsonb_build_object('Content-Type','application/json','X-Suzini-Mail-Token',(select v.decrypted_secret from vault.decrypted_secrets v join suzini_e3_private.mail_config c on c.cron_secret=v.id where c.enabled)),body:='{}'::jsonb,timeout_milliseconds:=90000) where exists(select 1 from suzini_e3_private.mail_config where enabled);
$cron$);
