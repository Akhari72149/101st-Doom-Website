create or replace function public.shift_recurring_server_blocks_week()
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  with expired as (
    select id,
           greatest(
             1,
             floor(extract(epoch from (current_timestamp - end_at)) / 604800)::integer + 1
           ) as weeks_to_advance
      from public.recurring_server_blocks
     where end_at <= current_timestamp
  )
  update public.recurring_server_blocks blocks
     set start_at = blocks.start_at + expired.weeks_to_advance * interval '7 days',
         end_at = blocks.end_at + expired.weeks_to_advance * interval '7 days'
    from expired
   where blocks.id = expired.id;
end;
$$;

revoke all on function public.shift_recurring_server_blocks_week() from public;
grant execute on function public.shift_recurring_server_blocks_week() to roster_app_scheduler;

delete from public.recurring_server_blocks
where server_id not in (1, 2, 3)
   or title in (
     'Claymore 2 Main Operation',
     'Dagger Main Operation',
     'Broadsword 3 Main Operation',
     'Tomahawk 1 Main Operation'
   );

with week_anchor as (
  select date_trunc('week', current_timestamp at time zone 'UTC') as monday_utc
), operation_schedule(title, start_offset, end_offset) as (
  values
    ('Claymore 2 Main Operation', interval '4 days 23 hours', interval '5 days 1 hour'),
    ('Dagger Main Operation', interval '5 days 22 hours', interval '6 days'),
    ('Broadsword 3 Main Operation', interval '6 days 1 hour', interval '6 days 3 hours'),
    ('Tomahawk 1 Main Operation', interval '6 days 19 hours', interval '6 days 21 hours')
)
insert into public.recurring_server_blocks (id, server_id, title, start_at, end_at, recurrence)
select gen_random_uuid(),
       servers.server_id,
       schedule.title,
       (anchor.monday_utc + schedule.start_offset) at time zone 'UTC',
       (anchor.monday_utc + schedule.end_offset) at time zone 'UTC',
       'weekly'
  from (values (1), (2), (3)) as servers(server_id)
 cross join operation_schedule schedule
 cross join week_anchor anchor;

select public.shift_recurring_server_blocks_week();
