-- Main Operation blocks represent fixed instants. The browser converts these
-- UTC timestamps to each viewer's timezone, including daylight-saving changes.
with canonical_schedule(title, start_time, duration) as (
  values
    ('Claymore 2 Main Operation', time '23:00', interval '2 hours'),
    ('Dagger Main Operation', time '22:00', interval '2 hours'),
    ('Broadsword 3 Main Operation', time '01:00', interval '2 hours'),
    ('Tomahawk 1 Main Operation', time '19:00', interval '2 hours')
), normalized as (
  select blocks.id,
         (
           date_trunc('day', blocks.start_at at time zone 'UTC') + schedule.start_time
         ) at time zone 'UTC' as start_at,
         schedule.duration
    from public.recurring_server_blocks blocks
    join canonical_schedule schedule on schedule.title = blocks.title
)
update public.recurring_server_blocks blocks
   set start_at = normalized.start_at,
       end_at = normalized.start_at + normalized.duration
  from normalized
 where blocks.id = normalized.id
   and (
     blocks.start_at is distinct from normalized.start_at
     or blocks.end_at is distinct from normalized.start_at + normalized.duration
   );
