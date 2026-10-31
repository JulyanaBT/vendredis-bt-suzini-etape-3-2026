begin;
do $test$
declare tid uuid; o jsonb; r text; actor uuid; status jsonb;
begin
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 update suzini_e3_private.mail_config set enabled=true,started_at=now()-interval '1 minute',product_name='TEST article';
 insert into public.bt250_teams(event_id,division,team_name,p1_first_name,p1_last_name,p1_licence,p2_first_name,p2_last_name,p2_licence)
 values('20261106-0000-4000-8000-000000000003','DM','TEST sync','UniqueSync','Fixture','9999998Z','SecondSync','Fixture','9999999Z') returning id into tid;
 o:=jsonb_build_object('order_key','TEST-sync-1','received_at',now(),'buyer_name','Fixture UniqueSync','amount_cents',1000,'product_name','TEST article','verified',true,'eligible',true);
 r:=public.suzini_e3_mail_ingest(o); if r<>'matched' then raise exception 'unique match: %',r;end if;
 if not (select p1_paid and not p2_paid from suzini_e3_private.payments where team_id=tid) then raise exception 'partial payment failed';end if;
 if public.suzini_e3_mail_ingest(o)<>'duplicate' then raise exception 'duplicate failed';end if;
 if public.suzini_e3_mail_ingest(o||'{"order_key":"TEST-sync-2"}')<>'pending' then raise exception 'already paid failed';end if;
 if public.suzini_e3_mail_ingest(o||'{"order_key":"TEST-sync-null","buyer_name":"Fixture SecondSync","amount_cents":null}')<>'pending' then raise exception 'null amount failed';end if;
 if public.suzini_e3_mail_ingest(o||'{"order_key":"TEST-sync-3","amount_cents":2000}')<>'pending' then raise exception 'group failed';end if;
 select user_id into actor from public.organizers limit 1;
 perform set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',actor)::text,true);
 status:=public.suzini_e3_mail_manage('assign',jsonb_build_object('id',(select id from suzini_e3_private.mail_orders where order_key='TEST-sync-3'),'team_id',tid,'players',jsonb_build_array(1,2)));
 if status ? 'password' or status ? 'password_secret' or status ? 'cron_secret' then raise exception 'secret exposed';end if;
 if not (select p1_paid and p2_paid from suzini_e3_private.payments where team_id=tid) then raise exception 'manual group failed';end if;
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 begin
  perform public.suzini_e3_mail_ingest(o); raise exception 'guard failed';
 exception when insufficient_privilege then null;end;
 begin
  perform public.suzini_e3_mail_manage('status');raise exception 'club guard failed';
 exception when insufficient_privilege then null;end;
end;$test$;
rollback;
