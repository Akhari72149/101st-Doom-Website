# Supabase migration runbook

Status: preparation only. No production export, restore, environment change, or server deployment has been performed.

## 1. Establish the destination

Confirmed host: Contabo, Windows Server 2016 Datacenter. The Contabo product type is still unknown. The Supabase Linux container stack requires a Linux environment; do not install Docker Desktop on this Windows Server as the deployment approach.

- Contabo VPS: nested virtualization is unsupported. Use a separate Linux server for Supabase; the website can remain on Windows.
- Contabo VDS or dedicated server: a Linux VM may be possible after checking virtualization availability and resources. Run Docker Engine/Compose inside that VM.

References: https://docs.docker.com/desktop/troubleshoot-and-support/faqs/windowsfaqs/ and https://help.contabo.com/en/support/solutions/articles/103000271595-can-i-setup-nested-virtualization-on-my-server-

Record the server OS, available RAM/disk, backup location, and intended API domain before selecting installation commands. Use the official Supabase Docker deployment for the server. Use a separate staging instance for the first restore.

https://supabase.com/docs/guides/self-hosting/docker

Configure persistent database and Storage volumes, HTTPS, private database access, restricted Studio access, SMTP, and unique generated secrets. Pin the tested deployment revision and images. Match the source Postgres major version and check Auth/Storage schema compatibility before restoring.

Keep staging cron, outgoing email, Discord dispatch, and other external side effects disabled during rehearsal.

## 2. Inventory the actual hosted project

Run `supabase/migration-tools/inventory.sql` in the hosted project's SQL editor and retain the results privately. This is a read-only starting inventory, not a backup or a complete verification of data.

Also export/review:

- All application schemas, tables, rows, sequences, views, indexes, constraints, grants, RLS policies, SQL functions and triggers.
- Auth accounts and related Auth records, preserving UUIDs and password hashes. Do not recreate accounts with new IDs.
- Custom changes to managed schemas such as Auth triggers and Storage policies, which need separate review/export.
- Storage bucket configuration AND actual file contents. A database dump alone does not copy files.
- Cron job definitions, schedules, timezone configuration, and required extensions. Review commands privately because they can contain secrets. Recreate jobs disabled until cutover.
- Realtime publication membership and replica identity settings.
- Edge Function source, versions, environment secrets, Auth providers, redirect URLs, email templates, SMTP settings, webhooks and API exposure settings.
- Vault secrets and their dependent functions: encrypted data alone is not proof that secrets will decrypt on the destination. Re-provision securely and test consumers.
- Migration history, including changes made directly in the hosted SQL editor. Repository migrations alone are not a full backup.

The repository currently uses Supabase Auth/SSR, server-side administrative access, and Realtime on `/servers`. RPC consumers include XP ingest, medical ingest, weekly reset, Steam link finalization, and password checks. No direct Storage SDK usage was found in `src`; this does not establish whether hosted buckets contain files.

## 3. Prepare the migration workstation

The initial inspection did not find `supabase`, `docker`, `psql`, or `pg_dump` on PATH. Install Docker with Linux containers, Supabase CLI, and PostgreSQL client tools before exporting. A Linux migration host is also suitable.

Check installed commands before using the export flags:

```powershell
docker version
supabase --version
supabase --help
supabase db --help
supabase db dump --help
psql --version
```

Use a private backup folder outside this repository. Database dumps contain personal data and password hashes; encrypt backups and restrict access. Supply connection credentials through a local secret mechanism; do not commit them or paste them into chat.

## 4. Rehearse export and restore

Follow the official platform-to-self-hosted workflow after checking the installed CLI help:

https://supabase.com/docs/guides/self-hosting/restore-from-platform

The documented workflow exports database roles, schema, and data separately using `supabase db dump`. It restores them into a fresh self-hosted instance with `psql`, `ON_ERROR_STOP`, and a single transaction; triggers are disabled for the data import. Use the direct database connection or session pooler, not transaction pooling.

Review the generated exports for included schemas and compare with the inventory. Handle custom Auth/Storage objects and migration history separately where necessary. Resolve incompatible versions by aligning services/schema; do not discard nonempty tables or silently skip failed imports to claim success.

Copy Storage files using the documented Storage migration workflow and verify object counts, sizes and representative downloads:

https://supabase.com/docs/guides/self-hosting/copy-storage

Recreate settings and deploy Edge Functions separately where present. Existing cloud tokens will not authenticate against new signing keys; plan for users to sign in again. Test existing account passwords on staging.

## 5. Verify completeness

Compare source and target at the same snapshot: exact row counts for all application/Auth tables, primary-key sets, important totals, sequence positions, constraints, function signatures/bodies, policies/grants, extensions and publication membership. Counts alone are insufficient: compare deterministic data checksums or complete exports for critical tables. Compare Storage files separately.

Use `inventory.sql` on both sides as a starting point. Statistics estimates are explicitly labelled and are not acceptance criteria. Investigate every restore warning/error.

Preserve personnel IDs, Steam links, lifetime XP/medical values, weekly records/receipts, medal assignments, attendance responses and schedules, Discord message IDs, account roles and page permissions. Do not reset weekly data as part of the migration.

## 6. Point a development build at staging

The app reads these exact variables:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=<self-hosted HTTPS API URL>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<destination browser-compatible key>
SUPABASE_SERVICE_ROLE_KEY=<destination server-only service-role key>
```

`src/lib/supabase-admin.ts` prefers `SUPABASE_SECRET_KEY` over `SUPABASE_SERVICE_ROLE_KEY`. Replace or remove a stale `SUPABASE_SECRET_KEY` as well. Never put a privileged key in a `NEXT_PUBLIC_` variable. Rebuild Next.js after changing public environment values.

Keep application integration secrets consistent unless intentionally rotating them. Inspect bot/bridge environments for direct Supabase connections; callers that use the unchanged website API domain generally retain their endpoint.

Test login/logout, disabled accounts, page/API permissions, personnel, Steam linking, XP and medical ingest including duplicate suppression, medals, attendance create/edit/delete/repeat/reminders, server bookings and Realtime. Use test Discord channels and test events, with production dispatch disabled.

The new permission editor does not by itself establish that every route enforces permissions. Verify each restricted page/API. Keep the username-login rewrite as a separate tested change after the migrated baseline works.

## 7. Production cutover

1. Take and verify a destination backup/restore rehearsal.
2. Schedule a maintenance window. Stop website writes, bot pollers, bridge ingestion, source cron and any other writers. Verify bridge events are durably queued or retained for replay; do not assume stopping ingestion prevents loss.
3. Take final consistent exports and final Storage copy while writes remain paused.
4. Restore into a clean destination, repeat comparisons, and test critical flows.
5. Update production environment, rebuild/deploy, then enable the destination jobs and resume integration workers once. Never run dispatch/reset schedules on both databases.
6. Monitor database errors, login, Discord sends and XP ingestion. Retain the cloud project and encrypted final exports for rollback.

After new writes reach the destination, reverting the URL alone loses those writes. Pause writers and reconcile destination changes before rolling back. Enable scheduled encrypted off-server backups for both database and files, retention, monitoring and periodic restore tests before retiring the hosted project.

## Outstanding inputs

- Contabo VPS/VDS/dedicated product type, Linux destination, resources, API domain and access method.
- Hosted database inventory, source Postgres/service versions and Storage usage.
- Confirmed backup location and acceptable maintenance window.

These determine the exact export/restore and deployment commands. No migration is complete until the live inventory and restored data have been compared.
