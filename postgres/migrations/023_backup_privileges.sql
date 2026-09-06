do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'roster_app_backup') then
    create role roster_app_backup nologin nosuperuser nocreatedb nocreaterole
      noinherit noreplication bypassrls connection limit 1;
  end if;
end;
$$;

do $$
begin
  execute format('grant connect on database %I to roster_app_backup', current_database());
end;
$$;

grant usage on schema public to roster_app_backup;
grant select on all tables in schema public to roster_app_backup;
grant select on all sequences in schema public to roster_app_backup;
alter default privileges in schema public grant select on tables to roster_app_backup;
alter default privileges in schema public grant select on sequences to roster_app_backup;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    grant usage on schema auth to roster_app_backup;
    grant select on all tables in schema auth to roster_app_backup;
    grant select on all sequences in schema auth to roster_app_backup;
    alter default privileges in schema auth grant select on tables to roster_app_backup;
    alter default privileges in schema auth grant select on sequences to roster_app_backup;
  end if;
end;
$$;

revoke create on schema public from roster_app_backup;
