import pg from 'pg';

const jobs = {
  'arma-weekly-xp-reset': 'select * from public.reset_arma_xp_weekly_data()',
  'attendance-current-week': 'select public.ensure_current_attendance_week()',
  'reset-server-bookings-weekly': 'select public.reset_server_bookings_weekly()',
  'shift-recurring-server-blocks-weekly': 'select public.shift_recurring_server_blocks_week()',
};
const name = process.argv[process.argv.indexOf('--job') + 1];
const rollback = process.argv.includes('--rollback');
if (!name || !Object.hasOwn(jobs, name)) {
  throw new Error(`Use --job with one of: ${Object.keys(jobs).join(', ')}`);
}
if (!rollback && process.env.SCHEDULED_JOB_EXECUTION_ENABLED !== 'true') {
  throw new Error('Live scheduled execution is disabled; use --rollback for rehearsal');
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const identity = await client.query('select current_user as role, current_database() as database');
  if (identity.rows[0]?.role !== 'roster_app_scheduler') {
    throw new Error('Scheduled jobs must use roster_app_scheduler');
  }
  await client.query('begin');
  try {
    const result = await client.query(jobs[name]);
    if (rollback) await client.query('rollback');
    else await client.query('commit');
    console.log(JSON.stringify({
      job: name,
      database: identity.rows[0].database,
      mode: rollback ? 'rehearsal-rolled-back' : 'committed',
      rowsReturned: result.rowCount ?? 0,
    }));
  } catch (error) {
    await client.query('rollback');
    throw error;
  }
} finally {
  await client.end();
}
