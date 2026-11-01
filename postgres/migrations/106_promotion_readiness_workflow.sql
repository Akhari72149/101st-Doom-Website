alter table public.promotion_company_approvals
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by_user_id uuid references public.app_auth_users(id) on delete set null,
  add column if not exists revoked_by_name text,
  add column if not exists revoke_reason text;

drop index if exists public.promotion_company_approvals_active_idx;
drop index if exists public.promotion_company_approvals_active_unique;
create unique index promotion_company_approvals_active_unique
  on public.promotion_company_approvals(personnel_id, from_rank_id, to_rank_id)
  where consumed_at is null and revoked_at is null;

create table if not exists public.promotion_requirement_confirmations (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  from_rank_id uuid not null references public.ranks(id) on delete cascade,
  to_rank_id uuid not null references public.ranks(id) on delete cascade,
  criterion_key text not null,
  requirement_label text not null,
  notes text,
  evidence_url text,
  confirmed_by_user_id uuid references public.app_auth_users(id) on delete set null,
  confirmed_by_personnel_id uuid references public.personnel(id) on delete set null,
  confirmed_by_name text not null,
  confirmed_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by_user_id uuid references public.app_auth_users(id) on delete set null,
  revoked_by_name text,
  revoke_reason text
);

create unique index if not exists promotion_requirement_confirmations_active_unique
  on public.promotion_requirement_confirmations(personnel_id, from_rank_id, to_rank_id, criterion_key)
  where revoked_at is null;

create index if not exists promotion_requirement_confirmations_personnel_idx
  on public.promotion_requirement_confirmations(personnel_id, confirmed_at desc);

alter table public.promotion_requirement_confirmations enable row level security;
revoke all on public.promotion_requirement_confirmations from public;
grant select, insert, update on public.promotion_requirement_confirmations to roster_app_runtime;

drop policy if exists roster_runtime_promotion_requirement_confirmations on public.promotion_requirement_confirmations;
create policy roster_runtime_promotion_requirement_confirmations
  on public.promotion_requirement_confirmations
  for all to roster_app_runtime
  using (true)
  with check (true);
