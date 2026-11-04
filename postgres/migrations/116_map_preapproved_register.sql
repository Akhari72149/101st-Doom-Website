alter table public.map_requests
  add column if not exists entry_type text not null default 'request',
  add column if not exists pre_approved_at timestamptz,
  add column if not exists pre_approved_by uuid references public.app_auth_users(id) on delete set null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'map_requests_entry_type_check'
  ) then
    alter table public.map_requests
      add constraint map_requests_entry_type_check
      check (entry_type in ('request', 'pre_approved'));
  end if;
end $$;

create index if not exists map_requests_entry_type_idx
  on public.map_requests (entry_type, requested_at desc);
