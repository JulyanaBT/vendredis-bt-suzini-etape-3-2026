CREATE OR REPLACE FUNCTION public.suzini_e3_validate_result(p_simulation boolean, p_division text, p_match text, p_score jsonb, p_revision integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare state jsonb;d jsonb;m jsonb;s jsonb;st jsonb;va int;vb int;sa int:=0;sb int:=0;ga int:=0;gb int:=0;target int;super_a int;super_b int;w uuid;existing suzini_e3_private.match_results;dep text;
begin
 perform public.suzini_e3_club();
 if p_division not in('DM','DD') or p_division is null then raise exception 'Tableau invalide.';end if;
 if p_simulation then perform 1 from suzini_e3_private.match_simulation where singleton is true for update;
 else perform 1 from suzini_e3_private.programmes where division=p_division for update;end if;
 state:=public.suzini_e3_match_state(p_simulation);
 select value into d from jsonb_array_elements(state->'divisions') where value->>'division'=p_division;
 if not p_simulation and (public.suzini_e3_status()->>'open')::boolean then raise exception 'Clôturez les inscriptions avant de saisir les résultats réels.';end if;
 if not p_simulation and d->>'validated_at' is null then perform public.suzini_e3_programme_manage('validate',p_division);end if;
 select value into m from jsonb_array_elements(state->'matches') where value->>'division'=p_division and value->>'id'=p_match;
 if m is null or m->>'a' !~ '^[0-9a-f-]{36}$' or m->>'b' !~ '^[0-9a-f-]{36}$' then raise exception 'Les équipes de ce match ne sont pas encore déterminées.';end if;
 for dep in select value from jsonb_array_elements_text(m->'deps') loop
 if not exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=dep) then raise exception 'Validez d’abord les matchs précédents de cette phase.';end if;
 end loop;
 select * into existing from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id=p_match for update;
 if coalesce(existing.revision,0)<>p_revision then raise exception 'Ce résultat a changé. Actualisez avant de le modifier.';end if;
 if existing.match_id is not null and exists(select 1 from suzini_e3_private.match_results where simulation=p_simulation and division=p_division and match_id<>p_match and match_id not like 'POOL%' and match_id<>'TS-FINAL') then raise exception 'Un tour suivant est déjà joué. Faites corriger la progression par le juge-arbitre.';end if;
 if coalesce((p_score->>'override')::boolean,false) then
 if jsonb_typeof(p_score->'sets') is distinct from 'array' or jsonb_array_length(p_score->'sets') not between 1 and 3 then raise exception 'Renseignez les scores.';end if;
 for st in select value from jsonb_array_elements(p_score->'sets') loop
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,8}$' or st->>1 !~ '^[0-9]{1,8}$' then raise exception 'Scores entiers positifs ou nuls requis.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;ga:=ga+va;gb:=gb+vb;
 if va>vb then sa:=sa+1;elsif vb>va then sb:=sb+1;end if;
 end loop;
 if p_score ? 'super' then
 st:=p_score->'super';
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,8}$' or st->>1 !~ '^[0-9]{1,8}$' then raise exception 'Score du super tie-break invalide.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;
 if va>vb then sa:=sa+1;ga:=ga+1;elsif vb>va then sb:=sb+1;gb:=gb+1;end if;
 end if;
 if ga+gb=0 then raise exception 'Renseignez au moins un score.';end if;
 if p_score->>'winner' not in ('a','b') or p_score->>'winner' is null then raise exception 'Indiquez l’équipe gagnante.';end if;
 w:=case when p_score->>'winner'='a' then (m->>'a')::uuid else (m->>'b')::uuid end;
 else
 if jsonb_typeof(p_score->'sets') is distinct from 'array' or jsonb_array_length(p_score->'sets')<>2 then raise exception 'Renseignez les deux sets.';end if;
 target:=case when (m->>'format')::int=4 then 6 else 4 end;
 for st in select value from jsonb_array_elements(p_score->'sets') loop
 if jsonb_typeof(st) is distinct from 'array' or jsonb_array_length(st)<>2 or st->>0 !~ '^[0-9]{1,2}$' or st->>1 !~ '^[0-9]{1,2}$' then raise exception 'Score de set invalide.';end if;
 va:=(st->>0)::int;vb:=(st->>1)::int;
 if not ((greatest(va,vb)=target and least(va,vb)<=target-2) or (greatest(va,vb)=target+1 and least(va,vb) in(target-1,target))) then raise exception 'Set incomplet ou incompatible avec le format de match.';end if;
 if va>vb then sa:=sa+1;else sb:=sb+1;end if;ga:=ga+va;gb:=gb+vb;
 end loop;
 if sa=1 and sb=1 then
 if jsonb_typeof(p_score->'super') is distinct from 'array' or jsonb_array_length(p_score->'super')<>2 or p_score->'super'->>0 !~ '^[0-9]{1,3}$' or p_score->'super'->>1 !~ '^[0-9]{1,3}$' then raise exception 'À un set partout, renseignez le super tie-break.';end if;
 super_a:=(p_score->'super'->>0)::int;super_b:=(p_score->'super'->>1)::int;
 if not ((greatest(super_a,super_b)=10 and least(super_a,super_b)<=8) or (greatest(super_a,super_b)>10 and abs(super_a-super_b)=2)) then raise exception 'Super tie-break : 10 points minimum et deux points d’écart.';end if;
 if super_a>super_b then sa:=sa+1;ga:=ga+1;else sb:=sb+1;gb:=gb+1;end if;
 elsif p_score ? 'super' and p_score->'super'<>'null'::jsonb then raise exception 'Pas de super tie-break après deux sets gagnés.';end if;
 w:=case when sa>sb then (m->>'a')::uuid else (m->>'b')::uuid end;
 end if;
 if existing.match_id is not null then
 if (w<>existing.winner or ((d->>'count')::int=6 and m->>'phase'='poules')) and exists(
 with recursive affected as (
 select value as job from jsonb_array_elements(state->'matches') where value->>'division'=p_division and (value->'deps') ? p_match
 union
 select next_job.value from affected a cross join lateral jsonb_array_elements(state->'matches') next_job(value)
 where next_job.value->>'division'=p_division and (next_job.value->'deps') ? (a.job->>'id')
 )
 select 1 from affected a cross join lateral jsonb_array_elements(coalesce(state->'planning','[]')) plan(value)
 where plan.value->>'division'=p_division and plan.value->>'id'=a.job->>'id'
 and plan.value->>'started_at' is not null and a.job->'result'='null'::jsonb
 ) then raise exception 'Cette correction pourrait modifier les équipes d’un match déjà en cours. Contactez le juge-arbitre.';end if;
 p_score:=p_score||jsonb_build_object('corrected_at',now());
 end if;
 insert into suzini_e3_private.match_results(simulation,division,match_id,team_a,team_b,winner,score,sets_a,sets_b,games_a,games_b,validated_by) values(p_simulation,p_division,p_match,(m->>'a')::uuid,(m->>'b')::uuid,w,p_score,sa,sb,ga,gb,auth.uid())
 on conflict(simulation,division,match_id) do update set score=excluded.score,winner=excluded.winner,sets_a=excluded.sets_a,sets_b=excluded.sets_b,games_a=excluded.games_a,games_b=excluded.games_b,validated_by=auth.uid(),revision=match_results.revision+1;
 return public.suzini_e3_match_state(p_simulation);
end;$function$;