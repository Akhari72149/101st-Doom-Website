alter table public.certifications
  add column if not exists lead_personnel_id uuid;

alter table public.certifications
  drop constraint if exists certifications_lead_personnel_id_fkey;

alter table public.certifications
  add constraint certifications_lead_personnel_id_fkey
  foreign key (lead_personnel_id)
  references public.personnel(id)
  on delete set null;

create index if not exists certifications_lead_personnel_id_idx
  on public.certifications(lead_personnel_id)
  where lead_personnel_id is not null;

grant update (lead_personnel_id) on public.certifications to roster_app_runtime;

drop policy if exists "native runtime certification lead updates" on public.certifications;
create policy "native runtime certification lead updates"
  on public.certifications for update to roster_app_runtime
  using (true)
  with check (true);
