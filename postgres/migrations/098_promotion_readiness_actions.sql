insert into public.app_page_permissions
  (permission_key, page_path, label, category, description)
values
  ('admin.promotion-readiness', '/admin/promotion-readiness', 'Promotion Readiness Actions', 'Personnel Admin', 'Promote personnel who have met all published automatic promotion requirements.')
on conflict (permission_key) do update
set page_path = excluded.page_path,
    label = excluded.label,
    category = excluded.category,
    description = excluded.description;

insert into public.user_page_permissions
  (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.promotion-readiness', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level = 'full', granted_by = excluded.granted_by, updated_at = now();

create table if not exists public.promotion_readiness_notifications (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  from_rank_id uuid not null references public.ranks(id),
  to_rank_id uuid not null references public.ranks(id),
  notified_at timestamptz not null default now(),
  unique (personnel_id, from_rank_id, to_rank_id)
);

create index if not exists promotion_readiness_notifications_personnel_idx
  on public.promotion_readiness_notifications(personnel_id, notified_at desc);

alter table public.promotion_readiness_notifications enable row level security;
revoke all on public.promotion_readiness_notifications from public;
revoke insert on public.promotion_readiness_notifications from roster_app_runtime;
grant select on public.promotion_readiness_notifications to roster_app_runtime;

drop policy if exists promotion_readiness_runtime_select on public.promotion_readiness_notifications;
create policy promotion_readiness_runtime_select
  on public.promotion_readiness_notifications for select to roster_app_runtime using (true);

drop policy if exists promotion_readiness_runtime_insert on public.promotion_readiness_notifications;

alter table public.discord_role_outbox
  drop constraint if exists discord_role_outbox_event_type_check;

alter table public.discord_role_outbox
  add constraint discord_role_outbox_event_type_check check (
    event_type in (
      'CERT_ROLE_SYNC',
      'USER_ROLE_INIT',
      'PERSONNEL_STATUS_SYNC',
      'USER_FULL_IMPORT',
      'SLOT_ROLE_SYNC',
      'RANK_ROLE_SYNC',
      'ACCOUNT_CREDENTIALS_DM',
      'PROMOTION_READY'
    )
  );

create or replace function public.enqueue_promotion_ready_notification(
  target_personnel_id uuid,
  source_rank_id uuid,
  destination_rank_id uuid,
  event_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  notification_id uuid;
  queued_id uuid;
begin
  if jsonb_typeof(event_payload) <> 'object'
     or length(coalesce(event_payload->>'personnelName','')) = 0
     or length(coalesce(event_payload->>'oldRankName','')) = 0
     or length(coalesce(event_payload->>'rankName','')) = 0 then
    raise exception 'Invalid promotion readiness payload';
  end if;

  insert into public.promotion_readiness_notifications(personnel_id,from_rank_id,to_rank_id)
  values(target_personnel_id,source_rank_id,destination_rank_id)
  on conflict do nothing
  returning id into notification_id;

  if notification_id is null then
    return null;
  end if;

  insert into public.discord_role_outbox(event_type,payload)
  values('PROMOTION_READY',event_payload)
  returning id into queued_id;
  return queued_id;
end;
$$;

revoke all on function public.enqueue_promotion_ready_notification(uuid,uuid,uuid,jsonb) from public;
grant execute on function public.enqueue_promotion_ready_notification(uuid,uuid,uuid,jsonb) to roster_app_runtime;

create or replace function public.cancel_stale_promotion_ready_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.rank_id is distinct from old.rank_id then
    update public.discord_role_outbox
       set status='succeeded',processed_at=now(),updated_at=now(),
           last_error='Superseded by a completed rank change'
     where event_type='PROMOTION_READY'
       and status in ('pending','processing')
       and payload->>'targetPersonnelId'=new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists cancel_stale_promotion_ready_events on public.personnel;
create trigger cancel_stale_promotion_ready_events
after update of rank_id on public.personnel
for each row execute function public.cancel_stale_promotion_ready_events();
