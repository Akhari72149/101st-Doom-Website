grant select, insert, update on public.personnel, public.audit_logs, public.rank_history to roster_app_runtime;
grant select on public.ranks, public.personnel_certifications to roster_app_runtime;

drop policy if exists "native runtime personnel writes" on public.personnel;
create policy "native runtime personnel writes" on public.personnel for all to roster_app_runtime using (true) with check (true);
drop policy if exists "native runtime audit inserts" on public.audit_logs;
create policy "native runtime audit inserts" on public.audit_logs for insert to roster_app_runtime with check (true);
drop policy if exists "native runtime rank history inserts" on public.rank_history;
create policy "native runtime rank history inserts" on public.rank_history for insert to roster_app_runtime with check (true);

alter table public.discord_role_outbox drop constraint if exists discord_role_outbox_event_type_check;
alter table public.discord_role_outbox add constraint discord_role_outbox_event_type_check check (
  event_type in ('CERT_ROLE_SYNC','USER_ROLE_INIT','PERSONNEL_STATUS_SYNC','USER_FULL_IMPORT','SLOT_ROLE_SYNC','RANK_ROLE_SYNC')
);
