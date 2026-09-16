alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey;

alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_fkey1;

alter table public.audit_logs
  drop constraint if exists audit_logs_user_id_native_fkey;

-- Legacy audit rows can refer to Supabase accounts that were intentionally not
-- imported. NOT VALID preserves those rows while enforcing native identities
-- for every new audit entry.
alter table public.audit_logs
  add constraint audit_logs_user_id_native_fkey
  foreign key (user_id)
  references public.app_auth_users(id)
  on delete set null
  not valid;
