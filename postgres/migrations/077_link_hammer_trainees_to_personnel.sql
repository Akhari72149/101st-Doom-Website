alter table public.hammer_ridealong_trainees
  add column if not exists personnel_id uuid references public.personnel(id) on delete set null;

create unique index if not exists hammer_ridealong_trainees_personnel_idx
  on public.hammer_ridealong_trainees (personnel_id)
  where personnel_id is not null;

