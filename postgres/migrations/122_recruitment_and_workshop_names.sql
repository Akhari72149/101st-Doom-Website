create table if not exists public.server_control_workshop_items (
  workshop_id text primary key check (workshop_id ~ '^[0-9]{6,12}$'),
  display_name text not null,
  resolved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.server_control_workshop_items enable row level security;
revoke all on public.server_control_workshop_items from public;
grant select, insert, update on public.server_control_workshop_items to roster_app_runtime;
drop policy if exists "native runtime server workshop items" on public.server_control_workshop_items;
create policy "native runtime server workshop items"
  on public.server_control_workshop_items for all to roster_app_runtime
  using (true) with check (true);

create table if not exists public.recruitment_form_blocks (
  id uuid primary key default gen_random_uuid(),
  block_type text not null check (block_type in ('information','question')),
  field_key text unique,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text not null default '',
  input_type text check (input_type is null or input_type in ('text','textarea','yes_no','single_choice','multi_choice')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  required boolean not null default false,
  active boolean not null default true,
  sort_order integer not null default 0,
  updated_by uuid references public.app_auth_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (block_type='information' and field_key is null and input_type is null and required=false)
    or
    (block_type='question' and field_key is not null and input_type is not null)
  )
);

create table if not exists public.recruitment_responses (
  id uuid primary key default gen_random_uuid(),
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  service_number text not null,
  nickname text not null,
  discord_name text not null,
  selected_platoons jsonb not null default '[]'::jsonb check (jsonb_typeof(selected_platoons) = 'array'),
  status text not null default 'new' check (status in ('new','contacted','accepted','archived')),
  internal_notes text not null default '',
  processed_by uuid references public.app_auth_users(id) on delete set null,
  processed_at timestamptz,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists recruitment_responses_status_submitted_idx
  on public.recruitment_responses(status, submitted_at desc);
create index if not exists recruitment_responses_identity_idx
  on public.recruitment_responses(lower(nickname), service_number);

alter table public.recruitment_form_blocks enable row level security;
alter table public.recruitment_responses enable row level security;
revoke all on public.recruitment_form_blocks from public;
revoke all on public.recruitment_responses from public;
grant select, insert, update, delete on public.recruitment_form_blocks to roster_app_runtime;
grant select, insert, update, delete on public.recruitment_responses to roster_app_runtime;

drop policy if exists "native runtime recruitment form" on public.recruitment_form_blocks;
create policy "native runtime recruitment form"
  on public.recruitment_form_blocks for all to roster_app_runtime
  using (true) with check (true);
drop policy if exists "native runtime recruitment responses" on public.recruitment_responses;
create policy "native runtime recruitment responses"
  on public.recruitment_responses for all to roster_app_runtime
  using (true) with check (true);

insert into public.recruitment_form_blocks
  (block_type,field_key,title,description,input_type,options,required,sort_order)
values
  ('information',null,'Before you apply','Answer each question honestly. Your response is reviewed by the 101st recruitment team.',null,'[]',false,10),
  ('question','previous_unit','Have you played with an Arma 3 Star Wars unit previously?','Tell us whether you have prior Starsim experience.','yes_no','["Yes","No"]',true,20),
  ('question','legal_copy','Do you own a legal copy of Arma 3?','','yes_no','["Yes","No"]',true,30),
  ('information',null,'Main Operations','The 101st runs four platoon Main Operations. Times shown below should be selected according to the operations you can regularly attend.',null,'[]',false,40),
  ('question','platoons','Which platoon Main Operations can you attend?','Select every Main Operation you can regularly attend. Times use UK time and may be edited by recruitment staff when schedules change.','multi_choice','["Tomahawk 1 - 20:00 to 22:00 UK","Claymore 2 - 00:00 to 02:00 UK","Broadsword 3 - 02:00 to 04:00 UK","Dagger - 23:00 to 01:00 UK"]',true,50),
  ('question','operation_types','I understand the difference between Main Operations and Fun Operations.','Main Operations are scheduled unit events. Fun Operations are additional optional events.','yes_no','["Yes","No"]',true,60),
  ('information',null,'Training and progression','Certification, MOS and rank information is published on the website and can be reviewed before submitting.',null,'[]',false,70),
  ('question','certifications_understood','I have reviewed the training and certification information.','See the Training & Certifications page for the current catalogue.','yes_no','["Yes","No"]',true,80),
  ('question','rank_structure_viewed','I have reviewed the Rank Structure page.','','yes_no','["Yes","No"]',true,90),
  ('question','mod_setup_complete','I have reviewed the How to Join page and downloaded the required modlist.','','yes_no','["Yes","No"]',true,100),
  ('question','garc_understood','I understand that the 101st participates in the Grand Army of the Republic Community alliance.','','yes_no','["Yes","No"]',true,110),
  ('question','service_number','Requested five-digit service number','Use five digits, do not begin with 0, and do not use 12345 or a combination of 42069. Availability is not guaranteed.','text','[]',true,120),
  ('question','nickname','Requested nickname','Keep it appropriate and no more than three syllables. Availability is not guaranteed.','text','[]',true,130),
  ('question','discord_name','Discord profile name','Enter the Discord name recruiters can use to contact you.','text','[]',true,140),
  ('question','next_steps','I understand that after submitting I should join Discord, ping Recruiter in Recruitment Text, and enter TeamSpeak.','','yes_no','["Yes","No"]',true,150)
on conflict (field_key) do nothing;

insert into public.app_page_permissions
  (permission_key,page_path,label,category,description)
values
  ('admin.recruitment','/admin/recruitment','Recruitment','Records',
   'Review recruitment applications, manage their progress, and maintain the public recruitment form.')
on conflict (permission_key) do update
set page_path=excluded.page_path,label=excluded.label,category=excluded.category,
    description=excluded.description,updated_at=now();

insert into public.user_page_permissions
  (user_id,permission_key,access_level,granted_by,updated_at)
select users.id,'admin.recruitment','full',users.id,now()
from public.app_auth_users users
where lower(users.username)='akhari'
on conflict (user_id,permission_key) do update
set access_level='full',granted_by=excluded.granted_by,updated_at=now();
