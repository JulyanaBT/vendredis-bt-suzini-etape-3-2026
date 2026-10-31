create or replace function public.suzini_e3_mail_claim(p_token text default null,p_actor uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c suzini_e3_private.mail_config;secret text;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 select * into c from suzini_e3_private.mail_config where singleton for update;
 select decrypted_secret into secret from vault.decrypted_secrets where id=c.cron_secret;
 if not (coalesce(p_token=secret,false) or exists(select 1 from public.organizers where user_id=p_actor)) then raise exception 'Accès refusé.' using errcode='42501';end if;
 if not c.enabled or c.password_secret is null then return jsonb_build_object('ready',false);end if;
 if c.lease_until>now() then return jsonb_build_object('ready',false,'busy',true);end if;
 update suzini_e3_private.mail_config set lease_until=now()+interval '100 seconds',last_attempt=now() where singleton;
 return jsonb_build_object('ready',true,'password',(select decrypted_secret from vault.decrypted_secrets where id=c.password_secret),'started_at',c.started_at,'last_uid',c.last_uid,'uid_validity',c.uid_validity,'product',c.product_name);
end;$$;
create or replace function public.suzini_e3_mail_finish(p_uid bigint,p_validity text,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$begin
 if auth.role() is distinct from 'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 update suzini_e3_private.mail_config set last_uid=case when p_validity=uid_validity then greatest(last_uid,p_uid) else p_uid end,uid_validity=p_validity,lease_until=null,last_success=case when p_error is null then now() else last_success end,last_error=p_error where singleton;
end;$$;
create or replace function public.suzini_e3_mail_ingest(p_order jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare cfg suzini_e3_private.mail_config;oid uuid;matches integer;tid uuid;player integer;already boolean;begin
 if auth.role() is distinct from 'service_role' then raise exception 'Accès refusé.' using errcode='42501';end if;
 perform pg_advisory_xact_lock(6112026);
 select * into cfg from suzini_e3_private.mail_config where singleton;
 if not cfg.enabled or (p_order->>'received_at')::timestamptz<cfg.started_at then return 'ignored';end if;
 if p_order->>'order_key' is null or length(p_order->>'order_key')>160 then raise exception 'Référence invalide.';end if;
 insert into suzini_e3_private.mail_orders(order_key,order_number,message_id,received_at,buyer_name,amount_cents,product_name,verified,details,reason)
 values(p_order->>'order_key',p_order->>'order_number',p_order->>'message_id',(p_order->>'received_at')::timestamptz,left(p_order->>'buyer_name',160),nullif(p_order->>'amount_cents','')::int,left(p_order->>'product_name',300),coalesce((p_order->>'verified')::boolean,false),left(p_order->>'details',10000),left(p_order->>'reason',500)) on conflict(order_key) do nothing returning id into oid;
 if oid is null then return 'duplicate';end if;
 if not coalesce((p_order->>'verified')::boolean,false) or not coalesce((p_order->>'eligible')::boolean,false) or (p_order->>'amount_cents')::int is distinct from 1000 or (p_order->>'product_name') is distinct from cfg.product_name then return 'pending';end if;
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
