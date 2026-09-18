create or replace function public.set_personnel_rank_effective_at()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' and new.rank_effective_at is null then
    new.rank_effective_at := coalesce(new.created_at at time zone 'UTC', now());
  elsif tg_op = 'UPDATE'
    and new.rank_id is distinct from old.rank_id
    and new.rank_effective_at is not distinct from old.rank_effective_at
    and coalesce(current_setting('app.preserve_rank_effective_at', true), 'false') <> 'true' then
    new.rank_effective_at := now();
  end if;
  return new;
end;
$$;

insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.rank-corrections', '/admin/rank-corrections', 'Rank Corrections', 'Personnel Admin', 'Correct a personnel rank while preserving their existing TIG date.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.rank-corrections', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();
