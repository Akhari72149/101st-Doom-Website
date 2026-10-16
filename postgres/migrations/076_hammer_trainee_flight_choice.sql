alter table public.hammer_ridealong_trainees
  add column if not exists joining_hammer boolean not null default true;

