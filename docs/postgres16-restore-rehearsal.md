# PostgreSQL 16 restore rehearsal

## Result

The hosted Supabase PostgreSQL 17 source was exported on 5 September 2026
with PostgreSQL 17.11 client tools. The custom archive is stored outside the
repository:

```text
C:\Users\andko\Documents\Database Backups\Roster\roster-source-FH6D1X\source.dump
```

Archive SHA-256:

```text
e5ad8defc878fce632e946b450e22a75269747e53a7cf21a4eca3573835cb96f
```

The checksum was independently recalculated and matched. The archive contains
table data and produced no export warnings.

## Native restore

The rehearsal target is the isolated local PostgreSQL 16.14 database
`roster_native_rehearsal`. The existing `planops` database was not modified.

The operational restore includes the `public`, `auth`, and `extensions`
schemas. The raw archive remains the source of record for all Supabase platform
schemas. PostgreSQL 16-compatible restore preparation removes exactly the
PostgreSQL 17-only `SET transaction_timeout = 0` statement.

Supported local extensions:

- `pgcrypto` 1.3
- `uuid-ossp` 1.1
- `pg_stat_statements` 1.10 (available, not required by the restored objects)

Two compatibility roles are created as `NOLOGIN`:

- `authenticated`
- `supabase_functions_admin`

They preserve policy references without creating usable login accounts.

## Verification

Source and target sessions were normalized to UTC before comparison.

- Source tables: 76
- Target tables: 76
- Compared rows: 10,609
- Missing or extra tables: 0
- Row-count or deterministic content-fingerprint mismatches: 0
- Extra restored functions, triggers, policies, or constraints: 0

The target omits 19 functions supplied by Supabase's `http` extension. These
are extension implementation objects, not application functions.

The Windows PostgreSQL installation does not provide `pg_net`. These preserved
application trigger functions still call `net.http_post` and must be replaced
before enabling native writes:

- `public.notify_cert_change()` via `cert_role_trigger`
- `public.notify_user_created()` via `trigger_personnel_created`
- `public.sync_personnel_discord_tags()` via `personnel_discord_tags`

The replacement will use a transactional outbox and a restricted application
worker. Do not activate the native database in production while those triggers
still depend on Supabase endpoints.

## Native migration applied after baseline verification

The following native-only migrations were applied to the rehearsal database:

- `001_discord_role_outbox.sql` creates the protected transactional outbox and
  replaces the three `pg_net` trigger bodies with local inserts.
- `002_remove_legacy_password_functions.sql` removes two security-definer
  functions that compared submitted values with hard-coded plaintext secrets.

The outbox API is `POST /api/internal/discord-outbox`. It accepts only the
`claim`, `complete`, and `fail` actions authenticated by
`WEBSITE_BOT_SECRET`. Claims use `FOR UPDATE SKIP LOCKED`, a five-minute
lease, five-attempt limit, and bounded exponential retry delay.

The Discord bot worker is installed but disabled by default. It starts only when
`DISCORD_OUTBOX_URL` is configured. Do not set that variable until the website
is deployed against native PostgreSQL and the endpoint is available over HTTPS.

Successful outbox rows should be retained briefly for troubleshooting and then
deleted by a scheduled maintenance task. Dead rows should be retained longer and
alerted for manual review.

## Repeatable commands

```powershell
npm run db:create-rehearsal
npm run db:restore-rehearsal
npm run db:verify-rehearsal
```

The creator and restore runner refuse arbitrary database names and refuse to
overwrite a target containing tables. The verifier prints counts and object
names only; it does not print row contents.
