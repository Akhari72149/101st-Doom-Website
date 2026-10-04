alter table public.attendance_records
  add column if not exists cycle_end_date date;

update public.attendance_records attendance
set cycle_end_date = (
  select candidate::date
  from generate_series(
    make_date(
      extract(year from attendance.created_at)::integer,
      array_position(
        array['January','February','March','April','May','June','July','August','September','October','November','December'],
        attendance.attendance_month
      ),
      ((attendance.week_number - 1) * 7) + 1
    ),
    least(
      make_date(
        extract(year from attendance.created_at)::integer,
        array_position(
          array['January','February','March','April','May','June','July','August','September','October','November','December'],
          attendance.attendance_month
        ),
        ((attendance.week_number - 1) * 7) + 1
      ) + 6,
      (
        date_trunc(
          'month',
          make_date(
            extract(year from attendance.created_at)::integer,
            array_position(
              array['January','February','March','April','May','June','July','August','September','October','November','December'],
              attendance.attendance_month
            ),
            1
          )
        ) + interval '1 month - 1 day'
      )::date
    ),
    interval '1 day'
  ) candidate
  where extract(dow from candidate) = 6
  limit 1
)
where attendance.cycle_end_date is null
  and attendance.attendance_month = any(array[
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ])
  and attendance.week_number between 1 and 5;

alter table public.attendance_records
  drop constraint if exists attendance_records_personnel_id_attendance_month_week_numbe_key;

drop index if exists public.attendance_records_personnel_id_attendance_month_week_numbe_key;

create unique index if not exists attendance_records_personnel_cycle_type_key
  on public.attendance_records(personnel_id, cycle_end_date, type)
  where cycle_end_date is not null;

create index if not exists attendance_records_cycle_type_idx
  on public.attendance_records(cycle_end_date, type);

create table if not exists public.attendance_record_audit (
  id bigserial primary key,
  attendance_record_id bigint not null references public.attendance_records(id) on delete cascade,
  actor_id uuid references public.app_auth_users(id) on delete set null,
  old_status text not null,
  new_status text not null,
  is_bulk boolean not null default false,
  changed_at timestamptz not null default now()
);

create index if not exists attendance_record_audit_record_changed_idx
  on public.attendance_record_audit(attendance_record_id, changed_at desc);

create or replace function public.ensure_attendance_records(
  target_month text,
  target_week integer,
  target_type text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_cycle_end date;
  target_month_number integer;
begin
  target_month_number := array_position(
    array['January','February','March','April','May','June','July','August','September','October','November','December'],
    target_month
  );

  select candidate::date
  into target_cycle_end
  from generate_series(
    make_date(extract(year from current_date)::integer, target_month_number, ((target_week - 1) * 7) + 1),
    least(
      make_date(extract(year from current_date)::integer, target_month_number, ((target_week - 1) * 7) + 1) + 6,
      (date_trunc('month', make_date(extract(year from current_date)::integer, target_month_number, 1)) + interval '1 month - 1 day')::date
    ),
    interval '1 day'
  ) candidate
  where extract(dow from candidate) = 6
  limit 1;

  if target_cycle_end is null then
    raise exception 'No Saturday exists in attendance period % week %', target_month, target_week;
  end if;

  insert into public.attendance_records (
    personnel_id,
    platoon_slot_id,
    attendance_month,
    week_number,
    type,
    status,
    cycle_end_date
  )
  select
    personnel.id,
    slots.id,
    target_month,
    target_week,
    target_type,
    'N',
    target_cycle_end
  from public.personnel personnel
  join public.platoon_slots slots on slots.slot_id = personnel.slotted_position
  where personnel.slotted_position is not null
    and coalesce(personnel.status, '') not in ('Removed', 'Retired')
  on conflict (personnel_id, cycle_end_date, type) where cycle_end_date is not null
  do update set
    platoon_slot_id = excluded.platoon_slot_id,
    attendance_month = excluded.attendance_month,
    week_number = excluded.week_number,
    updated_at = now();
end;
$$;

grant select on public.attendance_record_audit to roster_app_runtime;
grant insert on public.attendance_record_audit to roster_app_runtime;
grant usage, select on sequence public.attendance_record_audit_id_seq to roster_app_runtime;
grant update (status, updated_at) on public.attendance_records to roster_app_runtime;
