create sequence if not exists public.mod_pipeline_reference_seq;

create table if not exists public.mod_pipeline_releases (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  version text,
  status text not null default 'planned' check (status in ('planned','testing','released','cancelled')),
  description text,
  target_date date,
  released_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.mod_pipeline_tasks
  add column if not exists reference_number bigint,
  add column if not exists task_type text,
  add column if not exists acceptance_criteria text,
  add column if not exists workstream text,
  add column if not exists blocked boolean not null default false,
  add column if not exists blocker_reason text,
  add column if not exists release_id uuid references public.mod_pipeline_releases(id) on delete set null,
  add column if not exists stage_entered_at timestamptz,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists released_at timestamptz,
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null,
  add column if not exists archive_reason text,
  add column if not exists version integer not null default 1;

alter sequence public.mod_pipeline_reference_seq owned by public.mod_pipeline_tasks.reference_number;
alter table public.mod_pipeline_tasks alter column reference_number set default nextval('public.mod_pipeline_reference_seq');
update public.mod_pipeline_tasks set reference_number=nextval('public.mod_pipeline_reference_seq') where reference_number is null;
alter table public.mod_pipeline_tasks alter column reference_number set not null;
create unique index if not exists mod_pipeline_tasks_reference_number_key on public.mod_pipeline_tasks(reference_number);

-- Remove only legacy checks attached to the two fields whose accepted values are being upgraded.
do $$
declare row record;
begin
  for row in
    select c.conname
    from pg_constraint c
    where c.conrelid='public.mod_pipeline_tasks'::regclass
      and c.contype='c'
      and (pg_get_constraintdef(c.oid) ilike '%status%' or pg_get_constraintdef(c.oid) ilike '%stage%')
  loop
    execute format('alter table public.mod_pipeline_tasks drop constraint %I', row.conname);
  end loop;
end $$;

update public.mod_pipeline_tasks set
  workstream=case coalesce(stage,'')
    when 'concept' then 'design'
    when 'design' then 'design'
    when 'modelling' then 'modelling'
    when 'texturing' then 'texturing'
    when 'scripting' then 'scripting'
    when 'testing' then 'quality'
    else 'other'
  end
where workstream is null;

update public.mod_pipeline_tasks set
  task_type=case
    when 'Bug'=any(coalesce(tags,'{}'::text[])) then 'bug'
    when 'New Feature'=any(coalesce(tags,'{}'::text[])) then 'feature'
    when 'Helmet'=any(coalesce(tags,'{}'::text[])) then 'asset'
    else 'maintenance'
  end
where task_type is null;

update public.mod_pipeline_tasks set status=case status
  when 'todo' then 'intake'
  when 'in_progress' then 'in_development'
  when 'review' then 'internal_review'
  when 'done' then 'ready_for_release'
  else status end;

update public.mod_pipeline_tasks set
  stage_entered_at=coalesce(stage_entered_at,updated_at,created_at,now()),
  started_at=case when status not in ('intake','approved') then coalesce(started_at,updated_at,created_at) else started_at end,
  completed_at=case when status in ('ready_for_release','released') then coalesce(completed_at,updated_at) else completed_at end;

alter table public.mod_pipeline_tasks
  alter column task_type set default 'maintenance',
  alter column task_type set not null,
  alter column workstream set default 'other',
  alter column workstream set not null,
  add constraint mod_pipeline_tasks_status_v2_check check (status in ('intake','approved','in_development','internal_review','testing','ready_for_release','released','cancelled')),
  add constraint mod_pipeline_tasks_priority_v2_check check (priority in ('low','medium','high','critical')),
  add constraint mod_pipeline_tasks_type_check check (task_type in ('bug','feature','asset','balance','maintenance','documentation')),
  add constraint mod_pipeline_tasks_workstream_check check (workstream in ('design','modelling','texturing','scripting','audio','documentation','quality','other')),
  add constraint mod_pipeline_tasks_blocker_reason_check check (not blocked or nullif(btrim(blocker_reason),'') is not null);

create table if not exists public.mod_pipeline_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid references public.mod_pipeline_tasks(id) on delete cascade,
  release_id uuid references public.mod_pipeline_releases(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  event_type text not null,
  summary text not null,
  old_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason text,
  created_at timestamptz not null default now(),
  check (task_id is not null or release_id is not null)
);

create table if not exists public.mod_pipeline_contributors (
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  assignee_id uuid not null references public.mod_pipeline_assignees(id) on delete cascade,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key(task_id,assignee_id)
);

create table if not exists public.mod_pipeline_checklist_items (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  content text not null,
  completed boolean not null default false,
  position integer not null default 0,
  completed_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mod_pipeline_dependencies (
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  depends_on_task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(task_id,depends_on_task_id),
  check(task_id<>depends_on_task_id)
);

create table if not exists public.mod_pipeline_links (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  label text not null,
  url text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mod_pipeline_approvals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.mod_pipeline_tasks(id) on delete cascade,
  gate text not null check(gate in ('review','testing','release')),
  decision text not null check(decision in ('approved','rejected')),
  notes text,
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz not null default now()
);

insert into public.mod_pipeline_events(task_id,event_type,summary,new_values,created_at)
select t.id,'legacy_import','Imported from the previous Mod Taskboard',
  jsonb_build_object('status',t.status,'priority',t.priority,'workstream',t.workstream),t.created_at
from public.mod_pipeline_tasks t
where not exists(select 1 from public.mod_pipeline_events e where e.task_id=t.id and e.event_type='legacy_import');

create index if not exists mod_pipeline_tasks_active_status_idx on public.mod_pipeline_tasks(archived_at,status,position);
create index if not exists mod_pipeline_events_task_time_idx on public.mod_pipeline_events(task_id,created_at desc);
create index if not exists mod_pipeline_events_release_time_idx on public.mod_pipeline_events(release_id,created_at desc);
create index if not exists mod_pipeline_checklist_task_idx on public.mod_pipeline_checklist_items(task_id,position);

grant select,insert,update,delete on public.mod_pipeline_releases,public.mod_pipeline_events,
  public.mod_pipeline_contributors,public.mod_pipeline_checklist_items,public.mod_pipeline_dependencies,
  public.mod_pipeline_links,public.mod_pipeline_approvals to roster_app_runtime;
grant usage,select on sequence public.mod_pipeline_reference_seq to roster_app_runtime;

do $$
declare table_name text;
begin
  foreach table_name in array array['mod_pipeline_releases','mod_pipeline_events','mod_pipeline_contributors',
    'mod_pipeline_checklist_items','mod_pipeline_dependencies','mod_pipeline_links','mod_pipeline_approvals']
  loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('drop policy if exists %I on public.%I','native runtime '||replace(table_name,'_',' '),table_name);
    execute format('create policy %I on public.%I for all to roster_app_runtime using (true) with check (true)',
      'native runtime '||replace(table_name,'_',' '),table_name);
  end loop;
end $$;

