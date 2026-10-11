create or replace function public.ensure_attendance_cycle(
  target_cycle_end date,
  target_type text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_month text;
  target_week integer;
  affected_rows integer;
begin
  if target_cycle_end is null or extract(dow from target_cycle_end) <> 6 then
    raise exception 'Attendance cycle must end on a Saturday';
  end if;

  if target_type not in ('Training', 'MainOp') then
    raise exception 'Unknown attendance type: %', target_type;
  end if;

  target_month := trim(to_char(target_cycle_end, 'Month'));
  target_week := ceil(extract(day from target_cycle_end) / 7.0)::integer;

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

  get diagnostics affected_rows = row_count;
  return affected_rows;
end;
$$;

create or replace function public.ensure_current_attendance_week()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  target_cycle_end date;
begin
  target_cycle_end := current_date + ((6 - extract(dow from current_date)::integer + 7) % 7);
  perform public.ensure_attendance_cycle(target_cycle_end, 'Training');
  perform public.ensure_attendance_cycle(target_cycle_end, 'MainOp');
end;
$$;

revoke all on function public.ensure_attendance_cycle(date, text) from public;
revoke all on function public.ensure_current_attendance_week() from public;
grant execute on function public.ensure_attendance_cycle(date, text) to roster_app_runtime;
grant execute on function public.ensure_current_attendance_week() to roster_app_scheduler;

