alter table public.discord_attendance_events
  add column if not exists repeat_scheduled_send_at timestamptz;

comment on column public.discord_attendance_events.repeat_scheduled_send_at is
  'For weekly attendance events, stores the next weekly message send time while the current row can still be due immediately.';
