const backendSwitches = [
  'SERVER_BOOKINGS_BACKEND',
  'ROSTER_DATABASE_BACKEND',
  'PERSONNEL_DATABASE_BACKEND',
  'ARMA_DATABASE_BACKEND',
  'ORBAT_DATABASE_BACKEND',
  'HOME_DATABASE_BACKEND',
  'ATTENDANCE_DATABASE_BACKEND',
  'AUDIT_DATABASE_BACKEND',
  'LOOKUP_DATABASE_BACKEND',
  'TASKBOARD_DATABASE_BACKEND',
  'ADMIN_PERSONNEL_DATABASE_BACKEND',
  'MOD_TASKBOARD_DATABASE_BACKEND',
  'RANDOMISER_DATABASE_BACKEND',
  'LOGISTICS_DATABASE_BACKEND',
  'PLANOPS_DATABASE_BACKEND',
  'DISCORD_DATABASE_BACKEND',
];

const errors = [];
for (const name of backendSwitches) {
  if (process.env[name] !== 'postgres') errors.push(`${name} must be postgres`);
}
if (process.env.NATIVE_AUTH_ENABLED !== 'true') errors.push('NATIVE_AUTH_ENABLED must be true');
if (process.env.NEXT_PUBLIC_AUTH_BACKEND !== 'native') errors.push('NEXT_PUBLIC_AUTH_BACKEND must be native');

let databaseUrl;
try {
  databaseUrl = new URL(process.env.DATABASE_URL || '');
} catch {
  errors.push('DATABASE_URL must be a valid PostgreSQL URL');
}
if (databaseUrl) {
  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) errors.push('DATABASE_URL must use PostgreSQL');
  if (decodeURIComponent(databaseUrl.username) !== 'roster_app_runtime') {
    errors.push('DATABASE_URL must use the restricted roster_app_runtime role');
  }
  if (['postgres', 'template0', 'template1'].includes(decodeURIComponent(databaseUrl.pathname.slice(1)))) {
    errors.push('DATABASE_URL must not use a maintenance or template database');
  }
}

for (const name of ['NATIVE_AUTH_SECRET', 'WEBSITE_BOT_SECRET']) {
  if ((process.env[name] || '').length < 32) errors.push(`${name} must be at least 32 characters`);
}
try {
  const origin = new URL(process.env.APP_ORIGIN || '');
  if (origin.protocol !== 'https:' || origin.origin !== process.env.APP_ORIGIN) {
    errors.push('APP_ORIGIN must be the exact production HTTPS origin');
  }
} catch {
  errors.push('APP_ORIGIN must be a valid production HTTPS origin');
}

if (errors.length) {
  console.error('Native deployment configuration is not ready:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: native deployment configuration is complete (${backendSwitches.length} PostgreSQL backends checked).`);
  console.log('No secret values or connection string were displayed.');
}
