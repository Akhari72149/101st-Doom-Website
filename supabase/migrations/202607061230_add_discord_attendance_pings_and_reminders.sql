alter table public.discord_attendance_events
  add column if not exists ping_role_id text,
  add column if not exists reminder_enabled boolean not null default false,
  add column if not exists reminder_scheduled_at timestamptz,
  add column if not exists reminder_message text,
  add column if not exists reminder_role_id text,
  add column if not exists reminder_sent_at timestamptz;

create index if not exists discord_attendance_events_reminder_due_idx
  on public.discord_attendance_events (status, reminder_scheduled_at)
  where reminder_enabled = true and reminder_sent_at is null;
