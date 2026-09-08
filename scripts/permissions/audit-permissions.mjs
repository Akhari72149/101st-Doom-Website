import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const root = process.cwd();
const definitionsSource = await fs.readFile(path.join(root, "src/data/pagePermissions.ts"), "utf8");
const permissionKeys = [...definitionsSource.matchAll(/key:\s*"([^"]+)"/g)].map((match) => match[1]);
const pagePaths = [...definitionsSource.matchAll(/pagePath:\s*"([^"]+)"/g)].map((match) => match[1]);
const clientPermissionSource = await fs.readFile(path.join(root, "src/lib/client-auth.ts"), "utf8");
const serverPermissionSource = await fs.readFile(path.join(root, "src/lib/route-permissions.ts"), "utf8");

assert(permissionKeys.length > 0, "No page permission definitions were found");
assert.equal(new Set(permissionKeys).size, permissionKeys.length, "Permission keys must be unique");
assert.equal(new Set(pagePaths).size, pagePaths.length, "Permission page paths must be unique");
assert(
  clientPermissionSource.includes("const accessWeight = { none: 0, read: 1, edit: 2, full: 3 }"),
  "Client permission hierarchy must remain none < read < edit < full",
);
assert(
  serverPermissionSource.includes("{ none: 0, read: 1, edit: 2, full: 3 }"),
  "Server permission hierarchy must remain none < read < edit < full",
);
assert(!serverPermissionSource.includes("legacyRoles"), "Legacy roles must not bypass server page permissions");

const contracts = [
  ["src/app/api/admin/certifications/route.ts", 'requirePageAccess(req,"admin.certifications","read")', 'requirePageAccess(req,"admin.certifications","edit")'],
  ["src/app/api/admin/medals/route.ts", 'requirePageAccess(request,"admin.medals","read")', 'requirePageAccess(request,"admin.medals","edit")'],
  ["src/app/api/admin/personnel-operations/route.ts", 'requirePageAccess(request,permission,"read")', 'requirePageAccess(request,permission,"edit")'],
  ["src/app/api/admin/updater/route.ts", 'requirePageAccess(request,"admin.updater","read")', 'requirePageAccess(request,"admin.updater","full")'],
  ["src/app/api/admin/permissions/route.ts", 'requirePermissionManager(request,"admin.permissions","read")', 'requirePermissionManager(request,actionPermission,"full")'],
  ["src/app/api/attendance/route.ts", 'requirePageAccess(request,PERMISSION_KEY,"edit")'],
  ["src/app/api/audit-logs/route.ts", 'requirePageAccess(request,permission,"read")'],
  ["src/app/api/cis-logistics/route.ts", 'requirePageAccess(request,KEY,"read")', 'requirePageAccess(request,KEY,"edit")'],
  ["src/app/api/discord-announcements/route.ts", 'requirePageAccess(request,"admin.discord-announcements","read")', 'requirePageAccess(request,"admin.discord-announcements","edit")'],
  ["src/app/api/discord-announcements/[id]/route.ts", 'requirePageAccess(request,"admin.discord-announcements","edit")'],
  ["src/app/api/discord-announcements/send-now/route.ts", 'requirePageAccess(req,"admin.discord-announcements","edit")'],
  ["src/app/api/discord-attendance/route.ts", 'requirePageAccess(request,"admin.discord-attendance","read")', 'requirePageAccess(request,"admin.discord-attendance","edit")'],
  ["src/app/api/discord-attendance/[id]/route.ts", 'requirePageAccess(request,"admin.discord-attendance","edit")'],
  ["src/app/api/discord-attendance/emojis/route.ts", 'requirePageAccess(request,"admin.discord-attendance","read")'],
  ["src/app/api/gc-logistics/route.ts", 'requirePageAccess(request,log?"gc.asset-log":"gc.logistics","read")', 'requirePageAccess(request,"gc.logistics","edit")'],
  ["src/app/api/mod-taskboard/route.ts", 'requirePageAccess(request,KEY,"read")', 'requirePageAccess(request,KEY,"edit")', 'requirePageAccess(request,KEY,"full")'],
  ["src/app/api/planops/route.ts", 'requirePageAccess(request,KEY,"read")', 'requirePageAccess(request,KEY,"edit")'],
  ["src/app/api/randomiser/route.ts", 'requirePageAccess(request,KEY,"edit")'],
  ["src/app/api/rank-update/route.ts", 'requirePageAccess(req,"admin.positions","edit")'],
  ["src/app/api/server-control/route.ts", 'requirePageAccess(request,"admin.server-control","edit")'],
  ["src/app/api/taskboard/route.ts", 'requirePageAccess(request,KEY,"edit")'],
];

for (const [relativePath, ...expected] of contracts) {
  const source = (await fs.readFile(path.join(root, relativePath), "utf8")).replace(/\s+/g, "");
  for (const fragment of expected) {
    assert(source.includes(fragment), `${relativePath} is missing permission contract ${fragment}`);
  }
}

const bookingSource = await fs.readFile(path.join(root, "src/app/api/server-bookings/route.ts"), "utf8");
const normalizedBookingSource = bookingSource.replace(/\s+/g, "");
assert(!bookingSource.includes("legacyRoles"), "Legacy roles must not bypass server booking permissions");
assert(!bookingSource.includes("requirePageAccess"), "Server booking writes must use the shared password, not page permissions");
assert(
  normalizedBookingSource.includes("canEdit:checkBookingPassword(request).valid"),
  "Server booking writes must remain gated by the shared password",
);

if (!process.env.DATABASE_URL) {
  console.log(`PASS: ${permissionKeys.length} permission definitions and ${contracts.length} route contracts verified.`);
  process.exit(0);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const definitions = await client.query(
    "select permission_key from public.app_page_permissions order by permission_key",
  );
  const invalidLevels = await client.query(
    "select count(*)::int as count from public.user_page_permissions where access_level not in ('read','edit','full')",
  );
  const orphanAssignments = await client.query(`select count(*)::int as count
    from public.user_page_permissions assignments
    left join public.app_page_permissions definitions using (permission_key)
    where definitions.permission_key is null`);
  const databaseKeys = definitions.rows.map((row) => row.permission_key);
  assert.deepEqual(
    [...databaseKeys].sort(),
    [...permissionKeys].sort(),
    "Code and PostgreSQL permission definitions differ",
  );
  assert.equal(invalidLevels.rows[0].count, 0, "Invalid permission access levels exist");
  assert.equal(orphanAssignments.rows[0].count, 0, "Orphaned permission assignments exist");
  console.log(`PASS: ${permissionKeys.length} definitions, ${contracts.length} route contracts, and PostgreSQL assignments verified.`);
} finally {
  await client.end();
}
