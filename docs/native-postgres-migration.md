# Native Windows PostgreSQL migration

This replaces the Linux/self-hosted-Supabase plan. Implementation is in progress;
it is not yet a production-ready replacement for Supabase. The browser-facing
application pages and their permission checks have been migrated behind server
routes, while production authentication and application data remain on hosted
Supabase until the final refresh and cutover. Native accounts currently exist only
in the local rehearsal database.

The guarded production procedure is documented separately in
`docs/native-postgres-cutover-runbook.md`.

## Current implementation

- Exact-version dependencies: node-postgres, Better Auth and bcryptjs.
- Lazy server-only connection pool and transaction helper.
- Isolated username authentication at `/api/native-auth`, disabled by default.
- Database-backed sessions and login rate limiting, origin checks, disabled-user
  checks, HTTP-only cookies and disabled public registration.
- New passwords use Better Auth scrypt; imported bcrypt hashes can be verified.
- The PostgreSQL 16 rehearsal contains the five Better Auth tables and 11 selected
  active hosted accounts with preserved UUIDs and bcrypt hashes. Four role-style
  test accounts were excluded during review. Existing login
  sessions were intentionally not copied. The private username mapping and its
  human-readable review are kept under the git-ignored `.migration-private/`
  directory.
- Separate `app_auth_*` tables so existing Supabase objects remain untouched.
- Explicit permission lookup helpers used by the converted routes. No application
  page imports the Supabase browser client directly; database credentials and
  authorization decisions remain server-side.
- XP, medical ingest and weekly reset routes can use `ARMA_DATABASE_BACKEND=postgres`
  with parameterized calls to the restored SQL functions. Default remains Supabase.
  Only enable this in an isolated development build after restoring the functions
  and their data. Other profile reads still use Supabase: splitting production
  reads and writes between databases would produce inconsistent results.
- Server bookings now use the protected `/api/server-bookings` route instead of
  browser database writes or the legacy shared password. Set
  `SERVER_BOOKINGS_BACKEND=postgres` only in the isolated native rehearsal;
  omission keeps the current hosted Supabase backend. Booking changes require
  `operations.server-bookings` at `edit` or `full`. Existing admin, NCO, trainer,
  and Akhari roles are backfilled with `full` access during the transition.
- Public visitors can still view the booking calendar. Eligible-personnel data,
  creates, and cancellations are returned only to an authorized account. The
  page refreshes through the protected route every ten seconds in place of
  Supabase Realtime.
- The public roster now reads through `/api/roster`. It defaults to hosted
  Supabase, while `ROSTER_DATABASE_BACKEND=postgres` uses the copied native data.
  The response is limited to the personnel, rank, and rank-history fields required
  by the roster UI; the browser no longer receives every personnel column.
- The personnel directory and dossier now read through `/api/personnel-profile`.
  Profile certifications, history, status audit, medals, and public Steam details
  are assembled server-side. XP and medical polling retains its existing ten-second
  cadence through `/api/personnel/xp-stats`; both APIs use native PostgreSQL when
  `PERSONNEL_DATABASE_BACKEND=postgres` is enabled in rehearsal.
- The public certification lookup reuses `/api/personnel-profile` for its directory
  and certification records. It no longer queries personnel, ranks, or certification
  assignments directly from the browser.
- Grand ORBAT now reads organization nodes and slotted personnel through
  `/api/grand-orbat`. The endpoint omits unrelated personnel status, Steam, and
  TeamSpeak fields and uses native PostgreSQL when `ORBAT_DATABASE_BACKEND=postgres`.
- Homepage bookings and daily promotion/certification highlights now use
  `/api/home-dashboard`. Its date windows are bounded and validated server-side,
  and `HOME_DATABASE_BACKEND=postgres` enables the copied native data in rehearsal.
  The previous unused browser authentication request was removed.
- Auth-schema preview/apply command and account importer with a reviewed UUID to
  username mapping. Imports are transactional and refuse existing target users.

Server routes retain hosted-Supabase branches for production compatibility. Leave
the existing Supabase variables in place until final cutover. Backend switches are
deliberately independent so merely enabling native authentication cannot split
reads and writes between hosted and native databases.

## Local setup

Both dev PC and server run PostgreSQL 16.14. The hosted source is PostgreSQL 17.6.
Keep both existing version 16 installations. See `postgres16-compatibility-review.md`
for the live inventory and the required native replacements. The first local
restore rehearsal is verified in `postgres16-restore-rehearsal.md`.

The official portable PostgreSQL 17.11 clients are now under the git-ignored
`.tools` directory. They are export utilities only: PostgreSQL 16.14 remains the
only running local database service. Fill in the existing private
`.env.postgres-export.local` file:

```dotenv
SOURCE_DATABASE_URL=postgresql://SOURCE_USER:URL_ENCODED_PASSWORD@SOURCE_HOST:5432/postgres?sslmode=verify-full
PG17_BIN=C:\Users\andko\Documents\Website\roster-app\.tools\postgresql-17.11\pgsql\bin
POSTGRES_BACKUP_DIRECTORY=C:\Users\andko\Documents\Database Backups\Roster
```

Get the source connection from hosted Supabase Dashboard > Connect, using direct
connection or session pooler. Use an encrypted/private backup directory outside
the repository. Passwords belong in the private file, not chat. The PostgreSQL 17
client folder must contain its matching DLLs as well as pg_dump/pg_restore.
If the connection needs a CA file, set PGSSLROOTCERT to its path; do not disable
certificate validation. Then run `npm run db:export-source`.

The raw source archive was created and checksum-verified on 5 September 2026.
The six Edge Function sources and six cron definitions are archived under
`migration/`. Secrets remain in their managed/private stores and are not committed.
The native PostgreSQL 16 rehearsal restores application and Auth data exactly;
Supabase platform services and unsupported extensions still require the documented
native replacements before production cutover.

In pgAdmin, create a SEPARATE empty development database, such as `roster_native_dev`.
Use a separate owner/migration connection for schema setup. The provisioning command
creates the dedicated `roster_app_runtime` login with no superuser, database creation,
role creation, inheritance, replication, or RLS-bypass privileges. The runtime role
must never be exposed to the browser or an internet-facing database gateway.

Create a private `.env.postgres.local` in the project root, using actual values:

```dotenv
DATABASE_URL=postgresql://YOUR_USER:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5432/roster_native_dev
DATABASE_POOL_MAX=10
APP_ORIGIN=http://localhost:3000
NATIVE_AUTH_SECRET=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
NATIVE_MIGRATION_DATABASE=roster_native_dev
```

This file is ignored by Git and is only loaded by the migration commands. It does
not change `.env.local` or automatically change the website's database. Keep it
private. Generate the secret locally:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Commands from the repository root (Node 24 used for verification):

```powershell
npm run db:check
npm run db:auth-schema
```

`db:check` reports the database/version/role, without printing the connection URL.
It flags superuser or BYPASSRLS connections. `db:auth-schema` previews the schema
SQL without applying it. Once using the intended migration role and empty target:

```powershell
npm run db:auth-schema -- --apply
```

Use the dedicated runtime role and grant the required operations on the generated
auth tables afterwards. Do not expose these tables via any public API.

For the guarded rehearsal database, provision the runtime login, apply the native
migrations as the owner, and verify the final privilege boundary:

```powershell
npm run db:provision-runtime
npm run db:migrate-native
npm run db:verify-runtime
```

Provisioning writes the generated runtime credential to the git-ignored
`.env.postgres-runtime.local` file without displaying it. Keep
`.env.postgres-target.local` as the private owner/migration connection and never use
that owner URL to run the website. The privilege audit confirms required application
access, rejects access to the hosted Auth schema, and verifies that the XP, medical,
and weekly-reset functions are not executable by `PUBLIC`.

## Importing existing login accounts

This step imports authentication records only. It is NOT a full database import.

Supply `SOURCE_DATABASE_URL` in the private environment file using a source role
that can read the required Auth fields. The importer opens a read-only source
connection. Prepare a private JSON file mapping every nondeleted source UUID to a
unique lowercase username:

```json
{
  "existing-account-uuid": "akhari"
}
```

Usernames allow 3-40 lowercase letters, numbers, underscores and dots. Do not
guess names from emails or regenerate UUIDs. Review the mapping with the account
owner/admin. Retained email is internal migration data, not the new login name.

```powershell
npm run db:import-auth -- --mapping C:\PrivateBackups\usernames.json
npm run db:import-auth -- --mapping C:\PrivateBackups\usernames.json --apply
```

Preview validates the mapping and password formats. Apply preserves UUIDs and
password hashes; current bans become disabled accounts. Accounts without an
email or supported bcrypt password require a separately reviewed reset/import
path. The importer aborts rather than dropping them. Deleted source accounts and
old sessions are not activated; retain the complete source archive for history.

The application's foreign keys to `auth.users` still need a reviewed migration
to the new account table, preserving historical/deleted identities where referenced.
Do not drop `auth.users` or remove old account records before that work is complete.

## Application rehearsal

The PostgreSQL rehearsal has migrations through
`022_scheduler_privileges.sql` applied. The migrations create
the page permission tables when the source snapshot predates them, import all current
permission definitions, and add the server-booking permission. Migration 004 grants
the restricted runtime role the initial application privileges; migration 005 adds
read-only roster access, and migration 006 adds the profile, medal, Steam, XP, and
medical reads used by the server-side dossier APIs. The hosted project receives the
equivalent page-permission migration from
`supabase/migrations/202609051200_add_server_booking_permission.sql`.

The hosted page-permissions base and server-booking migrations were applied and
verified on 6 September 2026. The guarded command remains available for an
idempotent status check or disaster-recovery replay:

```powershell
npm run db:migrate-hosted-permissions
npm run db:migrate-hosted-permissions -- --apply
```

For an isolated local website test, add these values to the local runtime
environment (not the committed files):

```dotenv
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
DATABASE_URL=postgresql://RUNTIME_USER:URL_ENCODED_PASSWORD@127.0.0.1:5432/roster_native_rehearsal
```

Keep the backend switches unset in production until native authentication and the
final database refresh have been completed. Do not point a public deployment at
PostgreSQL using the owner or migration account.

## Native authentication rehearsal

The login page, navbar, common role hooks, server-booking page, and permissions
manager have a disabled-by-default native mode. Start that limited rehearsal on
the development PC with:

```powershell
npm run dev:native-rehearsal -- -p 3011
```

Use one of the reviewed usernames from
`.migration-private/native-username-review.json` with that account's existing
Supabase password. The command injects `NATIVE_AUTH_ENABLED=true`,
`NEXT_PUBLIC_AUTH_BACKEND=native`, and `SERVER_BOOKINGS_BACKEND=postgres` only
into that development process. It also sets `ROSTER_DATABASE_BACKEND=postgres`.
It sets `PERSONNEL_DATABASE_BACKEND=postgres` for the personnel dossier and live
statistics routes. The command refuses a database whose name does not start with
`roster_native_`.

This is not a whole-site cutover. Pages that still query Supabase directly must
be converted to protected server routes before native mode is enabled in a
production deployment.

Native rehearsal routes now cover every application page, including the homepage,
roster and dossiers, attendance reporting, audits, taskboards, permissions,
personnel administration, medals and certifications, server bookings, Plan Ops,
Randomiser, and GC/CIS logistics. The shared app session returns per-page grants so
custom permissions control navigation as well as server authorization. Plan Ops
uses bounded polling in place of Supabase Realtime during native operation.

Discord attendance and announcements now have native PostgreSQL repositories.
Attendance sends, reminders, and ended-event cleanup use recoverable claims to
prevent overlapping bot polls from sending twice. The bot talks to
`/api/internal/discord-attendance` over HTTPS using `WEBSITE_BOT_SECRET`; it does not
receive a PostgreSQL password. Native personnel operations write Discord role work
to `discord_role_outbox`, which is consumed over the same protected API boundary.

## Remaining work before cutover

1. Repeat the verified source export immediately before cutover, with writers
   paused, then rerun the exact row/content and object comparison.
2. Run the full authenticated browser/action matrix against the final restored
   PostgreSQL copy and confirm every scheduled worker against test records.
3. Deploy the converted Discord attendance and announcement repositories and bot
   API client in one controlled maintenance window. Never expose an arbitrary
   SQL/table gateway or PostgreSQL credentials to the bot.
4. Verify account disable/delete and permission editing with the final native
   account set, including at least one read-only and one denied account.
5. Install the documented native scheduled jobs, verify the bot outbox consumer, and test
   attendance sending/reminders/role cleanup and XP ingestion on test data.
6. Verify a full rehearsal, encrypted database/file backups, restore procedure,
   and maintenance-window cutover with all writers paused and rollback planned.

For deployment, use HTTPS and set `APP_ORIGIN` to the website's exact origin. The
reverse proxy must overwrite forwarded IP headers so login throttling cannot be
bypassed by caller-supplied values. `NATIVE_AUTH_ENABLED=true` is reserved for
isolated testing until the remaining application conversion is complete.

## Tests

```powershell
npm run test:postgres
npm run test:postgres-integration
npx tsc --noEmit
```

The integration test creates a temporary PostgreSQL cluster on loopback using
only synthetic test accounts, stops it, and removes that exact temporary folder.
It does not connect to the installed service's database. Set `PG_BIN` if the
Postgres tools are outside `C:\Program Files\PostgreSQL\16\bin`.

Current verification covers synthetic account import and authentication, plus a
fixture RPC for parameter binding and response formatting. The production XP and
medical SQL functions still require restore and verification against copied data.
Better Auth's schema recheck currently warns about its own `lastRequest` bigint
column; replay and login-throttling tests pass. The dependency audit also reports
18 advisories across the project dependency tree; these have not been remediated
as part of this migration foundation.

The first native adaptation is complete in rehearsal: the three database-to-Edge
Function `pg_net` triggers now write to `discord_role_outbox`, and the Discord
bot has disabled-by-default HTTPS workers for both role updates and attendance.
Before enabling them, rotate `WEBSITE_BOT_SECRET` to the same randomly generated
value of at least 32 characters on the website and bot. Set the website's
`DISCORD_DATABASE_BACKEND=postgres`, then configure the bot with:

```dotenv
DISCORD_OUTBOX_URL=https://101stdoombattalion.com/api/internal/discord-outbox
ATTENDANCE_API_URL=https://101stdoombattalion.com/api/internal/discord-attendance
```
