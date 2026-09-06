grant select on
  public.certifications,
  public.audit_logs,
  public.awards,
  public.personnel_awards,
  public.personnel_steam_links,
  public.personnel_xp_profiles,
  public.personnel_xp_weekly_stats,
  public.personnel_xp_weekly_target_stats,
  public.personnel_medical_profiles,
  public.personnel_medical_weekly_stats
to roster_app_runtime;

drop policy if exists "native runtime certifications" on public.certifications;
create policy "native runtime certifications"
  on public.certifications for select to roster_app_runtime using (true);

drop policy if exists "native runtime audit logs" on public.audit_logs;
create policy "native runtime audit logs"
  on public.audit_logs for select to roster_app_runtime using (true);

drop policy if exists "native runtime awards" on public.awards;
create policy "native runtime awards"
  on public.awards for select to roster_app_runtime using (true);

drop policy if exists "native runtime personnel awards" on public.personnel_awards;
create policy "native runtime personnel awards"
  on public.personnel_awards for select to roster_app_runtime using (true);

drop policy if exists "native runtime steam links" on public.personnel_steam_links;
create policy "native runtime steam links"
  on public.personnel_steam_links for select to roster_app_runtime using (true);

drop policy if exists "native runtime xp profiles" on public.personnel_xp_profiles;
create policy "native runtime xp profiles"
  on public.personnel_xp_profiles for select to roster_app_runtime using (true);

drop policy if exists "native runtime weekly xp" on public.personnel_xp_weekly_stats;
create policy "native runtime weekly xp"
  on public.personnel_xp_weekly_stats for select to roster_app_runtime using (true);

drop policy if exists "native runtime weekly xp targets" on public.personnel_xp_weekly_target_stats;
create policy "native runtime weekly xp targets"
  on public.personnel_xp_weekly_target_stats for select to roster_app_runtime using (true);

drop policy if exists "native runtime medical profiles" on public.personnel_medical_profiles;
create policy "native runtime medical profiles"
  on public.personnel_medical_profiles for select to roster_app_runtime using (true);

drop policy if exists "native runtime weekly medical" on public.personnel_medical_weekly_stats;
create policy "native runtime weekly medical"
  on public.personnel_medical_weekly_stats for select to roster_app_runtime using (true);
