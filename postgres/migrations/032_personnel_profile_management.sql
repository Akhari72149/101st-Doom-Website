insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.personnel-profiles', '/admin/personnel-profiles', 'Personnel Profiles',
   'Personnel Admin', 'Manage join dates, Discord links, and reactivate personnel profiles.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description,
    updated_at = now();

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.personnel-profiles', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full',
    granted_by = excluded.granted_by,
    updated_at = now();

-- The runtime cannot insert arbitrary outbox rows. This constrained helper only
-- rebuilds roles already represented by an active personnel record.
create or replace function public.enqueue_personnel_reactivation(target_personnel_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_discord_id text;
  target_rank_id uuid;
  queued_count integer := 0;
  certification record;
begin
  select personnel.discord_id, personnel.rank_id
    into target_discord_id, target_rank_id
  from public.personnel personnel
  where personnel.id = target_personnel_id
    and lower(coalesce(personnel.status, '')) not in ('removed', 'retired', 'transferred');

  if not found or nullif(btrim(target_discord_id), '') is null then
    return 0;
  end if;

  insert into public.discord_role_outbox (event_type, payload)
  values (
    'USER_ROLE_INIT',
    jsonb_build_object(
      'discordId', target_discord_id,
      'rankId', target_rank_id,
      'reactivation', true
    )
  );
  queued_count := queued_count + 1;

  for certification in
    select definitions.cert_id
    from public.personnel_certifications awarded
    join public.certifications definitions on definitions.id = awarded.certification_id
    where awarded.personnel_id = target_personnel_id
      and nullif(btrim(definitions.cert_id), '') is not null
  loop
    insert into public.discord_role_outbox (event_type, payload)
    values (
      'CERT_ROLE_SYNC',
      jsonb_build_object(
        'discordId', target_discord_id,
        'roleId', certification.cert_id,
        'action', 'assign'
      )
    );
    queued_count := queued_count + 1;
  end loop;

  return queued_count;
end;
$$;

revoke all on function public.enqueue_personnel_reactivation(uuid) from public;
grant execute on function public.enqueue_personnel_reactivation(uuid) to roster_app_runtime;
