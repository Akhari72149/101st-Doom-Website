export function assertTarget({ argv = process.argv, env = process.env, purpose }) {
  const database = env.NATIVE_MIGRATION_DATABASE;
  if (!env.DATABASE_URL || !database) {
    throw new Error(`DATABASE_URL and NATIVE_MIGRATION_DATABASE are required for ${purpose}`);
  }

  const target = new URL(env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection URL');
  }
  if (decodeURIComponent(target.pathname.slice(1)) !== database) {
    throw new Error('DATABASE_URL must target NATIVE_MIGRATION_DATABASE exactly');
  }
  if (['postgres', 'template0', 'template1'].includes(database)) {
    throw new Error('Refusing to use a PostgreSQL maintenance or template database');
  }

  const cutover = argv.includes('--cutover');
  if (cutover) {
    if (!env.CUTOVER_CONFIRM_DATABASE || env.CUTOVER_CONFIRM_DATABASE !== database) {
      throw new Error('CUTOVER_CONFIRM_DATABASE must exactly match NATIVE_MIGRATION_DATABASE');
    }
  } else if (!/^roster_native_[a-z0-9_]+$/.test(database)) {
    throw new Error('Rehearsal database name must begin with roster_native_');
  }

  return { database, target, cutover };
}
