-- Permanently link existing one-to-one account/personnel name matches.
-- This keeps audit attribution stable if an account display name later changes.
update public.personnel personnel
set auth_user_id = users.id
from public.app_auth_users users
where personnel.auth_user_id is null
  and users.disabled is not true
  and lower(btrim(personnel.name)) = lower(btrim(
    coalesce(nullif(users."displayUsername", ''), nullif(users.name, ''), users.username)
  ))
  and not exists (
    select 1
    from public.personnel duplicate_personnel
    where duplicate_personnel.id <> personnel.id
      and lower(btrim(duplicate_personnel.name)) = lower(btrim(personnel.name))
  )
  and not exists (
    select 1
    from public.app_auth_users duplicate_user
    where duplicate_user.id <> users.id
      and duplicate_user.disabled is not true
      and lower(btrim(coalesce(nullif(duplicate_user."displayUsername", ''),
          nullif(duplicate_user.name, ''), duplicate_user.username))) = lower(btrim(personnel.name))
  );
