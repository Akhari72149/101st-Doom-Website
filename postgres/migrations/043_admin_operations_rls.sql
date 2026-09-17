drop policy if exists "native runtime rank insert" on public.ranks;
create policy "native runtime rank insert"
  on public.ranks for insert to roster_app_runtime with check (true);

drop policy if exists "native runtime rank update" on public.ranks;
create policy "native runtime rank update"
  on public.ranks for update to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime xp profile insert" on public.personnel_xp_profiles;
create policy "native runtime xp profile insert"
  on public.personnel_xp_profiles for insert to roster_app_runtime with check (true);

drop policy if exists "native runtime xp profile update" on public.personnel_xp_profiles;
create policy "native runtime xp profile update"
  on public.personnel_xp_profiles for update to roster_app_runtime using (true) with check (true);

drop policy if exists "native runtime weekly xp insert" on public.personnel_xp_weekly_stats;
create policy "native runtime weekly xp insert"
  on public.personnel_xp_weekly_stats for insert to roster_app_runtime with check (true);

drop policy if exists "native runtime weekly xp update" on public.personnel_xp_weekly_stats;
create policy "native runtime weekly xp update"
  on public.personnel_xp_weekly_stats for update to roster_app_runtime using (true) with check (true);

grant execute on function public.calculate_arma_xp_level(integer) to roster_app_runtime;

alter table public.system_job_runs enable row level security;
drop policy if exists "native runtime system job reads" on public.system_job_runs;
create policy "native runtime system job reads"
  on public.system_job_runs for select to roster_app_runtime using (true);
drop policy if exists "native scheduler system job writes" on public.system_job_runs;
create policy "native scheduler system job writes"
  on public.system_job_runs for insert to roster_app_scheduler with check (true);

alter table public.personnel_xp_adjustments enable row level security;
drop policy if exists "native runtime xp adjustment reads" on public.personnel_xp_adjustments;
create policy "native runtime xp adjustment reads"
  on public.personnel_xp_adjustments for select to roster_app_runtime using (true);
drop policy if exists "native runtime xp adjustment writes" on public.personnel_xp_adjustments;
create policy "native runtime xp adjustment writes"
  on public.personnel_xp_adjustments for insert to roster_app_runtime with check (true);
