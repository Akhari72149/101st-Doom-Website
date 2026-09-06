grant select, insert, update, delete on
  public.discord_announcements,
  public.discord_attendance_events,
  public.discord_attendance_options,
  public.discord_attendance_responses
to roster_app_runtime;

alter table public.discord_attendance_events
  add column if not exists reminder_claimed_at timestamptz,
  add column if not exists roles_cleanup_claimed_at timestamptz;

alter table public.discord_attendance_events
  drop constraint if exists discord_attendance_events_status_check;
alter table public.discord_attendance_events
  add constraint discord_attendance_events_status_check
  check (status in ('scheduled', 'sending', 'sent', 'closed', 'cancelled', 'failed'));

do $policies$
declare table_name text;
begin
  foreach table_name in array array[
    'discord_announcements',
    'discord_attendance_events',
    'discord_attendance_options',
    'discord_attendance_responses'
  ] loop
    execute format(
      'drop policy if exists %I on public.%I',
      'native runtime ' || table_name,
      table_name
    );
    execute format(
      'create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)',
      'native runtime ' || table_name,
      table_name
    );
  end loop;
end $policies$;
