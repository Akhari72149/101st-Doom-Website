do $$
declare
  legacy_rank public.ranks%rowtype;
  canonical_rank public.ranks%rowtype;
begin
  select * into legacy_rank
    from public.ranks
   where upper(name) = 'CX-V'
   order by is_active desc, rank_level, id
   limit 1;

  if legacy_rank.id is null then
    return;
  end if;

  select * into canonical_rank
    from public.ranks
   where upper(name) = 'CVX'
   order by is_active desc, rank_level, id
   limit 1;

  if canonical_rank.id is null then
    update public.ranks
       set name = 'CVX'
     where id = legacy_rank.id;
    return;
  end if;

  update public.ranks
     set rank_level = legacy_rank.rank_level,
         discord_role_id = coalesce(legacy_rank.discord_role_id, canonical_rank.discord_role_id),
         is_active = legacy_rank.is_active or canonical_rank.is_active
   where id = canonical_rank.id;

  update public.rank_history
     set old_rank_id = canonical_rank.id
   where old_rank_id = legacy_rank.id;

  update public.rank_history
     set new_rank_id = canonical_rank.id
   where new_rank_id = legacy_rank.id;

  update public.audit_logs
     set old_rank_id = canonical_rank.id
   where old_rank_id = legacy_rank.id;

  update public.audit_logs
     set target_rank_id = canonical_rank.id
   where target_rank_id = legacy_rank.id;

  alter table public.personnel disable trigger set_personnel_rank_effective_at;
  update public.personnel
     set rank_id = canonical_rank.id
   where rank_id = legacy_rank.id;
  alter table public.personnel enable trigger set_personnel_rank_effective_at;

  delete from public.ranks where id = legacy_rank.id;
end;
$$;
