alter table public.map_requests
  add column if not exists map_name text;

alter table public.map_requests
  drop constraint if exists map_requests_map_name_check;

alter table public.map_requests
  add constraint map_requests_map_name_check
  check (map_name is null or char_length(btrim(map_name)) between 1 and 160);
