alter table public.audit_logs
  add column if not exists target_account_id uuid;

alter table public.audit_logs
  drop constraint if exists audit_logs_target_account_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_target_account_id_fkey
  foreign key (target_account_id)
  references public.app_auth_users(id)
  on delete set null;

create index if not exists audit_logs_target_account_idx
  on public.audit_logs(target_account_id);

update public.audit_logs audit
set target_account_id = account.id
from public.app_auth_users account
where audit.action = 'ACCOUNT_ROLE_TAGS_UPDATED'
  and audit.target_account_id is null
  and audit.details like '%' || account.id::text || '%';

delete from public.user_page_permissions
where permission_key = 'records.audit';

delete from public.app_page_permissions
where permission_key = 'records.audit';
