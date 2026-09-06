alter table public.app_auth_users
  add column if not exists "mustChangePassword" boolean not null default false;

create index if not exists app_auth_users_password_change_idx
  on public.app_auth_users ("mustChangePassword")
  where "mustChangePassword" = true;
