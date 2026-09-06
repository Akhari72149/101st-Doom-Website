# PostgreSQL 16 compatibility review

Read-only inspection completed 2026-09-05 against hosted project `roster-system`
(`lrtbwyyqkeyqaopncewt`). No hosted data or settings were changed.

## Decision

Keep both existing PostgreSQL 16.14 installations and services. The source is
PostgreSQL 17.6. Use PostgreSQL 17 CLIENT binaries in a separate folder to export
the source; do not install/start a version 17 database service or upgrade the
existing clusters. Test all adapted definitions on a separate version 16 database.

This is not a certified downgrade. A successful schema and data restore plus
functional verification is required before production migration.

## Verified inventory

| Item | Hosted state |
| --- | --- |
| Application tables in public | 53 |
| Nondeleted login accounts | 15 |
| Accounts with bcrypt credentials | 15 |
| Verified MFA factors | 0 |
| Storage buckets / objects | 0 / 0 |
| Vault secrets | 0 |
| PostgreSQL large objects | 0 |
| Scheduled jobs | 6 active, cron timezone GMT |
| Deployed Edge Functions | 6 |
| user_page_permissions table | Absent |
| supabase_migrations.schema_migrations | Absent |

This inventory is a point-in-time finding, not a backup. Recheck before cutover.
No passwords, tokens, function bodies containing credentials, or personnel rows
are included in this report. The account importer supports the detected bcrypt
format, but each account still needs a reviewed username mapping.

## Dependencies to adapt

| Dependency | Native Windows plan |
| --- | --- |
| plpgsql | Native PostgreSQL language; retain SQL/business logic |
| pgcrypto, uuid-ossp | Verify extension availability on destination; preserve schema-qualified references |
| pg_stat_statements 1.11 | Optional monitoring; source extension version cannot be assumed compatible with PG16 |
| pg_cron | Replace six jobs with Windows scheduler/worker; preserve timing |
| pg_net and http | Replace external calls using authenticated application/worker code |
| supabase_vault | No current secrets, but inspect dependencies before omitting extension |
| auth.uid()/auth.role() and auth.users | Adapt policy/audit context and foreign keys to native accounts |
| Supabase Realtime | App has subscriptions; no public tables were listed in publication membership at inspection |
| ICU locale | Source reports ICU provider and en_US.UTF-8; verify destination locale and ordering/uniqueness behavior |

Six application foreign keys reference auth.users: user_roles, profiles, audit_logs,
personnel_awards, operation_plans, and discord_attendance_events. Preserve the UUIDs
and delete behavior when redirecting these foreign keys. Do not drop historical
identities merely because login changes.

The public audit functions `log_personnel_changes` and
`log_certification_changes` reference Supabase auth context. The trigger functions
`sync_personnel_discord_tags`, `notify_cert_change`, and `notify_user_created`
reference external-call facilities. A native restore must not silently omit these
behaviors or invoke production Discord endpoints during rehearsal.

## Scheduled jobs

Times below are the actual configured GMT times, not inferred UK local time.

| Job | Schedule |
| --- | --- |
| attendance-mainop-monday | Monday 00:00 GMT |
| attendance-training-monday | Monday 00:00 GMT |
| reset_server_bookings_weekly | Monday 04:30 GMT |
| shift_recurring_server_blocks_weekly | Monday 04:31 GMT |
| weekly-attendance-current-week | Monday 04:00 GMT |
| arma-weekly-xp-reset | Sunday 23:59 GMT |

Do not translate these to Windows local time without accounting for daylight
saving. Job commands require private export and review; the inspection recorded
schedule metadata, not a full runnable scheduler replacement.

## Edge Functions

- discord-rank-sync (version 7)
- discord-cert-sync (version 4)
- discord-user-init (version 4)
- discord-full-import (version 5)
- sync-slot-roles (version 23)
- sync-personnel-discord-tags (version 5)

These are outside a PostgreSQL dump. Archive their source and provision their
secrets separately, then port and test their behavior before switching off Supabase.

## Next executable step

Use `scripts/postgres/export-source.mjs` after providing the version 17 client
binary folder and a private source connection URL. The exporter is read-only,
creates a new backup directory, archives the database without filtering out
application tables, and records the archive table of contents and checksum.
Cron metadata still requires a separate private export. The script does not
restore, transform, or delete anything.

The raw archive is the source of record. Prepare a separate reviewed native restore
plan from it. Never run the raw full archive blindly into an existing database:
managed schemas, extensions and ownership need adaptation. Do not discard data
sections to work around restore errors. Exact row and content verification remains
outstanding until a complete source export and target restore are available.
