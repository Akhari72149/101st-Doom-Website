-- Import historical Google Form responses only for personnel confirmed in the
-- supplied CR / CR-C tracker screenshots. Service number and name must both
-- match, preventing a recycled number or similarly named profile receiving data.

create temp table operation_count_import_097 (
  service_number text not null,
  expected_name text not null,
  rank_stage text not null,
  attendance_type text not null,
  host_name text not null,
  occurred_on date not null,
  submitted_at timestamp without time zone not null
) on commit drop;

insert into operation_count_import_097
  (service_number, expected_name, rank_stage, attendance_type, host_name, occurred_on, submitted_at)
values
  ('18505', 'Grass', 'CR',   'funop',      'CSS-1393 "Vassk"',       '2026-06-20', '2026-06-21 15:38:19'),
  ('18505', 'Grass', 'CR',   'mainop',     'CSP-27427 "Rat"',        '2026-06-26', '2026-06-27 14:36:00'),
  ('18505', 'Grass', 'CR',   'funop',      'CX-O-72149 "Akhari"',    '2026-07-07', '2026-07-10 07:15:27'),
  ('18505', 'Grass', 'CR',   'funop',      'CSP-6251 "Allen"',       '2026-07-09', '2026-07-10 09:22:01'),
  ('45850', 'Brick', 'CR-C', 'mainop',     'Rat',                     '2026-07-17', '2026-07-18 09:23:54'),
  ('31724', 'Cardinal', 'CR-C', 'mainop',  'CSM-9082 "Xykaii"',      '2025-11-15', '2025-11-16 13:02:55'),
  ('12412', 'Coburn', 'CR-C', 'mainop',    'Advisor, Rollin',         '2026-04-26', '2026-04-27 06:13:42'),
  ('19595', 'Dhaswo', 'CR-C', 'mainop',    'Razgriz',                 '2026-09-27', '2026-09-28 06:00:35'),
  ('21059', 'Kattun', 'CR-C', 'mainop',    'CX-V 27027 "Bluejay"',   '2026-06-06', '2026-06-07 11:44:42'),
  ('21059', 'Kattun', 'CR-C', 'mainop',    'CX-V-17705 "Traitor"',   '2026-06-20', '2026-06-21 11:55:39'),
  ('24192', 'Lucky', 'CR-C', 'mainop',     'Rat',                     '2026-03-13', '2026-03-14 10:04:18'),
  ('17109', 'Mel', 'CR', 'mainop',         'Sheperd',                 '2026-05-31', '2026-05-31 12:12:47'),
  ('17109', 'Mel', 'CR-C', 'funop',        'Falcon',                  '2026-06-02', '2026-06-02 11:13:24'),
  ('17109', 'Mel', 'CR-C', 'mainop',       'Mockup',                  '2026-06-07', '2026-06-07 09:08:17'),
  ('17764', 'Orion', 'CR-C', 'rto-course', 'CI-79465 "REMO"',        '2026-05-09', '2026-05-10 15:34:23'),
  ('56705', 'Pico', 'CR-C', 'funop',       'Hollowed',                '2025-12-10', '2025-12-11 21:15:19'),
  ('24101', 'Sansom', 'CR-C', 'mainop',    'Raizken',                 '2026-02-28', '2026-02-28 11:02:04'),
  ('7563', 'WereBear', 'CR-C', 'funop',    'CSS-7621 "Cookie"',       '2026-05-16', '2026-05-17 16:26:53'),
  ('9201', 'Zarghan', 'CR-C', 'rto-course','Sheperd',                 '2025-03-28', '2025-03-29 06:22:27'),
  ('9201', 'Zarghan', 'CR-C', 'mainop',    'Dark',                    '2025-03-29', '2025-03-30 12:22:03'),
  ('9201', 'Zarghan', 'CR-C', 'mainop',    'Mockup',                  '2025-03-30', '2025-03-31 06:07:33'),
  ('9201', 'Zarghan', 'CR-C', 'cls-course','Necron',                  '2025-03-30', '2025-03-31 09:09:49');

insert into public.operation_count_submissions
  (personnel_id, rank_id, rank_stage, attendance_type, host_name, occurred_on, created_at)
select
  personnel.id,
  stage_rank.id,
  source.rank_stage,
  source.attendance_type,
  source.host_name,
  source.occurred_on,
  source.submitted_at at time zone 'Europe/London'
from operation_count_import_097 source
join public.personnel personnel
  on personnel.birth_number = source.service_number
 and lower(btrim(personnel.name)) = lower(source.expected_name)
left join lateral (
  select ranks.id
  from public.ranks ranks
  where upper(btrim(ranks.name)) = source.rank_stage
  order by ranks.rank_level, ranks.id
  limit 1
) stage_rank on true
on conflict (personnel_id, rank_stage, attendance_type, occurred_on, lower(btrim(host_name)))
do nothing;
