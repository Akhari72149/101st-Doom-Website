alter table public.app_auth_users
  add column if not exists "lastSignInAt" timestamptz;

update public.app_auth_users users
set "lastSignInAt" = sessions.last_sign_in_at
from (
  select "userId", max("createdAt") as last_sign_in_at
  from public.app_auth_sessions
  group by "userId"
) sessions
where users.id = sessions."userId"
  and users."lastSignInAt" is null;

update public.app_auth_users
set name = 'Akhari',
    "displayUsername" = 'Akhari',
    "updatedAt" = now()
where lower(username) = 'akhari';
