create or replace function suzini_e3_private.normalized_name(value text) returns text language sql immutable strict set search_path='' as $$
 select regexp_replace(replace(replace(lower(regexp_replace(normalize(value,NFKD),U&'[\0300-\036f]','','g')),'œ','oe'),'æ','ae'),'[^a-z0-9]','','g');
$$;
-- Rebuild the expression index after the normalization refinement.
reindex index suzini_e3_private.rankings_name_idx;
do $$begin
 if (select count(*) from suzini_e3_private.ranking_sources)<>2 or exists(select 1 from suzini_e3_private.ranking_sources s where s.row_count<>(select count(*) from suzini_e3_private.rankings r where r.division=s.division) or s.max_rank<>(select max(rank) from suzini_e3_private.rankings r where r.division=s.division)) then raise exception 'Importer et vérifier les deux PDF avant activation.';end if;
end$$;
create trigger suzini_e3_assign_rankings before insert or update on public.bt250_teams for each row execute function suzini_e3_private.assign_rankings();
update public.bt250_teams set p1_rank=p1_rank where event_id='20261106-0000-4000-8000-000000000003';
