alter table public.discord_role_outbox
  drop constraint if exists discord_role_outbox_event_type_check;

alter table public.discord_role_outbox
  add constraint discord_role_outbox_event_type_check check (
    event_type in (
      'CERT_ROLE_SYNC',
      'USER_ROLE_INIT',
      'PERSONNEL_STATUS_SYNC',
      'USER_FULL_IMPORT',
      'SLOT_ROLE_SYNC',
      'RANK_ROLE_SYNC',
      'ACCOUNT_CREDENTIALS_DM'
    )
  );

create or replace function public.enqueue_account_credentials_dm(event_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  if jsonb_typeof(event_payload) <> 'object'
     or coalesce(event_payload->>'discordId', '') !~ '^[0-9]{17,20}$'
     or coalesce(jsonb_typeof(event_payload->'sealed'), '') <> 'object'
     or not (event_payload->'sealed' ?& array['iv', 'tag', 'ciphertext'])
     or length(coalesce(event_payload->'sealed'->>'iv', '')) = 0
     or length(coalesce(event_payload->'sealed'->>'tag', '')) = 0
     or length(coalesce(event_payload->'sealed'->>'ciphertext', '')) = 0
     or length(coalesce(event_payload->'sealed'->>'iv', '')) > 100
     or length(coalesce(event_payload->'sealed'->>'tag', '')) > 100
     or length(coalesce(event_payload->'sealed'->>'ciphertext', '')) > 4000 then
    raise exception 'Invalid account credential delivery payload';
  end if;

  insert into public.discord_role_outbox (event_type, payload)
  values ('ACCOUNT_CREDENTIALS_DM', event_payload)
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.enqueue_account_credentials_dm(jsonb) from public;
grant execute on function public.enqueue_account_credentials_dm(jsonb) to roster_app_runtime;
