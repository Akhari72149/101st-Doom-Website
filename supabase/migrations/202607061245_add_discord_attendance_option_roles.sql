alter table public.discord_attendance_options
  add column if not exists assign_role_id text;

alter table public.discord_attendance_events
  add column if not exists roles_removed_at timestamptz;

create index if not exists discord_attendance_events_role_cleanup_idx
  on public.discord_attendance_events (status, event_starts_at)
  where roles_removed_at is null;
