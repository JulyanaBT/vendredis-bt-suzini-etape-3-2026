begin;
do $test$
declare rows jsonb;p jsonb;r jsonb;checked timestamptz;paid boolean;team uuid;player int;plan_before text;
begin
rows:=public.suzini_e3_reception();
if jsonb_array_length(rows)<>(select count(*)*2 from suzini_e3_private.active_teams where event_id='20261106-0000-4000-8000-000000000003') then raise exception 'Missing reception players';end if;
select value into p from jsonb_array_elements(rows) where not(value->>'paid')::boolean and value->>'checked_at' is null limit 1;
if p is null then raise exception 'No unpaid test player';end if;
team:=(p->>'team_id')::uuid;player:=(p->>'player')::int;paid:=(p->>'paid')::boolean;
r:=public.suzini_e3_reception('check',team,player,true,null);
select (value->>'checked_at')::timestamptz into checked from jsonb_array_elements(r) where value->>'team_id'=team::text and (value->>'player')::int=player;
if checked is null then raise exception 'Check-in missing';end if;
if exists(select 1 from jsonb_array_elements(r) where value->>'team_id'=team::text and (value->>'player')::int=player and (value->>'paid')::boolean is distinct from paid) then raise exception 'Check-in changed payment';end if;
begin perform public.suzini_e3_reception('check',team,player,false,null);raise exception 'Stale update accepted' using errcode='P9999';
exception when sqlstate 'P9999' then raise;when others then if sqlerrm not like 'La vérification a changé%' then raise;end if;end;
r:=public.suzini_e3_reception('check',team,player,false,checked);
if exists(select 1 from jsonb_array_elements(r) where value->>'team_id'=team::text and (value->>'player')::int=player and value->>'checked_at' is not null) then raise exception 'Undo failed';end if;
if not exists(select 1 from jsonb_array_elements(rows) where value->>'first_name'='Lucas' and value->>'constraint' like '%3e%') then raise exception 'Lucas constraint missing';end if;
end;$test$;
select 'Reception: all players, persistent check/undo, unchanged payment and stale update protection passed' as verification;
rollback;