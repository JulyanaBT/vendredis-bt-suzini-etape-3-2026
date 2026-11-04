begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.organizers limit 1),true);
do $test$
declare s jsonb;d jsonb;ids uuid[];layout jsonb;ds jsonb:='[]';i int;
begin
update suzini_e3_private.registration_control set state='suspended' where singleton=true;
s:=public.suzini_e3_match_state(false);
if (s->>'registration_closed')::boolean or jsonb_array_length(s->'matches')<>0 then raise exception 'Suspension leaked real matches';end if;
s:=public.suzini_e3_match_manager_state(false);
if jsonb_array_length(s->'matches')<>0 then raise exception 'Manager suspension leaked matches';end if;
begin perform public.suzini_e3_programme_manage('validate','DM');raise exception 'Suspension allowed format validation';exception when others then if sqlerrm='Suspension allowed format validation' then raise;end if;end;
update suzini_e3_private.registration_control set state='closed' where singleton=true;
s:=public.suzini_e3_match_state(false);
if jsonb_array_length(s->'matches')<>12 then raise exception 'Closed four-team pools should yield 12 matches, got %',jsonb_array_length(s->'matches');end if;
for d in select value from jsonb_array_elements((select programme->'divisions' from suzini_e3_private.match_simulation)) loop
select array_agg((value->>'id')::uuid order by (value->>'p1_rank')::int+(value->>'p2_rank')::int) into ids from suzini_e3_private.match_simulation cross join lateral jsonb_array_elements(teams) where value->>'division'=d->>'division';
layout:=suzini_e3_private.seeded_layout(ids);
ds:=ds||jsonb_build_array(d||layout||jsonb_build_object('validated_at',now(),'validated_count',(d->>'count')::int,'drawn_at',now(),'draw_published_at',null));
end loop;
update suzini_e3_private.match_simulation set programme=jsonb_set(programme,'{divisions}',ds) where singleton=true;
s:=public.suzini_e3_match_manager_state(true);
if jsonb_array_length(s->'matches')<>0 then raise exception 'Prepared private draw leaked manager matches';end if;
s:=public.suzini_e3_match_state(true);
if jsonb_array_length(s->'matches')<>0 then raise exception 'Prepared draw leaked public matches';end if;
for i in 0..1 loop update suzini_e3_private.match_simulation set programme=jsonb_set(programme,array['divisions',i::text,'draw_published_at'],to_jsonb(now()-interval '1 minute')) where singleton=true;end loop;
s:=public.suzini_e3_match_manager_state(true);
if jsonb_array_length(s->'matches')<>0 then raise exception 'Ongoing draw leaked manager matches';end if;
s:=public.suzini_e3_match_state(true);
if jsonb_array_length(s->'matches')<>0 then raise exception 'Ongoing draw leaked public matches';end if;
for i in 0..1 loop update suzini_e3_private.match_simulation set programme=jsonb_set(programme,array['divisions',i::text,'draw_published_at'],to_jsonb(now()-interval '10 minutes')) where singleton=true;end loop;
s:=public.suzini_e3_match_state(true);
if jsonb_array_length(s->'matches')=0 then raise exception 'Completed draw must publish matches';end if;
s:=public.suzini_e3_match_manager_state(true);
if jsonb_array_length(s->'matches')=0 then raise exception 'Completed draw must publish manager matches';end if;
end;$test$;
rollback;