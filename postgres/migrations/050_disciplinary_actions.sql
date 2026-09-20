insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.discipline', '/admin/discipline', 'Warnings & DAs', 'Records',
  'Issue and review warnings, disciplinary actions, approvals, and appeals.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.discipline', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();

create table if not exists public.disciplinary_reference_counters (
  reference_year integer not null,
  case_kind text not null check (case_kind in ('warning', 'da')),
  last_value integer not null default 0,
  primary key (reference_year, case_kind)
);

create table if not exists public.disciplinary_action_catalog (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null check (category in ('formal', 'community')),
  description text,
  active boolean not null default true,
  created_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.disciplinary_cases (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  personnel_id uuid not null references public.personnel(id) on delete restrict,
  case_kind text not null check (case_kind in ('warning', 'da')),
  status text not null check (status in ('pending_approval', 'active', 'appealed', 'overturned', 'voided')),
  incident_on date not null,
  summary text not null check (length(summary) between 3 and 180),
  reason text not null check (length(reason) between 3 and 5000),
  expires_at timestamptz,
  issued_by uuid not null references public.app_auth_users(id) on delete restrict,
  approved_by uuid references public.app_auth_users(id) on delete set null,
  approved_at timestamptz,
  voided_by uuid references public.app_auth_users(id) on delete set null,
  void_reason text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((case_kind = 'warning' and expires_at is not null and status <> 'pending_approval') or case_kind = 'da'),
  check (case_kind <> 'da' or status <> 'active' or (approved_by is not null and approved_at is not null))
);

create index if not exists disciplinary_cases_personnel_idx
  on public.disciplinary_cases (personnel_id, created_at desc);
create index if not exists disciplinary_cases_status_idx
  on public.disciplinary_cases (status, case_kind, created_at desc);

create table if not exists public.disciplinary_case_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases(id) on delete restrict,
  catalog_action_id uuid references public.disciplinary_action_catalog(id) on delete set null,
  action_name text not null,
  action_category text not null check (action_category in ('formal', 'community')),
  status text not null default 'pending' check (status in ('pending', 'completed')),
  target_data jsonb not null default '{}'::jsonb check (jsonb_typeof(target_data) = 'object'),
  completed_by uuid references public.app_auth_users(id) on delete set null,
  completed_at timestamptz,
  completion_notes text,
  created_at timestamptz not null default now()
);

create index if not exists disciplinary_case_actions_case_idx
  on public.disciplinary_case_actions (case_id, created_at);

create table if not exists public.disciplinary_approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases(id) on delete restrict,
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  decided_by uuid not null references public.app_auth_users(id) on delete restrict,
  decided_at timestamptz not null default now()
);

create index if not exists disciplinary_approvals_case_idx
  on public.disciplinary_approvals (case_id, decided_at desc);

create table if not exists public.disciplinary_appeals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases(id) on delete restrict,
  document_url text not null,
  notes text,
  status text not null default 'pending' check (status in ('pending', 'upheld', 'amended', 'overturned', 'more_info')),
  submitted_by uuid not null references public.app_auth_users(id) on delete restrict,
  reviewed_by uuid references public.app_auth_users(id) on delete set null,
  review_notes text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists disciplinary_appeals_case_idx
  on public.disciplinary_appeals (case_id, submitted_at desc);

create table if not exists public.disciplinary_evidence_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases(id) on delete restrict,
  label text not null,
  url text not null,
  added_by uuid not null references public.app_auth_users(id) on delete restrict,
  added_at timestamptz not null default now()
);

create table if not exists public.disciplinary_case_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.disciplinary_cases(id) on delete restrict,
  event_type text not null,
  details text not null,
  actor_id uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists disciplinary_case_events_case_idx
  on public.disciplinary_case_events (case_id, created_at desc);

create or replace function public.next_disciplinary_reference(target_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_year integer := extract(year from current_date)::integer;
  next_value integer;
begin
  if target_kind not in ('warning', 'da') then
    raise exception 'Invalid disciplinary case kind';
  end if;
  insert into public.disciplinary_reference_counters(reference_year, case_kind, last_value)
  values (target_year, target_kind, 1)
  on conflict (reference_year, case_kind) do update
  set last_value = public.disciplinary_reference_counters.last_value + 1
  returning last_value into next_value;
  return (case when target_kind = 'warning' then 'WARN' else 'DA' end)
    || '-' || target_year::text || '-' || lpad(next_value::text, 3, '0');
end;
$$;

revoke all on function public.next_disciplinary_reference(text) from public;
grant execute on function public.next_disciplinary_reference(text) to roster_app_runtime;

insert into public.disciplinary_action_catalog (slug, name, category, description)
values
  ('apology-letter', 'Write an apology letter', 'formal', 'Submit a written apology.'),
  ('strip-tags', 'Strip selected tags', 'formal', 'Remove only the certifications or MOS tags selected on the DA.'),
  ('retraining', 'Retraining', 'formal', 'Complete assigned retraining.'),
  ('forced-loa', 'Forced Leave of Absence', 'formal', 'Complete a directed leave of absence.'),
  ('bct-retraining', 'BCT retraining', 'formal', 'Repeat the required BCT training.'),
  ('detachment-ban', 'Detachment ban', 'formal', 'Record a detachment ban of at least one month on the personnel account.'),
  ('cert-ban', 'Certification ban', 'formal', 'Ban use of a certification; requires the relevant certification lead where applicable.'),
  ('unslotting', 'Unslotting', 'formal', 'Requires chain-of-command and Company NCOIC approval.'),
  ('operation-restriction', 'Operation attendance restriction', 'formal', 'Restrict attendance at 101st operations, GARC operations, or both.'),
  ('nco-shadow', 'NCO shadow required', 'formal', 'Require an NCO shadow when attending operations.'),
  ('statistic', 'Become a statistic', 'community', null),
  ('apology-video', 'Make a 22 minute apology video', 'community', null),
  ('run-laps', 'Run laps around an assigned location', 'community', null),
  ('sing-let-it-go', 'Sing Let It Go in front of platoon', 'community', null),
  ('wear-cr-armour', 'Wear CR armour for a week', 'community', null),
  ('wear-pink-armour', 'Wear pink armour for a week', 'community', null),
  ('wear-dunce-helmet', 'Wear the dunce helmet for a week', 'community', null),
  ('no-armour', 'No armour for a week, backpack only', 'community', null),
  ('lead-with-blind', 'Lead an operation with Blind', 'community', null),
  ('watch-titanic', 'Watch the entirety of Titanic', 'community', null),
  ('watch-sequel-trilogy', 'Watch the sequel trilogy', 'community', null),
  ('zeus-good-op', 'Zeus a fun operation rated 9/10 by the majority', 'community', null),
  ('attend-212th-op', 'Attend a 212th fun operation', 'community', null),
  ('make-verdun', 'Make Verdun in a 212th fun operation', 'community', null),
  ('no-grenades', 'No grenades for one month', 'community', null),
  ('stamina-weapon-sway', 'Use stamina and weapon sway for a week and attend two main operations', 'community', null),
  ('hammer-bob-essay', 'Write two paragraphs on Hammer committing BoB', 'community', null),
  ('commando-sop', 'Create and pitch a Republic Commando SOP to Blind', 'community', null),
  ('lead-platoon-week', 'Lead a platoon for a week', 'community', null),
  ('laat-dogfight', 'Convince Seatie that LAATs should dogfight', 'community', null),
  ('describe-impulse', 'Describe to Hammer that Impulse is weak', 'community', null),
  ('sidearm-only', 'Use only a sidearm for a week', 'community', null),
  ('assist-mod-team', 'Assist the mod team for one week', 'community', null),
  ('talk-like-allen', 'Talk like Allen on long range for an operation', 'community', null),
  ('talk-like-jar-jar', 'Talk like Jar Jar for a week', 'community', null),
  ('convince-arf', 'Convince ARF that they must do recon', 'community', null),
  ('convince-dagger', 'Convince Dagger they are an MOS', 'community', null),
  ('platoon-speech', 'Make and give a speech in front of a platoon', 'community', null),
  ('pilot-nu-class', 'Fly a Nu-Class for a week', 'community', 'Pilot only.'),
  ('pilot-vtol-laat', 'Fly VTOL LAAT/i for a week', 'community', 'Pilot only.'),
  ('pilot-laat-le', 'Fly LAAT/LE for a week', 'community', 'Pilot only.'),
  ('pilot-laat-c', 'Fly LAAT/C for a week', 'community', 'Pilot only.'),
  ('read-rules', 'Read the entire Rules and Regulations slowly', 'community', null),
  ('dagger-no-jumppack', 'Ride with Dagger without a jumppack', 'community', null),
  ('ten-positives', 'List ten positive things about the 101st', 'community', null),
  ('shocked-training', 'Attend Shocked''s training', 'community', null),
  ('escape-stratis', 'Escape Stratis while hunted by Longbow teams', 'community', null),
  ('unit-therapist', 'Be the unit therapist for a week', 'community', null),
  ('unit-chaplain', 'Be the unit chaplain for a week', 'community', null),
  ('advanced-marksman', 'Obtain Advanced Marksman', 'community', null),
  ('support-point-click', 'Convince AJ that Support is point and click', 'community', null),
  ('le-sniper', 'Convince Jerec the LE is a sniper rifle', 'community', null),
  ('plx', 'Tell AT the PLX is not becoming a thing', 'community', null),
  ('public-execution', 'In-game public execution for saying over and out', 'community', 'In-game roleplay only.'),
  ('isu-target', 'Assist ISU weapon development as the target', 'community', 'In-game activity only.'),
  ('leadership-conversation', 'Maintain a 20-message conversation with 212th leadership', 'community', null),
  ('no-laat', 'May not enter a LAAT for up to one month', 'community', null),
  ('permission-laat', 'Requires permission to enter a LAAT for up to two months', 'community', null),
  ('watch-anime', 'Watch an anime series with Bond', 'community', null),
  ('longbow-open', 'Participate in longbow-open', 'community', null),
  ('ask-hark-vtubers', 'Ask Hark about V-Tubers', 'community', null),
  ('ask-longbow-lore', 'Ask Longbow about lore', 'community', null),
  ('no-vest-backpack', 'No vest or backpack for one or two main operations', 'community', null),
  ('cas-call', 'Make a 48-line CAS call during an FTX while acting as RTO', 'community', null)
on conflict (slug) do update
set name = excluded.name, category = excluded.category, description = excluded.description, updated_at = now();

alter table public.disciplinary_reference_counters enable row level security;
alter table public.disciplinary_action_catalog enable row level security;
alter table public.disciplinary_cases enable row level security;
alter table public.disciplinary_case_actions enable row level security;
alter table public.disciplinary_approvals enable row level security;
alter table public.disciplinary_appeals enable row level security;
alter table public.disciplinary_evidence_links enable row level security;
alter table public.disciplinary_case_events enable row level security;

revoke all on public.disciplinary_reference_counters, public.disciplinary_action_catalog,
  public.disciplinary_cases, public.disciplinary_case_actions, public.disciplinary_approvals,
  public.disciplinary_appeals, public.disciplinary_evidence_links, public.disciplinary_case_events from public;

grant select, insert, update on public.disciplinary_action_catalog to roster_app_runtime;
grant select, insert, update on public.disciplinary_cases to roster_app_runtime;
grant select, insert, update on public.disciplinary_case_actions to roster_app_runtime;
grant select, insert on public.disciplinary_approvals to roster_app_runtime;
grant select, insert, update on public.disciplinary_appeals to roster_app_runtime;
grant select, insert on public.disciplinary_evidence_links, public.disciplinary_case_events to roster_app_runtime;

create policy "native runtime discipline catalog" on public.disciplinary_action_catalog for all to roster_app_runtime using (true) with check (true);
create policy "native runtime discipline cases" on public.disciplinary_cases for all to roster_app_runtime using (true) with check (true);
create policy "native runtime discipline actions" on public.disciplinary_case_actions for all to roster_app_runtime using (true) with check (true);
create policy "native runtime discipline approvals read" on public.disciplinary_approvals for select to roster_app_runtime using (true);
create policy "native runtime discipline approvals insert" on public.disciplinary_approvals for insert to roster_app_runtime with check (true);
create policy "native runtime discipline appeals" on public.disciplinary_appeals for all to roster_app_runtime using (true) with check (true);
create policy "native runtime discipline evidence read" on public.disciplinary_evidence_links for select to roster_app_runtime using (true);
create policy "native runtime discipline evidence insert" on public.disciplinary_evidence_links for insert to roster_app_runtime with check (true);
create policy "native runtime discipline events read" on public.disciplinary_case_events for select to roster_app_runtime using (true);
create policy "native runtime discipline events insert" on public.disciplinary_case_events for insert to roster_app_runtime with check (true);
