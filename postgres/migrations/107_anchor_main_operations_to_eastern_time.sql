-- Main Operations follow US Eastern local time. PostgreSQL converts each
-- occurrence to an absolute instant, including future EDT/EST transitions.
create or replace function public.shift_recurring_server_blocks_week()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with operation_schedule(title, local_start_offset, duration) as (
    values
      ('Claymore 2 Main Operation', interval '4 days 19 hours', interval '2 hours'),
      ('Dagger Main Operation', interval '5 days 18 hours', interval '2 hours'),
      ('Broadsword 3 Main Operation', interval '5 days 21 hours', interval '2 hours'),
      ('Tomahawk 1 Main Operation', interval '6 days 15 hours', interval '2 hours')
  ), eastern_week as (
    select date_trunc('week', current_timestamp at time zone 'America/New_York') as monday_local
  ), next_occurrence as (
    select schedule.title,
           case
             when (week.monday_local + schedule.local_start_offset) at time zone 'America/New_York' > current_timestamp
               then week.monday_local + schedule.local_start_offset
             else week.monday_local + schedule.local_start_offset + interval '7 days'
           end as local_start,
           schedule.duration
      from operation_schedule schedule
      cross join eastern_week week
  )
  update public.recurring_server_blocks blocks
     set start_at = occurrence.local_start at time zone 'America/New_York',
         end_at = (occurrence.local_start + occurrence.duration) at time zone 'America/New_York'
    from next_occurrence occurrence
   where blocks.title = occurrence.title
     and blocks.end_at <= current_timestamp;
end;
$$;

revoke all on function public.shift_recurring_server_blocks_week() from public;
grant execute on function public.shift_recurring_server_blocks_week() to roster_app_scheduler;

-- Correct the currently published blocks immediately, including future rows
-- that have not yet reached the scheduler's normal expiry condition.
with operation_schedule(title, local_start_offset, duration) as (
  values
    ('Claymore 2 Main Operation', interval '4 days 19 hours', interval '2 hours'),
    ('Dagger Main Operation', interval '5 days 18 hours', interval '2 hours'),
    ('Broadsword 3 Main Operation', interval '5 days 21 hours', interval '2 hours'),
    ('Tomahawk 1 Main Operation', interval '6 days 15 hours', interval '2 hours')
), eastern_week as (
  select date_trunc('week', current_timestamp at time zone 'America/New_York') as monday_local
), next_occurrence as (
  select schedule.title,
         case
           when (week.monday_local + schedule.local_start_offset) at time zone 'America/New_York' > current_timestamp
             then week.monday_local + schedule.local_start_offset
           else week.monday_local + schedule.local_start_offset + interval '7 days'
         end as local_start,
         schedule.duration
    from operation_schedule schedule
    cross join eastern_week week
)
update public.recurring_server_blocks blocks
   set start_at = occurrence.local_start at time zone 'America/New_York',
       end_at = (occurrence.local_start + occurrence.duration) at time zone 'America/New_York'
  from next_occurrence occurrence
 where blocks.title = occurrence.title;
