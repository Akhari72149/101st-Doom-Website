import { NextResponse } from "next/server";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
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
const LEVEL_WEIGHT: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };
const PROTECTED_DELEGATION_PERMISSIONS = new Set([
  "admin.permissions",
  "admin.account-management",
  "admin.account-password-reset",
  "admin.updater",
]);
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

async function requirePermissionManager(
  request: Request,
  permission = "admin.permissions",
  required: Exclude<PagePermissionAccess, "none"> = "full",
) {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await requireNativePermission(request, permission, required).catch(() => null);
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

async function getNativeUsername(userId: string | null) {
  if (!userId) return "";
  const result = await getPostgresPool().query<{ username: string | null }>(
    "select username from public.app_auth_users where id = $1",
    [userId],
  );
  return String(result.rows[0]?.username || "").trim().toLowerCase();
}

async function hasNativeCapability(
  request: Request,
  permission: string,
  required: Exclude<PagePermissionAccess, "none"> = "full",
) {
  return Boolean(await requireNativePermission(request, permission, required).catch(() => null));
}

function normalizeUsername(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function isValidUsername(username: string) {
  return /^[a-z0-9_.-]{2,40}$/.test(username);
}

function sealAccountCredentials(value: Record<string, string>) {
  const secret = process.env.WEBSITE_BOT_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("WEBSITE_BOT_SECRET is not configured securely");
  const iv = randomBytes(12);
  const key = createHash("sha256").update(secret).digest();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return {
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
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
      display_username: string | null;
      created_at: Date;
      last_sign_in_at: Date | null;
      disabled: boolean;
      must_change_password: boolean;
    }>(`select id, name, username, "displayUsername" as display_username,
            "createdAt" as created_at, "lastSignInAt" as last_sign_in_at, disabled,
            "mustChangePassword" as must_change_password
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
    username: user.display_username || user.username || "",
    protected: String(user.username || "").trim().toLowerCase() === "akhari",
    mustChangePassword: user.must_change_password,
    createdAt: user.created_at,
    lastSignInAt: user.last_sign_in_at,
    disabled: user.disabled,
    roles: rolesByUser.get(user.id) || [],
    permissions: permissionsByUser.get(user.id) || {},
  }));
}

export async function POST(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const { auth, allowed } = await requirePermissionManager(
    request,
    "admin.account-management",
    "full",
  );
  if (!allowed || !auth.userId) return jsonError("Unauthorized", 401);
  if (process.env.NATIVE_AUTH_ENABLED !== "true") {
    return jsonError("Account creation is available with native authentication only", 409);
  }

  const body = await request.json().catch(() => null) as {
    username?: unknown;
    discordId?: unknown;
  } | null;
  const displayName = String(body?.username || "").trim();
  const username = normalizeUsername(displayName);
  const discordId = String(body?.discordId || "").trim();
  if (!isValidUsername(username)) {
    return jsonError("Username must use 2-40 letters, numbers, hyphens, underscores, or dots");
  }
  if (username === "akhari") return jsonError("The protected super-user account is managed separately", 409);
  if (!/^\d{17,20}$/.test(discordId)) return jsonError("Discord ID must be 17-20 digits");

  const userId = randomUUID();
  const temporaryPassword = randomBytes(18).toString("base64url");
  const passwordHash = await hashPassword(temporaryPassword);
  let sealed: ReturnType<typeof sealAccountCredentials>;
  try {
    const loginUrl = new URL("/login", process.env.APP_ORIGIN || request.url).toString();
    sealed = sealAccountCredentials({ username: displayName, temporaryPassword, loginUrl });
  } catch (error) {
    console.error("[permissions] Credential delivery configuration failed", error);
    return jsonError("Discord credential delivery is not configured", 500);
  }

  try {
    await withPostgresTransaction(async (client) => {
      const email = `${username}@accounts.101stdoombattalion.invalid`;
      await client.query(
        `insert into public.app_auth_users
          (id,name,email,"emailVerified","createdAt","updatedAt",username,
           "displayUsername",disabled,"mustChangePassword")
         values ($1,$2,$3,true,now(),now(),$4,$2,false,true)`,
        [userId, displayName, email, username],
      );
      await client.query(
        `insert into public.app_auth_accounts
          (id,"userId","accountId","providerId",issuer,password,"createdAt","updatedAt")
         values ($1,$2::uuid,$2::text,'credential','local:credential',$3,now(),now())`,
        [randomUUID(), userId, passwordHash],
      );
      await client.query(
        "select public.enqueue_account_credentials_dm($1::jsonb)",
        [JSON.stringify({ discordId, sealed })],
      );
    });
    return NextResponse.json({
      success: true,
      account: { id: userId, username: displayName, discordId },
      deliveryQueued: true,
    }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return jsonError("That username already exists", 409);
    }
    console.error("[permissions] Account creation failed", error);
    return jsonError("Unable to create account", 500);
  }
}

export async function GET(request: Request) {
  const { auth, allowed } = await requirePermissionManager(request, "admin.permissions", "read");

  if (!allowed) {
    return jsonError("Unauthorized", 401);
  }

  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const [canManagePermissions, canManageAccounts, canResetPasswords, username] = await Promise.all([
      hasNativeCapability(request, "admin.permissions"),
      hasNativeCapability(request, "admin.account-management"),
      hasNativeCapability(request, "admin.account-password-reset"),
      getNativeUsername(auth.userId),
    ]);
    return NextResponse.json({
      accounts: await getNativeAccounts(),
      currentUserId: auth.userId,
      permissionDefinitions: pagePermissionDefinitions,
      levels: pagePermissionLevels,
      capabilities: {
        canManagePermissions,
        canManageAccounts,
        canResetPasswords,
        isSuperUser: username === "akhari",
      },
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
    protected: [
      user.user_metadata?.username,
      user.user_metadata?.display_name,
      user.email?.split("@")[0],
    ].some((value) => String(value || "").trim().toLowerCase() === "akhari"),
  }));

  return NextResponse.json({
    accounts,
    currentUserId: auth.userId,
    permissionDefinitions: pagePermissionDefinitions,
    levels: pagePermissionLevels,
  });
}

export async function PATCH(request: Request) {
  if (!hasValidOrigin(request)) return jsonError("Invalid request origin", 403);
  const body = (await request.json().catch(() => null)) as {
    action?: string;
    userId?: string;
    username?: unknown;
    permissions?: Array<{ permissionKey?: string; accessLevel?: string | null }>;
  } | null;

  const action = String(body?.action || "").trim();
  const userId = cleanUuid(body?.userId);
  const actionPermission = action === "permissions"
    ? "admin.permissions"
    : action === "reset-password"
      ? "admin.account-password-reset"
      : "admin.account-management";
  const { auth, allowed } = await requirePermissionManager(request, actionPermission, "full");

  if (!allowed || !auth.userId) {
    return jsonError("Unauthorized", 401);
  }

  if (!userId) {
    return jsonError("Invalid user id");
  }

  let protectedAccount = false;
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const target = await getPostgresPool().query<{ username: string | null }>(
      "select username from public.app_auth_users where id = $1",
      [userId],
    );
    protectedAccount = String(target.rows[0]?.username || "").trim().toLowerCase() === "akhari";
  } else {
    const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
    protectedAccount = [
      data.user?.user_metadata?.username,
      data.user?.user_metadata?.display_name,
      data.user?.email?.split("@")[0],
    ].some((value) => String(value || "").trim().toLowerCase() === "akhari");
  }

  if (protectedAccount && userId !== auth.userId) {
    return jsonError("Only the Akhari super user can modify this account", 403);
  }

  if (userId === auth.userId && (action === "disable" || action === "delete")) {
    return jsonError("You cannot disable or delete your own account", 409);
  }

  if (action === "update-username") {
    if (process.env.NATIVE_AUTH_ENABLED !== "true") {
      return jsonError("Username updates are available with native authentication only", 409);
    }
    const displayUsername = String(body?.username || "").trim();
    const username = normalizeUsername(displayUsername);
    if (!isValidUsername(username)) {
      return jsonError("Username must use 2-40 letters, numbers, hyphens, underscores, or dots");
    }
    if (protectedAccount && username !== "akhari") {
      return jsonError("The protected Akhari username cannot be changed", 409);
    }
    if (!protectedAccount && username === "akhari") {
      return jsonError("The protected Akhari username is reserved", 409);
    }
    try {
      const result = await getPostgresPool().query(
        `update public.app_auth_users
         set username = $2,
             "displayUsername" = $3,
             name = $3,
             "updatedAt" = now()
         where id = $1
         returning id`,
        [userId, username, displayUsername],
      );
      if (!result.rowCount) return jsonError("Account not found", 404);
      return NextResponse.json({ success: true, username: displayUsername });
    } catch (error) {
      if ((error as { code?: string }).code === "23505") {
        return jsonError("That username already exists", 409);
      }
      console.error("[permissions] Username update failed", error);
      return jsonError("Unable to update username", 500);
    }
  }

  if (action === "reset-password") {
    if (process.env.NATIVE_AUTH_ENABLED !== "true") {
      return jsonError("Password reset is available with native authentication only", 409);
    }
    const temporaryPassword = randomBytes(18).toString("base64url");
    const passwordHash = await hashPassword(temporaryPassword);
    const reset = await withPostgresTransaction(async (client) => {
      const account = await client.query<{ username: string }>(
        `update public.app_auth_accounts accounts
         set password = $2, "updatedAt" = now()
         from public.app_auth_users users
         where accounts."userId" = users.id
           and accounts."providerId" = 'credential'
           and users.id = $1
         returning coalesce(users."displayUsername", users.username) as username`,
        [userId, passwordHash],
      );
      if (!account.rowCount) return null;
      await client.query(
        `update public.app_auth_users
         set "mustChangePassword" = true, "updatedAt" = now()
         where id = $1`,
        [userId],
      );
      await client.query(`delete from public.app_auth_sessions where "userId" = $1`, [userId]);
      return account.rows[0];
    });
    if (!reset) return jsonError("Account not found", 404);
    return NextResponse.json({
      success: true,
      username: reset.username,
      temporaryPassword,
    }, { headers: { "Cache-Control": "no-store" } });
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
      try {
        await withPostgresTransaction(async (client) => {
        const callerUsername = await getNativeUsername(auth.userId);
        const isSuperUser = callerUsername === "akhari";
        if (!isSuperUser && userId === auth.userId) {
          throw new Error("You cannot change your own permissions");
        }
        const [callerRows, targetRows] = await Promise.all([
          client.query<UserPermissionRow>(
            "select user_id, permission_key, access_level from public.user_page_permissions where user_id = $1",
            [auth.userId],
          ),
          client.query<UserPermissionRow>(
            "select user_id, permission_key, access_level from public.user_page_permissions where user_id = $1",
            [userId],
          ),
        ]);
        const callerLevels = new Map(callerRows.rows.map((row) => [row.permission_key, row.access_level as PagePermissionAccess]));
        const targetLevels = new Map(targetRows.rows.map((row) => [row.permission_key, row.access_level as PagePermissionAccess]));

        for (const permission of permissions) {
          const permissionKey = String(permission.permissionKey || "").trim();
          const accessLevel = permission.accessLevel
            ? (String(permission.accessLevel).trim() as PagePermissionAccess)
            : "none";
          if (!definitions.has(permissionKey)) throw new Error(`Invalid permission: ${permissionKey}`);
          const currentLevel = targetLevels.get(permissionKey) || "none";
          if (currentLevel === accessLevel) continue;
          if (!isSuperUser) {
            if (PROTECTED_DELEGATION_PERMISSIONS.has(permissionKey)) {
              throw new Error(`Only Akhari can delegate ${permissionKey}`);
            }
            const callerLevel = callerLevels.get(permissionKey) || "none";
            if (
              LEVEL_WEIGHT[callerLevel] < LEVEL_WEIGHT[currentLevel] ||
              LEVEL_WEIGHT[callerLevel] < LEVEL_WEIGHT[accessLevel]
            ) {
              throw new Error(`You cannot grant or revoke ${permissionKey} above your own access level`);
            }
          }
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
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Permission update failed";
        if (message.startsWith("Only Akhari") || message.startsWith("You cannot")) {
          return jsonError(message, 403);
        }
        console.error("[permissions] Permission update failed", error);
        return jsonError("Permission update failed", 500);
      }
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
