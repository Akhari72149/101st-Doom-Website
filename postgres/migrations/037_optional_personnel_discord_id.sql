update public.personnel
set discord_id = null
where btrim(discord_id) = '';

alter table public.personnel
  alter column discord_id drop not null;
