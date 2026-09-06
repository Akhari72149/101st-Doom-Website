import "server-only";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

const weights: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };

export async function requirePageAccess(
  request: Request,
  permissionKey: string,
  required: Exclude<PagePermissionAccess, "none">,
) {
  const definition = pagePermissionDefinitions.find((entry) => entry.key === permissionKey);
  if (!definition) throw new Error(`Unknown page permission: ${permissionKey}`);
  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) return null;
  if (auth.roles.some((role) => definition.legacyRoles.includes(role.toLowerCase()))) return auth;

  let access: PagePermissionAccess = "none";
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const result = await getPostgresPool().query<{ access_level: PagePermissionAccess }>(
      "select access_level from public.user_page_permissions where user_id=$1 and permission_key=$2",
      [auth.userId, permissionKey],
    );
    access = result.rows[0]?.access_level || "none";
  } else {
    const { data } = await supabaseAdmin.from("user_page_permissions").select("access_level")
      .eq("user_id", auth.userId).eq("permission_key", permissionKey).maybeSingle();
    access = (data?.access_level as PagePermissionAccess) || "none";
  }
  return weights[access] >= weights[required] ? auth : null;
}

export function requestHasSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(process.env.APP_ORIGIN || request.url).origin; } catch { return false; }
}
