drop policy if exists "medal staff can award medals" on public.personnel_awards;

create policy "medal staff can award medals"
  on public.personnel_awards
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and lower(ur.role) in ('admin', 'nco', 'akhari')
    )
    and exists (
      select 1
      from public.awards as award
      where award.id = personnel_awards.award_id
        and award.award_type = 'manual'
        and award.is_active = true
    )
  );
