alter table public.disciplinary_case_actions
  add column if not exists due_at timestamptz;

create index if not exists disciplinary_case_actions_overdue_idx
  on public.disciplinary_case_actions (due_at)
  where status = 'pending' and due_at is not null;

create table if not exists public.disciplinary_case_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(name) between 3 and 120),
  case_kind text not null check (case_kind in ('warning', 'da')),
  summary text not null default '',
  reason text not null default '',
  warning_expiry_days integer check (warning_expiry_days between 1 and 3650),
  actions jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  active boolean not null default true,
  created_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.disciplinary_case_templates enable row level security;
revoke all on public.disciplinary_case_templates from public;
grant select, insert, update on public.disciplinary_case_templates to roster_app_runtime;

create policy "native runtime discipline templates"
  on public.disciplinary_case_templates for all to roster_app_runtime
  using (true) with check (true);
