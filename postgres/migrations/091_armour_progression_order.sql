create table if not exists public.armour_progression_rank_points (
  rank_key text primary key,
  track text not null check (track in ('standard','pilot','alias')),
  sort_order integer not null,
  points integer not null default 0 check (points >= 0),
  unrestricted boolean not null default false,
  equivalent_rank text,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

with progression(rank_key,track,sort_order,points,unrestricted,equivalent_rank) as (
  values
    ('CR','standard',0,0,false,null),('CR-C','standard',10,0,false,null),('CT','standard',20,0,false,null),
    ('PTC','standard',30,20,false,null),('PSC','standard',40,20,false,null),('PFC','standard',50,20,false,null),
    ('CST','standard',60,20,false,null),('SCT','alias',61,0,false,'CST'),
    ('VCT','standard',70,32,false,null),('CVT','alias',71,0,false,'VCT'),('CSP','standard',80,32,false,null),
    ('CTS','standard',90,32,false,null),('LCP','standard',100,32,false,null),('CP','standard',110,32,false,null),
    ('CSC','standard',120,38,false,null),('CPS','alias',121,0,false,'CSC'),('CVC','standard',130,38,false,null),
    ('CMC','standard',140,38,false,null),('CFC','standard',150,38,false,null),('LCS','standard',160,38,false,null),
    ('CS','standard',170,38,false,null),('CSS','standard',180,70,false,null),('CGS','standard',190,70,false,null),
    ('CMS','standard',200,70,false,null),('CFS','standard',210,70,false,null),('CSM','standard',220,70,false,null),
    ('SSM','standard',230,140,false,null),('BSM','standard',240,0,false,null),('CE','standard',250,140,false,null),
    ('Clone Ensign','alias',251,0,false,'CE'),('Clone 2nd Lieutenant','standard',260,140,false,null),
    ('Clone 1st Lieutenant','standard',270,0,false,null),('Clone Captain','standard',280,0,true,null),
    ('CMaj.','standard',290,0,true,null),('Clone Commander','standard',300,0,true,null),
    ('Clone Battalion Commander','standard',310,0,true,null),('BC','alias',311,0,true,'Clone Battalion Commander'),
    ('CXC','pilot',21,0,false,'CT'),('CX-C','pilot',22,0,false,'CT'),('CX','pilot',41,0,false,'PSC'),
    ('CSX','pilot',61,0,false,'CST'),('CVX','pilot',71,0,false,'VCT'),('CX-V','pilot',72,0,false,'VCT'),
    ('CXX','pilot',81,0,false,'CSP'),('CX-X','pilot',82,0,false,'CSP'),('CXT','pilot',91,0,false,'CTS'),
    ('CX-T','pilot',92,0,false,'CTS'),('CXP','pilot',111,0,false,'CP'),('CX-P','pilot',112,0,false,'CP'),
    ('CXS','pilot',171,0,false,'CS'),('CX-S','pilot',172,0,false,'CS'),('CXSS','pilot',181,0,false,'CSS'),
    ('CX-SS','pilot',182,0,false,'CSS'),('CXMS','pilot',191,0,false,'CGS'),('CX-MS','pilot',192,0,false,'CGS'),
    ('CXM','pilot',221,0,false,'CSM'),('CX-M','pilot',222,0,false,'CSM'),('CXO','pilot',312,0,true,'CSM'),
    ('CX-O','pilot',313,0,true,'CSM')
)
insert into public.armour_progression_rank_points
  (rank_key,track,sort_order,points,unrestricted,equivalent_rank)
select rank_key,track,sort_order,points,unrestricted,equivalent_rank from progression
on conflict (rank_key) do update
set track=excluded.track,
    sort_order=excluded.sort_order,
    equivalent_rank=excluded.equivalent_rank,
    active=true,
    updated_at=now();

update public.armour_progression_rank_points progression
set points=legacy.points,
    unrestricted=legacy.unrestricted,
    updated_at=now()
from public.armour_rank_point_values legacy
join public.ranks ranks on ranks.id=legacy.rank_id
where lower(progression.rank_key)=lower(ranks.name)
  and progression.equivalent_rank is null;

grant select, update on public.armour_progression_rank_points to roster_app_runtime;

alter table public.armour_progression_rank_points enable row level security;
drop policy if exists "native runtime armour progression reads" on public.armour_progression_rank_points;
create policy "native runtime armour progression reads" on public.armour_progression_rank_points
  for select to roster_app_runtime using (true);
drop policy if exists "native runtime armour progression configuration" on public.armour_progression_rank_points;
create policy "native runtime armour progression configuration" on public.armour_progression_rank_points
  for update to roster_app_runtime using (true) with check (true);
