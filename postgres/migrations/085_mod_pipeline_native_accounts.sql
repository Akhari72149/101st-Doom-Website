-- The Mod Pipeline now uses native website accounts as its authoritative
-- people and audit-actor source. Legacy profiles remain unrelated personnel data.

insert into public.mod_pipeline_assignees (id, name, active)
select users.id,
       coalesce(nullif(btrim(users."displayUsername"), ''),
                nullif(btrim(users.name), ''),
                nullif(btrim(users.username), ''),
                'Unknown account'),
       false
from public.app_auth_users users
where users.disabled = false
on conflict (id) do update
set name = excluded.name;

-- Start with an intentional assignment list. The protected administrator is
-- available immediately; every other account must be added from Pipeline People.
update public.mod_pipeline_assignees assignees
set active = lower(coalesce(users.username, '')) = 'akhari'
from public.app_auth_users users
where users.id = assignees.id;

do $$
declare
  target record;
  target_constraint record;
begin
  for target in
    select *
    from (values
      ('mod_pipeline_releases', 'created_by'),
      ('mod_pipeline_releases', 'approved_by'),
      ('mod_pipeline_tasks', 'created_by'),
      ('mod_pipeline_tasks', 'archived_by'),
      ('mod_pipeline_events', 'actor_id'),
      ('mod_pipeline_comments', 'user_id'),
      ('mod_pipeline_contributors', 'added_by'),
      ('mod_pipeline_checklist_items', 'completed_by'),
      ('mod_pipeline_checklist_items', 'created_by'),
      ('mod_pipeline_dependencies', 'created_by'),
      ('mod_pipeline_links', 'created_by'),
      ('mod_pipeline_approvals', 'decided_by'),
      ('mod_pipeline_repositories', 'created_by'),
      ('mod_pipeline_repository_links', 'created_by'),
      ('mod_pipeline_assets', 'uploaded_by')
    ) as columns(table_name, column_name)
  loop
    execute format(
      'update public.%I source set %I=null where %I is not null and not exists (select 1 from public.app_auth_users users where users.id=source.%I)',
      target.table_name, target.column_name, target.column_name, target.column_name
    );

    for target_constraint in
      select constraints.conname
      from pg_constraint constraints
      join pg_attribute attributes
        on attributes.attrelid=constraints.conrelid
       and attributes.attnum=any(constraints.conkey)
      where constraints.conrelid=format('public.%I',target.table_name)::regclass
        and constraints.contype='f'
        and attributes.attname=target.column_name
    loop
      execute format('alter table public.%I drop constraint %I', target.table_name, target_constraint.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.app_auth_users(id) on delete set null',
      target.table_name,
      target.table_name || '_' || target.column_name || '_fkey',
      target.column_name
    );
  end loop;
end $$;
