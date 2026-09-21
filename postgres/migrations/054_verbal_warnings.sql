alter table public.disciplinary_reference_counters
  drop constraint if exists disciplinary_reference_counters_case_kind_check;
alter table public.disciplinary_reference_counters
  add constraint disciplinary_reference_counters_case_kind_check
  check (case_kind in ('verbal', 'warning', 'da'));

alter table public.disciplinary_cases
  drop constraint if exists disciplinary_cases_case_kind_check;
alter table public.disciplinary_cases
  add constraint disciplinary_cases_case_kind_check
  check (case_kind in ('verbal', 'warning', 'da'));

alter table public.disciplinary_cases
  drop constraint if exists disciplinary_cases_check;
alter table public.disciplinary_cases
  add constraint disciplinary_cases_expiry_check
  check (
    (case_kind = 'warning' and expires_at is not null and status <> 'pending_approval')
    or case_kind in ('verbal', 'da')
  );

create or replace function public.next_disciplinary_reference(target_kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_year integer := extract(year from current_date)::integer;
  next_value integer;
begin
  if target_kind not in ('verbal', 'warning', 'da') then
    raise exception 'Invalid disciplinary case kind';
  end if;
  insert into public.disciplinary_reference_counters(reference_year, case_kind, last_value)
  values (target_year, target_kind, 1)
  on conflict (reference_year, case_kind) do update
  set last_value = public.disciplinary_reference_counters.last_value + 1
  returning last_value into next_value;
  return (case
      when target_kind = 'verbal' then 'VERBAL'
      when target_kind = 'warning' then 'WARN'
      else 'DA'
    end) || '-' || target_year::text || '-' || lpad(next_value::text, 3, '0');
end;
$$;

revoke all on function public.next_disciplinary_reference(text) from public;
grant execute on function public.next_disciplinary_reference(text) to roster_app_runtime;
