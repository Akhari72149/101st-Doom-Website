alter table public.rank_history
  add column if not exists correction_reason text,
  add column if not exists evidence_url text,
  add column if not exists recorded_by_user_id uuid references public.app_auth_users(id) on delete set null,
  add column if not exists recorded_by_name text,
  add column if not exists recorded_at timestamptz;

comment on column public.rank_history.correction_reason is
  'Reason supplied when an administrator adds a historical rank milestone.';
comment on column public.rank_history.evidence_url is
  'Optional supporting reference for an administrator-added historical rank milestone.';
comment on column public.rank_history.recorded_by_name is
  'Display name of the administrator who recorded a historical rank milestone.';
