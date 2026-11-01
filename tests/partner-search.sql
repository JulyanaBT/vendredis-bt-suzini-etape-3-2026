begin;
create function pg_temp.ready_doc(d jsonb) returns jsonb language plpgsql security definer set search_path='' as $$declare t uuid;begin t:=public.suzini_e3_form_token();update suzini_e3_private.form_tokens set issued_at=clock_timestamp()-interval '3 seconds' where id=t;return d||jsonb_build_object('_guard',t);end;$$;
create function pg_temp.partners(a text,d jsonb default '{}'::jsonb) returns jsonb language plpgsql as $$begin if a in('post','propose','accept') then d:=pg_temp.ready_doc(d);end if;return public.suzini_e3_partners(a,d);end;$$;
update public.events set published=true,registration_open=true where id='20261106-0000-4000-8000-000000000003';
do $$
declare p jsonb;i jsonb;r jsonb;v jsonb;pr jsonb;
begin
 pr:='{"first_name":"Essai","last_name":"Partenaire","licence":"7654321Z","division":"DD","phone":"+594694000001","description":"Profil de test transactionnel","consent":true}'::jsonb;
 begin perform pg_temp.partners('post',pr-'consent');raise exception 'TEST missing consent accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 p:=pg_temp.partners('post',pr);
 v:=pg_temp.partners('list');
 if not exists(select 1 from jsonb_array_elements(v) x where x->>'id'=p->>'id') then raise exception 'TEST profile missing';end if;
 if exists(select 1 from jsonb_array_elements(v) x where x ? 'phone' or x ? 'licence' or x ? 'last_name' or x ? 'owner_token') then raise exception 'TEST private data leaked';end if;
 begin perform pg_temp.partners('post',pr);raise exception 'TEST duplicate accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform pg_temp.partners('withdraw',jsonb_build_object('id',p->>'id','token',gen_random_uuid()));raise exception 'TEST invalid token accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform pg_temp.partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DM'));raise exception 'TEST wrong division accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 i:=pg_temp.partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DD'));
 perform pg_temp.partners('refuse',jsonb_build_object('id',i->>'id'));
 if pg_temp.partners('view_invite',jsonb_build_object('id',i->>'id'))->>'status'<>'refused' then raise exception 'TEST refusal failed';end if;
 i:=pg_temp.partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DD'));
 r:=pg_temp.partners('accept',jsonb_build_object('id',i->>'id'));
 if not(r ? 'token' and r ? 'id') then raise exception 'TEST receipt missing';end if;
 if exists(select 1 from jsonb_array_elements(pg_temp.partners('list')) x where x->>'id'=p->>'id') then raise exception 'TEST accepted profile still public';end if;
 begin perform pg_temp.partners('accept',jsonb_build_object('id',i->>'id'));raise exception 'TEST replay accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
 begin perform pg_temp.partners('post',pr);raise exception 'TEST closed registration accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
end;$$;
rollback;
