create table if not exists public.discord_attendance_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  channel_id text not null,
  channel_name text,
  event_starts_at timestamptz not null,
  duration_minutes integer not null default 120 check (duration_minutes > 0),
  scheduled_send_at timestamptz not null,
  repeat_enabled boolean not null default false,
  repeat_type text not null default 'none' check (repeat_type in ('none', 'weekly')),
  repeat_timezone text not null default 'Europe/London',
  footer_text text,
  created_by uuid references auth.users(id) on delete set null,
  created_by_name text,
  discord_message_id text,
  last_sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'closed', 'cancelled', 'failed')),
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discord_attendance_options (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.discord_attendance_events(id) on delete cascade,
  label text not null,
  emoji text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.discord_attendance_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.discord_attendance_events(id) on delete cascade,
  option_id uuid not null references public.discord_attendance_options(id) on delete cascade,
  discord_user_id text not null,
  discord_display_name text not null,
  personnel_id uuid references public.personnel(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, discord_user_id)
);

create index if not exists discord_attendance_events_due_idx
  on public.discord_attendance_events (status, scheduled_send_at);

create index if not exists discord_attendance_events_message_idx
  on public.discord_attendance_events (discord_message_id)
  where discord_message_id is not null;

create index if not exists discord_attendance_options_event_idx
  on public.discord_attendance_options (event_id, sort_order);

create index if not exists discord_attendance_responses_event_idx
  on public.discord_attendance_responses (event_id, option_id);

alter table public.discord_attendance_events enable row level security;
alter table public.discord_attendance_options enable row level security;
alter table public.discord_attendance_responses enable row level security;

grant select, insert, update, delete on public.discord_attendance_events to authenticated;
grant select, insert, update, delete on public.discord_attendance_options to authenticated;
grant select on public.discord_attendance_responses to authenticated;
grant all on public.discord_attendance_events to service_role;
grant all on public.discord_attendance_options to service_role;
grant all on public.discord_attendance_responses to service_role;

drop policy if exists "attendance events readable by authenticated" on public.discord_attendance_events;
create policy "attendance events readable by authenticated"
  on public.discord_attendance_events
  for select
  to authenticated
  using (true);

drop policy if exists "attendance options readable by authenticated" on public.discord_attendance_options;
create policy "attendance options readable by authenticated"
  on public.discord_attendance_options
  for select
  to authenticated
  using (true);

drop policy if exists "attendance responses readable by authenticated" on public.discord_attendance_responses;
create policy "attendance responses readable by authenticated"
  on public.discord_attendance_responses
  for select
  to authenticated
  using (true);

drop policy if exists "attendance staff manage events" on public.discord_attendance_events;
create policy "attendance staff manage events"
  on public.discord_attendance_events
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and lower(ur.role) in ('admin', 'nco', 'akhari')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and lower(ur.role) in ('admin', 'nco', 'akhari')
    )
  );

drop policy if exists "attendance staff manage options" on public.discord_attendance_options;
create policy "attendance staff manage options"
  on public.discord_attendance_options
  for all
  to authenticated
  using (
    exists (
      select 1 from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and lower(ur.role) in ('admin', 'nco', 'akhari')
    )
  )
  with check (
    exists (
      select 1 from public.user_roles as ur
      where ur.user_id = (select auth.uid())
        and lower(ur.role) in ('admin', 'nco', 'akhari')
    )
  );
