create table if not exists public.armour_rank_point_values (
  rank_id uuid primary key references public.ranks(id) on delete cascade,
  points integer not null default 0 check (points >= 0),
  unrestricted boolean not null default false,
  source_note text not null default 'Rank allocation',
  updated_at timestamptz not null default now()
);

create table if not exists public.armour_point_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null default 'Appointment',
  points integer not null check (points > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.armour_customisation_items (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  point_cost integer not null default 0 check (point_cost >= 0),
  rank_requirement text,
  description text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.armour_point_ledger (
  id uuid primary key default gen_random_uuid(),
  personnel_id uuid not null references public.personnel(id) on delete cascade,
  entry_type text not null check (entry_type in ('award', 'spend', 'adjustment')),
  points_delta integer not null,
  source_label text not null check (char_length(btrim(source_label)) between 1 and 200),
  source_id uuid references public.armour_point_sources(id) on delete set null,
  catalog_item_id uuid references public.armour_customisation_items(id) on delete set null,
  quantity integer not null default 1 check (quantity between 1 and 100),
  notes text,
  created_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (entry_type <> 'award' or points_delta > 0),
  check (entry_type <> 'spend' or points_delta <= 0),
  check (entry_type <> 'adjustment' or points_delta <> 0)
);

create index if not exists armour_point_ledger_personnel_idx
  on public.armour_point_ledger (personnel_id, created_at desc);
create index if not exists armour_point_ledger_created_idx
  on public.armour_point_ledger (created_at desc);

alter table public.armour_rank_point_values enable row level security;
alter table public.armour_point_sources enable row level security;
alter table public.armour_customisation_items enable row level security;
alter table public.armour_point_ledger enable row level security;

revoke all on public.armour_rank_point_values from public;
revoke all on public.armour_point_sources from public;
revoke all on public.armour_customisation_items from public;
revoke all on public.armour_point_ledger from public;

grant select on public.armour_rank_point_values, public.armour_point_sources,
  public.armour_customisation_items to roster_app_runtime;
grant select, insert on public.armour_point_ledger to roster_app_runtime;

drop policy if exists "native runtime armour rank points" on public.armour_rank_point_values;
create policy "native runtime armour rank points" on public.armour_rank_point_values
  for select to roster_app_runtime using (true);
drop policy if exists "native runtime armour point sources" on public.armour_point_sources;
create policy "native runtime armour point sources" on public.armour_point_sources
  for select to roster_app_runtime using (true);
drop policy if exists "native runtime armour catalogue" on public.armour_customisation_items;
create policy "native runtime armour catalogue" on public.armour_customisation_items
  for select to roster_app_runtime using (true);
drop policy if exists "native runtime armour ledger reads" on public.armour_point_ledger;
create policy "native runtime armour ledger reads" on public.armour_point_ledger
  for select to roster_app_runtime using (true);
drop policy if exists "native runtime armour ledger inserts" on public.armour_point_ledger;
create policy "native runtime armour ledger inserts" on public.armour_point_ledger
  for insert to roster_app_runtime with check (true);

insert into public.app_page_permissions (permission_key, page_path, label, category, description)
values ('admin.armour-points', '/admin/armour-points', 'Armour Customisation Points', 'Personnel Admin',
        'Award, spend, and correct armour customisation points with a permanent audit trail.')
on conflict (permission_key) do update
set page_path=excluded.page_path, label=excluded.label, category=excluded.category,
    description=excluded.description, updated_at=now();

insert into public.user_page_permissions (user_id, permission_key, access_level, granted_by, updated_at)
select users.id, 'admin.armour-points', 'full', users.id, now()
from public.app_auth_users users
where lower(users.username) = 'akhari'
on conflict (user_id, permission_key) do update
set access_level='full', granted_by=excluded.granted_by, updated_at=now();

with configured(rank_name, points, unrestricted) as (
  values
    ('CR',0,false),('CR-C',0,false),('CT',0,false),('PTC',20,false),('PSC',20,false),
    ('PFC',20,false),('CST',20,false),('VCT',32,false),('CSP',32,false),('CTS',32,false),
    ('LCP',32,false),('CP',32,false),('CSC',38,false),('CPS',38,false),('CVC',38,false),
    ('CMC',38,false),('CFC',38,false),('LCS',38,false),('CS',38,false),('CSS',70,false),
    ('CGS',70,false),('CMS',70,false),('CFS',70,false),('CSM',70,false),('SSM',140,false),('BSM',0,false),
    ('CE',140,false),
    ('Clone 2nd Lieutenant',140,false),('Clone 1st Lieutenant',140,false),
    ('Clone Captain',0,true),('CMaj.',0,true),('Clone Commander',0,true),
    ('Clone Battalion Commander',0,true),('BC',0,true),
    ('CXC',0,false),('CX',20,false),('CVX',32,false),('CXX',32,false),('CXT',32,false),
    ('CXP',32,false),('CXS',38,false),('CX-S',38,false),('CXSS',70,false),('CXMS',70,false),
    ('CXM',70,false),('CX-M',70,false),('CXO',0,true)
)
insert into public.armour_rank_point_values (rank_id, points, unrestricted)
select ranks.id, configured.points, configured.unrestricted
from configured join public.ranks ranks on lower(ranks.name)=lower(configured.rank_name)
on conflict (rank_id) do update
set points=excluded.points, unrestricted=excluded.unrestricted, updated_at=now();

insert into public.armour_point_sources (slug,name,category,points,sort_order) values
  ('certification-trainer','Certification Trainer','S-Shop appointment',10,10),
  ('certification-lead','Certification Lead','S-Shop appointment',20,20),
  ('zeus','Zeus','S-Shop appointment',10,30),
  ('senior-zeus','Senior Zeus','S-Shop appointment',20,40),
  ('mission-builder','Mission Builder','S-Shop appointment',30,50),
  ('senior-mission-builder','Senior Mission Builder','S-Shop appointment',50,60),
  ('media-team-member','Media Team Member','S-Shop appointment',10,70),
  ('media-team-manager','Media Team Manager','S-Shop appointment',20,80),
  ('media-team-lead','Media Team Lead','S-Shop appointment',30,90),
  ('gc-flex-zeus','GC Flex Zeus','C-Shop appointment',20,110),
  ('gc-zeus','GC Zeus','C-Shop appointment',40,120),
  ('gc-team-manager','GC Team Manager','C-Shop appointment',50,130),
  ('gc-lead','GC Lead','C-Shop appointment',60,140),
  ('mod-team-member','Mod Team Member','C-Shop appointment',30,150),
  ('mod-team-manager','Mod Team Manager','C-Shop appointment',40,160),
  ('mod-team-lead','Mod Team Lead','C-Shop appointment',50,170),
  ('recruiter','Recruiter','C-Shop appointment',10,180),
  ('senior-recruiter','Senior Recruiter','C-Shop appointment',20,190),
  ('recruitment-xo','Recruitment XO','C-Shop appointment',30,200),
  ('recruitment-lead','Recruitment Lead','C-Shop appointment',40,210),
  ('drill-instructor','Drill Instructor','C-Shop appointment',10,220),
  ('drill-instructor-xo','Drill Instructor XO','C-Shop appointment',30,230),
  ('drill-instructor-lead','Drill Instructor Lead','C-Shop appointment',40,240)
on conflict (slug) do update
set name=excluded.name, category=excluded.category, points=excluded.points,
    sort_order=excluded.sort_order, active=true, updated_at=now();

insert into public.armour_customisation_items
  (slug,name,category,point_cost,rank_requirement,description,sort_order) values
  ('initial-helmet','Initial Helmet Custom','Rank equipment',0,'CST+','Initial helmet customisation unlocked by rank.',10),
  ('partial-helmet','Partial Helmet Custom (No Visor)','Rank equipment',0,'CP+','Partial helmet customisation without a custom visor.',20),
  ('full-helmet','Full Helmet Custom (No Visor)','Rank equipment',0,'CS+','Full helmet customisation without a custom visor.',30),
  ('full-helmet-visor','Full Helmet Custom with Visor / Partial Armour','Rank equipment',0,'CSM+','Full helmet and visor with partial armour customisation.',40),
  ('full-everything','Full Customisation','Rank equipment',0,'Authorised command ranks','Full armour customisation entitlement.',50),
  ('custom-visor','Custom Visor','S-Shop',100,'CTS+','One custom visor.',110),
  ('armour-edits','Armour Edits / Logo or Designs','S-Shop',150,'VCT+','Armour edits, logo, or design work.',120),
  ('partial-custom-armour','Partial Custom Armour','S-Shop',200,'VCT+','Partial custom armour package.',130),
  ('custom-armour','Custom Armour','S-Shop',250,'VCT+','Full custom armour package.',140),
  ('custom-kama','Custom Kama','S-Shop',200,'VCT+','One custom kama.',150),
  ('custom-pauldron','Custom Pauldron','Rank equipment',0,'SSM+','Custom pauldron unlocked by rank.',160),
  ('additional-logo','Additional Logo (Complex)','S-Shop',40,null,'Additional complex logo, charged per design.',170),
  ('additional-design','Additional Design (Simple)','S-Shop',20,null,'Additional simple design, charged per design.',180),
  ('colour-unlock','Colour Unlock (Non-MOS)','S-Shop',250,'VCT+','Unlock a non-MOS armour colour.',190)
on conflict (slug) do update
set name=excluded.name, category=excluded.category, point_cost=excluded.point_cost,
    rank_requirement=excluded.rank_requirement, description=excluded.description,
    sort_order=excluded.sort_order, active=true, updated_at=now();
