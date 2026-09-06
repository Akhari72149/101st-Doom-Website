import { NextResponse } from "next/server";
import {
  type PagePermissionAccess,
  pagePermissionDefinitions,
  pagePermissionLevels,
} from "@/data/pagePermissions";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";
import { requireNativePermission } from "@/lib/postgres/permissions";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ACCESS_MANAGER_ROLES = ["admin", "akhari"];
const VALID_LEVELS = new Set<PagePermissionAccess>(
  pagePermissionLevels.filter((level) => level !== "none"),
);

type UserRoleRow = {
  user_id: string;
  role: string;
};

type ProfileRow = {
  id: string;
  display_name: string | null;
};

type UserPermissionRow = {
  user_id: string;
  permission_key: string;
  access_level: string;
};

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function cleanUuid(value: unknown) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

async function requirePermissionManager(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await requireNativePermission(request, "admin.permissions", "full").catch(() => null);
    return {
      auth: {
        userId: session?.user.id || null,
        email: session?.user.email || null,
        roles: [] as string[],
      },
      allowed: Boolean(session),
    };
  }
  const auth = await getAdminRouteAuth(request);

  if (!auth.userId || !hasAnyAdminRole(auth.roles, ACCESS_MANAGER_ROLES)) {
    return { auth, allowed: false };
  }

  return { auth, allowed: true };
}

function hasValidOrigin(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED !== "true") return true;
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(process.env.APP_ORIGIN || request.url).origin;
  } catch {
    return false;
  }
}

async function getNativeAccounts() {
  const pool = getPostgresPool();
  const [users, roles, profiles, permissions] = await Promise.all([
    pool.query<{
      id: string;
      name: string;
      username: string | null;
      created_at: Date;
      disabled: boolean;
    }>(`select id, name, username, "createdAt" as created_at, disabled
          from public.app_auth_users order by lower(coalesce(name, username))`),
    pool.query<UserRoleRow>("select user_id, role from public.user_roles"),
    pool.query<ProfileRow>("select id, display_name from public.profiles"),
    pool.query<UserPermissionRow>(
      "select user_id, permission_key, access_level from public.user_page_permissions",
    ),
  ]);

  const rolesByUser = new Map<string, string[]>();
  for (const row of roles.rows) {
    const entries = rolesByUser.get(row.user_id) || [];
    entries.push(row.role);
    rolesByUser.set(row.user_id, entries);
  }
  const profilesByUser = new Map(profiles.rows.map((profile) => [profile.id, profile]));
  const permissionsByUser = new Map<string, Record<string, string>>();
  for (const row of permissions.rows) {
    const entries = permissionsByUser.get(row.user_id) || {};
    entries[row.permission_key] = row.access_level;
    permissionsByUser.set(row.user_id, entries);
  }

  return users.rows.map((user) => ({
    id: user.id,
    displayName: profilesByUser.get(user.id)?.display_name || user.name || user.username || "",
    username: user.username || "",
    createdAt: user.created_at,
    lastSignInAt: null,
    disabled: user.disabled,
    roles: rolesByUser.get(user.id) || [],
    permissions: permissionsByUser.get(user.id) || {},
  }));
}

export async function GET(request: Request) {
  const { allowed } = await requirePermissionManager(request);

  if (!allowed) {
    return jsonError("Unauthorized", 401);
  }

  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    return NextResponse.json({
      accounts: await getNativeAccounts(),
      permissionDefinitions: pagePermissionDefinitions,
      levels: pagePermissionLevels,
    });
  }

  const [{ data: userData, error: usersError }, { data: roles }, { data: profiles }, { data: permissions }] =
    await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      supabaseAdmin.from("user_roles").select("user_id,role").returns<UserRoleRow[]>(),
      supabaseAdmin.from("profiles").select("id,display_name").returns<ProfileRow[]>(),
      supabaseAdmin
        .from("user_page_permissions")
        .select("user_id,permission_key,access_level")
        .returns<UserPermissionRow[]>(),
    ]);

  if (usersError) {
    return jsonError(usersError.message, 500);
  }

  const rolesByUser = new Map<string, string[]>();
  for (const row of roles || []) {
    const entries = rolesByUser.get(row.user_id) || [];
    entries.push(row.role);
    rolesByUser.set(row.user_id, entries);
  }

  const profilesByUser = new Map((profiles || []).map((profile) => [profile.id, profile]));

  const permissionsByUser = new Map<string, Record<string, string>>();
  for (const row of permissions || []) {
    const entries = permissionsByUser.get(row.user_id) || {};
    entries[row.permission_key] = row.access_level;
    permissionsByUser.set(row.user_id, entries);
  }

  const accounts = (userData.users || []).map((user) => ({
    id: user.id,
    email: user.email,
    displayName:
      profilesByUser.get(user.id)?.display_name ||
      String(user.user_metadata?.display_name || user.user_metadata?.full_name || ""),
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    bannedUntil: user.banned_until,
    disabled:
      Boolean(user.banned_until) &&
      user.banned_until !== "none" &&
      new Date(user.banned_until || 0).getTime() > Date.now(),
    roles: rolesByUser.get(user.id) || [],
    permissions: permissionsByUser.get(user.id) || {},
  }));

  return NextResponse.json({
    accounts,
    permissionDefinitions: pagePermissionDefinitions,
    levels: pagePermissionLevels,
  });
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const { auth, allowed } = await requirePermissionManager(request);

  if (!allowed) {
    return jsonError("Unauthorized", 401);
  }

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    userId?: string;
    permissions?: Array<{ permissionKey?: string; accessLevel?: string | null }>;
  } | null;

  const action = String(body?.action || "").trim();
  const userId = cleanUuid(body?.userId);

  if (!userId) {
    return jsonError("Invalid user id");
  }

  if (userId === auth.userId && (action === "disable" || action === "delete")) {
    return jsonError("You cannot disable or delete your own account", 409);
  }

  if (action === "disable") {
    if (process.env.NATIVE_AUTH_ENABLED === "true") {
      const result = await getPostgresPool().query(
        "update public.app_auth_users set disabled = true, \"updatedAt\" = now() where id = $1 returning id",
        [userId],
      );
      if (!result.rowCount) return jsonError("Account not found", 404);
      return NextResponse.json({ success: true });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "enable") {
    if (process.env.NATIVE_AUTH_ENABLED === "true") {
      const result = await getPostgresPool().query(
        "update public.app_auth_users set disabled = false, \"updatedAt\" = now() where id = $1 returning id",
        [userId],
      );
      if (!result.rowCount) return jsonError("Account not found", 404);
      return NextResponse.json({ success: true });
    }
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    if (process.env.NATIVE_AUTH_ENABLED === "true") {
      const deleted = await withPostgresTransaction(async (client) => {
        const result = await client.query(
          "delete from public.app_auth_users where id = $1 returning id",
          [userId],
        );
        if (!result.rowCount) return false;
        await client.query("delete from public.user_page_permissions where user_id = $1", [userId]);
        await client.query("delete from public.user_roles where user_id = $1", [userId]);
        return true;
      });
      if (!deleted) return jsonError("Account not found", 404);
      return NextResponse.json({ success: true });
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "permissions") {
    const definitions = new Set(pagePermissionDefinitions.map((definition) => definition.key));
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];

    if (process.env.NATIVE_AUTH_ENABLED === "true") {
      await withPostgresTransaction(async (client) => {
        for (const permission of permissions) {
          const permissionKey = String(permission.permissionKey || "").trim();
          const accessLevel = permission.accessLevel
            ? (String(permission.accessLevel).trim() as PagePermissionAccess)
            : "none";
          if (!definitions.has(permissionKey)) throw new Error(`Invalid permission: ${permissionKey}`);
          if (accessLevel === "none") {
            await client.query(
              "delete from public.user_page_permissions where user_id = $1 and permission_key = $2",
              [userId, permissionKey],
            );
          } else {
            if (!VALID_LEVELS.has(accessLevel)) throw new Error(`Invalid permission level: ${accessLevel}`);
            await client.query(
              `insert into public.user_page_permissions
                 (user_id, permission_key, access_level, granted_by, updated_at)
               values ($1, $2, $3, $4, now())
               on conflict (user_id, permission_key) do update
               set access_level = excluded.access_level,
                   granted_by = excluded.granted_by,
                   updated_at = now()`,
              [userId, permissionKey, accessLevel, auth.userId],
            );
          }
        }
      });
      return NextResponse.json({ success: true });
    }

    for (const permission of permissions) {
      const permissionKey = String(permission.permissionKey || "").trim();
      const accessLevel = permission.accessLevel
        ? (String(permission.accessLevel).trim() as PagePermissionAccess)
        : "none";

      if (!definitions.has(permissionKey)) {
        return jsonError(`Invalid permission: ${permissionKey}`);
      }

      if (!accessLevel || accessLevel === "none") {
        const { error } = await supabaseAdmin
          .from("user_page_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("permission_key", permissionKey);

        if (error) {
          return jsonError(error.message, 500);
        }

        continue;
      }

      if (!VALID_LEVELS.has(accessLevel)) {
        return jsonError(`Invalid permission level: ${accessLevel}`);
      }

      const { error } = await supabaseAdmin.from("user_page_permissions").upsert({
        user_id: userId,
        permission_key: permissionKey,
        access_level: accessLevel,
        granted_by: auth.userId,
        updated_at: new Date().toISOString(),
      });

      if (error) {
        return jsonError(error.message, 500);
      }
    }

    return NextResponse.json({ success: true });
  }

  return jsonError("Invalid action");
}
