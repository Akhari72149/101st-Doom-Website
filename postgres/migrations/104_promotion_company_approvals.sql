create table if not exists public.promotion_company_approvals (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  from_rank_id uuid not null references public.ranks(id),
  to_rank_id uuid not null references public.ranks(id),
  approved_by_user_id uuid not null references public.app_auth_users(id),
  approved_by_personnel_id uuid references public.personnel(id) on delete set null,
  approved_by_name text not null,
  approved_at timestamptz not null default now(),
  consumed_at timestamptz,
  consumed_by_user_id uuid references public.app_auth_users(id)
);

create unique index if not exists promotion_company_approvals_active_idx
  on public.promotion_company_approvals(personnel_id, from_rank_id, to_rank_id)
  where consumed_at is null;

create index if not exists promotion_company_approvals_personnel_idx
  on public.promotion_company_approvals(personnel_id, approved_at desc);

alter table public.promotion_company_approvals enable row level security;
revoke all on public.promotion_company_approvals from public;
grant select, insert, update on public.promotion_company_approvals to roster_app_runtime;

drop policy if exists promotion_company_approvals_runtime_access
  on public.promotion_company_approvals;
create policy promotion_company_approvals_runtime_access
  on public.promotion_company_approvals
  for all to roster_app_runtime
  using (true)
  with check (true);

update public.app_page_permissions
   set description = 'Record company approval for promotions into CTS or CXT. Final promotion remains restricted to Promotion Readiness Actions.'
 where permission_key = 'admin.promotion-readiness-company-approval';
