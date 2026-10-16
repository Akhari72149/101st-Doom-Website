alter table public.hammer_ridealong_trainees
  add column if not exists phase1_adjustment integer not null default 0,
  add column if not exists phase2_adjustment integer not null default 0;

