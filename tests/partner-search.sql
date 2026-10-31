begin;
update public.events set published=true,registration_open=true where id='20261106-0000-4000-8000-000000000003';
do $$
declare p jsonb;i jsonb;r jsonb;v jsonb;pr jsonb;
begin
 pr:='{"first_name":"Essai","last_name":"Partenaire","licence":"7654321Z","division":"DD","phone":"+594694000001","description":"Profil de test transactionnel","consent":true}'::jsonb;
 begin perform public.suzini_e3_partners('post',pr-'consent');raise exception 'TEST missing consent accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 p:=public.suzini_e3_partners('post',pr);
 v:=public.suzini_e3_partners('list');
 if not exists(select 1 from jsonb_array_elements(v) x where x->>'id'=p->>'id') then raise exception 'TEST profile missing';end if;
 if exists(select 1 from jsonb_array_elements(v) x where x ? 'phone' or x ? 'licence' or x ? 'last_name' or x ? 'owner_token') then raise exception 'TEST private data leaked';end if;
 begin perform public.suzini_e3_partners('post',pr);raise exception 'TEST duplicate accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform public.suzini_e3_partners('withdraw',jsonb_build_object('id',p->>'id','token',gen_random_uuid()));raise exception 'TEST invalid token accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 begin perform public.suzini_e3_partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DM'));raise exception 'TEST wrong division accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 i:=public.suzini_e3_partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DD'));
 perform public.suzini_e3_partners('refuse',jsonb_build_object('id',i->>'id'));
 if public.suzini_e3_partners('view_invite',jsonb_build_object('id',i->>'id'))->>'status'<>'refused' then raise exception 'TEST refusal failed';end if;
 i:=public.suzini_e3_partners('propose',jsonb_build_object('id',p->>'id','first_name','Second','last_name','Test','licence','7654322Z','division','DD'));
 r:=public.suzini_e3_partners('accept',jsonb_build_object('id',i->>'id'));
 if not(r ? 'token' and r ? 'id') then raise exception 'TEST receipt missing';end if;
 if exists(select 1 from jsonb_array_elements(public.suzini_e3_partners('list')) x where x->>'id'=p->>'id') then raise exception 'TEST accepted profile still public';end if;
 begin perform public.suzini_e3_partners('accept',jsonb_build_object('id',i->>'id'));raise exception 'TEST replay accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
 update public.events set registration_open=false where id='20261106-0000-4000-8000-000000000003';
 begin perform public.suzini_e3_partners('post',pr);raise exception 'TEST closed registration accepted';exception when raise_exception then if sqlerrm like 'TEST%' then raise;end if;end;
end;$$;
rollback;
