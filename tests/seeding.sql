do $test$ declare n integer;i integer;ids uuid[];layout jsonb;a uuid[];b uuid[];o uuid[];begin
for n in 3..8 loop
 select array_agg(lpad(x::text,32,'0')::uuid order by x) into ids from generate_series(1,n)x;
 for i in 1..100 loop
  layout:=suzini_e3_private.seeded_layout(ids);
  a:=array(select jsonb_array_elements_text(layout->'pool_a')::uuid);b:=array(select jsonb_array_elements_text(layout->'pool_b')::uuid);o:=array(select jsonb_array_elements_text(layout->'draw_order')::uuid);
  if layout->'seeds'<>to_jsonb(ids[1:2]) then raise exception 'Seed order failed';end if;
  if (select count(distinct x) from unnest(a||b||o)x)<>n or cardinality(a||b||o)<>n then raise exception 'Unique assignment failed';end if;
  if n<=5 and a[1:2]<>ids[1:2] then raise exception 'Single pool seeds failed';end if;
  if n=6 and (cardinality(a)<>3 or cardinality(b)<>3 or not ids[2]=any(a) or not ids[1]=any(b)) then raise exception 'Separated pools failed';end if;
  if n>=7 and (cardinality(o)<>n or o[1]<>ids[2] or o[n]<>ids[1]) then raise exception 'Bracket placement failed';end if;
 end loop;
end loop;
end;$test$;
