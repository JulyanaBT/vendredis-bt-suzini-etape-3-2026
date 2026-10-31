create schema if not exists suzini_e3_private;
revoke all on schema suzini_e3_private from public,anon,authenticated;
create table suzini_e3_private.ranking_sources(
 division text primary key check(division in ('DD','DM')), label text not null, source_sha256 text not null,
 source_month date not null, page_count integer not null, row_count integer not null, max_rank integer not null, imported_at timestamptz not null default now()
);
create table suzini_e3_private.rankings(
 division text not null references suzini_e3_private.ranking_sources(division),licence text not null check(licence ~ '^[0-9]{1,7}$'),
 first_name text not null,last_name text not null, rank integer not null check(rank>0), page integer not null check(page>0),primary key(division,licence)
);
alter table suzini_e3_private.ranking_sources enable row level security;
alter table suzini_e3_private.rankings enable row level security;
revoke all on all tables in schema suzini_e3_private from public,anon,authenticated;
create function suzini_e3_private.normalized_name(value text) returns text language sql immutable strict set search_path='' as $$
 select regexp_replace(lower(replace(replace(regexp_replace(normalize(value,NFKD),U&'[\0300-\036f]','','g'),'œ','oe'),'æ','ae')),'[^a-z0-9]','','g');
$$;
create function suzini_e3_private.licence_number(value text) returns text language sql immutable strict set search_path='' as $$
 select case when regexp_replace(upper(value),'[[:space:]]','','g') ~ '^[0-9]{1,7}[A-Z]?$'
 then coalesce(nullif(ltrim(regexp_replace(regexp_replace(upper(value),'[[:space:]]','','g'),'[A-Z]$',''),'0'),''),'0') else null end;
$$;
create index rankings_name_idx on suzini_e3_private.rankings(suzini_e3_private.normalized_name(last_name),suzini_e3_private.normalized_name(first_name));
create index rankings_licence_idx on suzini_e3_private.rankings(licence);
alter table public.bt250_teams add column p1_rank_status text not null default 'pending' check(p1_rank_status in ('pending','matched','unlisted','conflict')),
 add column p2_rank_status text not null default 'pending' check(p2_rank_status in ('pending','matched','unlisted','conflict')),
 add column p1_rank_issue jsonb,add column p2_rank_issue jsonb;
create function suzini_e3_private.resolve_ranking(p_division text,p_licence text,p_first_name text,p_last_name text) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare licence_key text; ref suzini_e3_private.rankings; source suzini_e3_private.ranking_sources; matches jsonb; count_found integer;
begin
 select * into source from suzini_e3_private.ranking_sources where division=p_division;
 if not found then return jsonb_build_object('status','pending','rank',null,'issue',jsonb_build_object('code','source_missing','message','Classement de référence indisponible.'));end if;
 licence_key:=suzini_e3_private.licence_number(p_licence);
 if licence_key is null then return jsonb_build_object('status','conflict','rank',null,'issue',jsonb_build_object('code','invalid_licence','message','Numéro de licence invalide.','matches','[]'::jsonb));end if;
 select count(*) into count_found from suzini_e3_private.rankings where licence=licence_key;
 select coalesce(jsonb_agg(jsonb_build_object('division',r.division,'first_name',r.first_name,'last_name',r.last_name,'licence',r.licence,'rank',r.rank,'page',r.page,'source',s.label) order by r.division),'[]'::jsonb) into matches from suzini_e3_private.rankings r join suzini_e3_private.ranking_sources s using(division) where licence=licence_key;
 if count_found>1 then return jsonb_build_object('status','conflict','rank',null,'issue',jsonb_build_object('code','ambiguous_licence','message','Cette licence apparaît plusieurs fois dans les références.','matches',matches));end if;
 if count_found=1 then
  select * into ref from suzini_e3_private.rankings where licence=licence_key;
  if ref.division<>p_division then return jsonb_build_object('status','conflict','rank',null,'issue',jsonb_build_object('code','division_mismatch','message','Cette licence figure dans le classement de l’autre épreuve.','matches',matches));end if;
  if suzini_e3_private.normalized_name(ref.first_name)<>suzini_e3_private.normalized_name(p_first_name) or suzini_e3_private.normalized_name(ref.last_name)<>suzini_e3_private.normalized_name(p_last_name) then
   return jsonb_build_object('status','conflict','rank',null,'issue',jsonb_build_object('code','identity_mismatch','message','Le nom ou le prénom ne correspond pas à cette licence dans le fichier.','matches',matches));
  end if;
  return jsonb_build_object('status','matched','rank',ref.rank,'issue',null);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('division',r.division,'first_name',r.first_name,'last_name',r.last_name,'licence',r.licence,'rank',r.rank,'page',r.page,'source',s.label) order by r.division,r.licence),'[]'::jsonb) into matches from suzini_e3_private.rankings r join suzini_e3_private.ranking_sources s using(division)
 where suzini_e3_private.normalized_name(r.first_name)=suzini_e3_private.normalized_name(p_first_name) and suzini_e3_private.normalized_name(r.last_name)=suzini_e3_private.normalized_name(p_last_name);
 if jsonb_array_length(matches)>0 then return jsonb_build_object('status','conflict','rank',null,'issue',jsonb_build_object('code','licence_mismatch','message','Ce nom figure dans les documents avec une autre licence.','matches',matches));end if;
 return jsonb_build_object('status','unlisted','rank',source.max_rank+1,'issue',null);
end;$$;
create function suzini_e3_private.assign_rankings() returns trigger language plpgsql security invoker set search_path='' as $$
declare a jsonb;b jsonb;
begin
 if new.event_id<>'20261106-0000-4000-8000-000000000003' then return new;end if;
 a:=suzini_e3_private.resolve_ranking(new.division,new.p1_licence,new.p1_first_name,new.p1_last_name);
 b:=suzini_e3_private.resolve_ranking(new.division,new.p2_licence,new.p2_first_name,new.p2_last_name);
 new.p1_rank:=(a->>'rank')::integer;new.p1_rank_status:=a->>'status';new.p1_rank_issue:=nullif(a->'issue','null'::jsonb);
 new.p2_rank:=(b->>'rank')::integer;new.p2_rank_status:=b->>'status';new.p2_rank_issue:=nullif(b->'issue','null'::jsonb);
 return new;
end;$$;
revoke all on all functions in schema suzini_e3_private from public,anon,authenticated;
