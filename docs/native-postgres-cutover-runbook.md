# Native PostgreSQL 16 cutover runbook

This runbook moves the hosted Supabase snapshot into the dedicated native
PostgreSQL 16 database. It does not uninstall PostgreSQL, alter another database,
or delete the hosted Supabase project. Keep Supabase available as the rollback
source until the native deployment has been stable and separately backed up.

## 1. Prepare private configuration

Create `.env.postgres-cutover.local` on the machine performing the restore. Do not
commit it. Use a dedicated empty database name, not `postgres` and not a database
used by another application.

```dotenv
POSTGRES_ADMIN_URL=postgresql://POSTGRES_ADMIN:URL_ENCODED_PASSWORD@127.0.0.1:5432/postgres
DATABASE_URL=postgresql://MIGRATION_OWNER:URL_ENCODED_PASSWORD@127.0.0.1:5432/roster_production
NATIVE_MIGRATION_DATABASE=roster_production
CUTOVER_CONFIRM_DATABASE=roster_production
POSTGRES_SOURCE_ARCHIVE=C:\PrivateBackups\Roster\roster-source-TIMESTAMP\source.dump
PG16_BIN=C:\Program Files\PostgreSQL\16\bin
PG17_BIN=C:\PrivateTools\postgresql-17\pgsql\bin
POSTGRES_RUNTIME_ENV_FILE=.env.postgres-runtime-cutover.local
DATABASE_POOL_MAX=10
APP_ORIGIN=https://101stdoombattalion.com
NATIVE_AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_32_CHARACTERS
```

PostgreSQL 17 is used only to read the hosted PostgreSQL 17 archive. The target
server and application database remain PostgreSQL 16.

## 2. Create and rehearse the target

Run these before the maintenance window with a recent export:

```powershell
npm run db:create-cutover
npm run db:check-cutover
npm run db:restore-cutover
npm run db:provision-cutover
npm run db:migrate-cutover
npm run db:check-cutover
npm run db:verify-cutover
```

Each cutover command requires `CUTOVER_CONFIRM_DATABASE` to exactly match the
database in `DATABASE_URL`. Creation refuses an existing database. Restore refuses
a database containing any tables. Applied migration files are checksum-locked.

## 3. Final data refresh

At the agreed maintenance-window start:

1. Put the website into maintenance mode and stop the Discord bot, Arma bridge,
   cron calls, attendance poller, and any other writers.
2. Confirm no writer is still changing hosted Supabase.
3. Run `npm run db:export-source` to produce a new archive and manifest.
4. Restore that archive into a newly created empty cutover database. Do not restore
   over the earlier rehearsal copy.
5. Provision the runtime role, then run the native migrations, readiness check,
   and runtime privilege verification again.
6. Import/synchronise the reviewed native-auth account mapping if the final export
   changed the account set.

## 4. Deploy configuration

Use the generated `.env.postgres-runtime-cutover.local` values in the website's
private production environment. Never deploy the migration-owner URL. Set:

```dotenv
NODE_ENV=production
NATIVE_AUTH_ENABLED=true
NEXT_PUBLIC_AUTH_BACKEND=native
SERVER_BOOKINGS_BACKEND=postgres
ROSTER_DATABASE_BACKEND=postgres
PERSONNEL_DATABASE_BACKEND=postgres
ARMA_DATABASE_BACKEND=postgres
ORBAT_DATABASE_BACKEND=postgres
HOME_DATABASE_BACKEND=postgres
ATTENDANCE_DATABASE_BACKEND=postgres
AUDIT_DATABASE_BACKEND=postgres
LOOKUP_DATABASE_BACKEND=postgres
TASKBOARD_DATABASE_BACKEND=postgres
ADMIN_PERSONNEL_DATABASE_BACKEND=postgres
MOD_TASKBOARD_DATABASE_BACKEND=postgres
RANDOMISER_DATABASE_BACKEND=postgres
LOGISTICS_DATABASE_BACKEND=postgres
PLANOPS_DATABASE_BACKEND=postgres
DISCORD_DATABASE_BACKEND=postgres
```

Before deployment, place the complete production values in the private,
git-ignored `.env.native-production.local` on the deployment machine and run:

```powershell
npm run deploy:check-native
```

The check requires every backend switch, native authentication, the restricted
runtime database role, the exact HTTPS origin, and sufficiently long secrets. It
does not print credentials. The file is a staging aid; use the hosting platform's
protected environment store for the running service.

Set the same newly generated `WEBSITE_BOT_SECRET` of at least 32 characters on the
website and Discord bot. Configure the bot's HTTPS endpoints, then restart the
website before the bot and Arma bridge.

## 5. Acceptance checks

Before reopening the site, verify login/logout, disabled accounts, the navigation
permission matrix, every admin write, public roster/profile pages, Steam linking,
server bookings across midnight, attendance create/update/delete and Discord
buttons, announcements, role outbox delivery, XP/medical ingestion, weekly reset,
and scheduled jobs. Confirm logs contain no connection strings or credentials.

## 6. Rollback

If acceptance fails, stop native writers, restore the previous website and bot
configuration, re-enable hosted Supabase backends, and restart the old deployment.
Reconcile any records written only to native PostgreSQL before another attempt.
Do not point both deployments at writable databases simultaneously.
