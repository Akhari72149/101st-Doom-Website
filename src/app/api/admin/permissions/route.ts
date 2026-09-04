import { NextResponse } from "next/server";
import {
  type PagePermissionAccess,
  pagePermissionDefinitions,
  pagePermissionLevels,
} from "@/data/pagePermissions";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";
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
  const auth = await getAdminRouteAuth(request);

  if (!auth.userId || !hasAnyAdminRole(auth.roles, ACCESS_MANAGER_ROLES)) {
    return { auth, allowed: false };
  }

  return { auth, allowed: true };
}

export async function GET(request: Request) {
  const { allowed } = await requirePermissionManager(request);

  if (!allowed) {
    return jsonError("Unauthorized", 401);
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
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "876000h",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "enable") {
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: "none",
    });

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "delete") {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId, true);

    if (error) {
      return jsonError(error.message, 500);
    }

    return NextResponse.json({ success: true });
  }

  if (action === "permissions") {
    const definitions = new Set(pagePermissionDefinitions.map((definition) => definition.key));
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];

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
