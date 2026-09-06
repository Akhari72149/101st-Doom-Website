# Supabase cron archive

These jobs were read from hosted Supabase project `lrtbwyyqkeyqaopncewt`.

- Every `cronUtc` expression is evaluated in UTC.
- The target native PostgreSQL 16 installation on Windows does not rely on
  `pg_cron`. Recreate these jobs through a single application scheduler or
  Windows Task Scheduler after the database restore.
- Keep the Monday server-booking jobs ordered: reset at 04:30 UTC, then shift
  recurring blocks at 04:31 UTC.
- Each execution should use a dedicated least-privilege database role and log
  success or failure.

The SQL in `jobs.json` is an archive of the deployed behavior. Do not enable
the replacement schedules until the final cutover, otherwise both hosted and
self-hosted systems may execute the same weekly operations.
