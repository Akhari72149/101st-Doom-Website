create extension if not exists pgcrypto;

create table if not exists public.awards (
  id uuid primary key default gen_random_uuid(),
  code text,
  name text not null,
  description text,
  category text,
  icon_key text not null default 'medal',
  ribbon_color text not null default '#00ff66',
  award_type text not null default 'manual',
  trigger_domain text,
  trigger_metric text,
  trigger_threshold numeric,
  sort_order integer not null default 1000,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.awards
  add column if not exists code text,
  add column if not exists icon_key text not null default 'medal',
  add column if not exists ribbon_color text not null default '#00ff66',
  add column if not exists award_type text not null default 'manual',
  add column if not exists trigger_domain text,
  add column if not exists trigger_metric text,
  add column if not exists trigger_threshold numeric,
  add column if not exists sort_order integer not null default 1000,
  add column if not exists is_active boolean not null default true,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists awards_code_key on public.awards (code);
create index if not exists awards_category_idx on public.awards (category);
create index if not exists awards_trigger_idx on public.awards (trigger_domain, trigger_metric, trigger_threshold)
  where award_type = 'automatic';

create table if not exists public.personnel_awards (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  award_id uuid not null references public.awards(id) on delete cascade,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references auth.users(id) on delete set null,
  notes text,
  source text not null default 'manual',
  source_event_id text,
  created_at timestamptz not null default now()
);

alter table public.personnel_awards
  add column if not exists awarded_at timestamptz not null default now(),
  add column if not exists awarded_by uuid references auth.users(id) on delete set null,
  add column if not exists notes text,
  add column if not exists source text not null default 'manual',
  add column if not exists source_event_id text,
  add column if not exists created_at timestamptz not null default now();

create unique index if not exists personnel_awards_unique_award_per_person
  on public.personnel_awards (personnel_id, award_id);

create index if not exists personnel_awards_personnel_idx
  on public.personnel_awards (personnel_id, awarded_at desc);

alter table public.awards enable row level security;
alter table public.personnel_awards enable row level security;

grant select on public.awards to authenticated;
grant select, insert, delete on public.personnel_awards to authenticated;
grant all on public.awards to service_role;
grant all on public.personnel_awards to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'awards'
      and policyname = 'authenticated can read medals'
  ) then
    create policy "authenticated can read medals"
      on public.awards
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personnel_awards'
      and policyname = 'authenticated can read personnel medals'
  ) then
    create policy "authenticated can read personnel medals"
      on public.personnel_awards
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personnel_awards'
      and policyname = 'medal staff can award medals'
  ) then
    create policy "medal staff can award medals"
      on public.personnel_awards
      for insert
      to authenticated
      with check (
        exists (
          select 1
          from public.user_roles as ur
          where ur.user_id = (select auth.uid())
            and lower(ur.role) in ('admin', 'nco', 'akhari')
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'personnel_awards'
      and policyname = 'medal staff can remove medals'
  ) then
    create policy "medal staff can remove medals"
      on public.personnel_awards
      for delete
      to authenticated
      using (
        exists (
          select 1
          from public.user_roles as ur
          where ur.user_id = (select auth.uid())
            and lower(ur.role) in ('admin', 'nco', 'akhari')
        )
      );
  end if;
end
$$;

insert into public.awards (
  code,
  name,
  description,
  category,
  icon_key,
  ribbon_color,
  award_type,
  trigger_domain,
  trigger_metric,
  trigger_threshold,
  sort_order
)
values
  (
    'REPUBLIC_VALOR_STAR',
    'Republic Valor Star',
    'Awarded for exceptional courage under fire, decisive action during critical operations, or conduct that directly preserves the mission.',
    'Valor',
    'star',
    '#facc15',
    'manual',
    null,
    null,
    null,
    10
  ),
  (
    'ORDER_OF_THE_TWIN_MOONS',
    'Order of the Twin Moons',
    'Awarded for sustained leadership, command presence, and calm decision-making across multiple operations.',
    'Command',
    'shield',
    '#38bdf8',
    'manual',
    null,
    null,
    null,
    20
  ),
  (
    'BESKAR_SHIELD_COMMENDATION',
    'Beskar Shield Commendation',
    'Awarded for repeatedly protecting squadmates, holding defensive lines, or absorbing danger so others can complete the objective.',
    'Defense',
    'shield',
    '#94a3b8',
    'manual',
    null,
    null,
    null,
    30
  ),
  (
    'KYBER_SERVICE_MEDAL',
    'Kyber Service Medal',
    'Awarded for reliable service, unit-first conduct, and consistent contribution to the battalion outside a single operation.',
    'Service',
    'medal',
    '#a78bfa',
    'manual',
    null,
    null,
    null,
    40
  ),
  (
    'CLANKER_BREAKER_RIBBON',
    'Clanker Breaker Ribbon',
    'Automatically intended for personnel who destroy 100 infantry targets recorded through Arma XP tracking.',
    'Combat',
    'swords',
    '#22c55e',
    'automatic',
    'combat',
    'lifetime_kills',
    100,
    100
  ),
  (
    'DROID_REAPER_MEDAL',
    'Droid Reaper Medal',
    'Automatically intended for personnel who destroy 500 recorded targets across tracked operations.',
    'Combat',
    'swords',
    '#16a34a',
    'automatic',
    'combat',
    'lifetime_kills',
    500,
    110
  ),
  (
    'IRON_WALKER_BADGE',
    'Iron Walker Badge',
    'Automatically intended for personnel who destroy 25 tracked vehicle, APC, IFV, or tank targets.',
    'Combat',
    'swords',
    '#fb923c',
    'automatic',
    'combat',
    'vehicle_kills',
    25,
    120
  ),
  (
    'SKYFALL_MARK',
    'Skyfall Mark',
    'Automatically intended for personnel who destroy 10 tracked aircraft or air targets.',
    'Combat',
    'swords',
    '#60a5fa',
    'automatic',
    'combat',
    'aircraft_kills',
    10,
    130
  ),
  (
    'KAMINO_LIFESAVER_MEDAL',
    'Kamino Lifesaver Medal',
    'Automatically intended for medics who restart 10 hearts through tracked medical actions.',
    'Medical',
    'medical',
    '#ef4444',
    'automatic',
    'medical',
    'heart_restarts',
    10,
    200
  ),
  (
    'BACTA_FLOW_RIBBON',
    'Bacta Flow Ribbon',
    'Automatically intended for medics who administer 50 litres of tracked plasma support.',
    'Medical',
    'medical',
    '#dc2626',
    'automatic',
    'medical',
    'plasma_litres',
    50,
    210
  ),
  (
    'FIELD_SURGEON_CREST',
    'Field Surgeon Crest',
    'Automatically intended for medics who complete 25 tracked surgeries or fracture reductions.',
    'Medical',
    'medical',
    '#f97316',
    'automatic',
    'medical',
    'surgeries',
    25,
    220
  ),
  (
    'AIRWAY_GUARDIAN_MARK',
    'Airway Guardian Mark',
    'Automatically intended for medics who complete 50 tracked airway checks or lung treatments.',
    'Medical',
    'medical',
    '#06b6d4',
    'automatic',
    'medical',
    'airway_lung_actions',
    50,
    230
  ),
  (
    'FORGE_TECHNICIAN_BADGE',
    'Forge Technician Badge',
    'Awarded for technical support, mission preparation, mod assistance, or behind-the-scenes systems work that keeps operations running.',
    'Support',
    'engineering',
    '#eab308',
    'manual',
    null,
    null,
    null,
    300
  ),
  (
    'HOLOCRON_ARCHIVIST_MEDAL',
    'Holocron Archivist Medal',
    'Awarded for documentation, media, records, lore, or archive work that preserves the battalion story.',
    'Support',
    'star',
    '#c084fc',
    'manual',
    null,
    null,
    null,
    310
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  category = excluded.category,
  icon_key = excluded.icon_key,
  ribbon_color = excluded.ribbon_color,
  award_type = excluded.award_type,
  trigger_domain = excluded.trigger_domain,
  trigger_metric = excluded.trigger_metric,
  trigger_threshold = excluded.trigger_threshold,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();
