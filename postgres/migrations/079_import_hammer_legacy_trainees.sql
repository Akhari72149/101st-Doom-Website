with seed(lookup_name,started_course,phase1_total,phase2_total,ground_school,flight_school) as (
  values
    ('darth','2025-11-23'::date,2,0,'Complete','Complete'),
    ('twisted','2025-11-23'::date,0,0,'Complete','Not Complete'),
    ('sigma','2026-01-11'::date,2,6,'Complete','Complete'),
    ('grim','2026-01-11'::date,2,1,'Complete','Complete'),
    ('joker','2026-01-14'::date,2,0,'Complete','Not Complete'),
    ('eclipse','2026-02-01'::date,2,2,'Complete','Complete'),
    ('warden','2026-09-16'::date,0,0,'Complete','Not Complete'),
    ('giant','2026-09-16'::date,2,2,'Complete','Complete'),
    ('razgriz','2026-09-30'::date,2,0,'Complete','Complete'),
    ('icarus','2026-10-01'::date,1,0,'Complete','Not Complete')
), matched as (
  select seed.*,personnel.id personnel_id,personnel.name personnel_name,
         lower(coalesce(personnel.status,'active')) not in ('removed','retired','transferred') personnel_active
  from seed
  join public.personnel personnel on lower(btrim(personnel.name))=seed.lookup_name
), submitted as (
  select matched.*,
         count(reports.id) filter(where reports.phase=1)::integer submitted_phase1,
         count(reports.id) filter(where reports.phase=2)::integer submitted_phase2
  from matched
  left join public.hammer_ridealong_trainees trainees on trainees.personnel_id=matched.personnel_id
    or lower(btrim(trainees.name))=matched.lookup_name
  left join public.hammer_ridealong_reports reports on reports.trainee_id=trainees.id
  group by matched.lookup_name,matched.started_course,matched.phase1_total,matched.phase2_total,
           matched.ground_school,matched.flight_school,matched.personnel_id,matched.personnel_name,matched.personnel_active
)
update public.hammer_ridealong_trainees trainees
set personnel_id=submitted.personnel_id,
    name=submitted.personnel_name,
    started_course=submitted.started_course,
    ground_school=submitted.ground_school,
    flight_school=case when submitted.flight_school='Complete' then 'Complete' else trainees.flight_school end,
    phase1_adjustment=greatest(submitted.phase1_total,submitted.submitted_phase1)-submitted.submitted_phase1,
    phase2_adjustment=greatest(submitted.phase2_total,submitted.submitted_phase2)-submitted.submitted_phase2,
    updated_at=now()
from submitted
where trainees.personnel_id=submitted.personnel_id
   or lower(btrim(trainees.name))=submitted.lookup_name;

with seed(lookup_name,started_course,phase1_total,phase2_total,ground_school,flight_school) as (
  values
    ('darth','2025-11-23'::date,2,0,'Complete','Complete'),
    ('twisted','2025-11-23'::date,0,0,'Complete','Not Complete'),
    ('sigma','2026-01-11'::date,2,6,'Complete','Complete'),
    ('grim','2026-01-11'::date,2,1,'Complete','Complete'),
    ('joker','2026-01-14'::date,2,0,'Complete','Not Complete'),
    ('eclipse','2026-02-01'::date,2,2,'Complete','Complete'),
    ('warden','2026-09-16'::date,0,0,'Complete','Not Complete'),
    ('giant','2026-09-16'::date,2,2,'Complete','Complete'),
    ('razgriz','2026-09-30'::date,2,0,'Complete','Complete'),
    ('icarus','2026-10-01'::date,1,0,'Complete','Not Complete')
), matched as (
  select seed.*,personnel.id personnel_id,personnel.name personnel_name,
         lower(coalesce(personnel.status,'active')) not in ('removed','retired','transferred') personnel_active
  from seed
  join public.personnel personnel on lower(btrim(personnel.name))=seed.lookup_name
), ordering as (
  select coalesce(max(sort_order),-1) base from public.hammer_ridealong_trainees
)
insert into public.hammer_ridealong_trainees
  (personnel_id,name,started_course,ground_school,flight_school,sere,cxc_test,joining_hammer,
   phase1_adjustment,phase2_adjustment,sort_order,active)
select matched.personnel_id,matched.personnel_name,matched.started_course,matched.ground_school,
       matched.flight_school,'Waived','Not Complete',false,matched.phase1_total,matched.phase2_total,
       ordering.base+row_number() over(order by matched.started_course,matched.personnel_name),matched.personnel_active
from matched cross join ordering
where not exists (
  select 1 from public.hammer_ridealong_trainees existing
  where existing.personnel_id=matched.personnel_id or lower(btrim(existing.name))=matched.lookup_name
);
