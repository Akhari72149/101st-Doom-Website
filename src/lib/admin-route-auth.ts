import { supabaseAdmin } from "@/lib/supabase-admin";
import { getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool } from "@/lib/postgres/pool";

export type AdminRouteAuthResult = {
  userId: string | null;
  email: string | null;
  roles: string[];
};

export async function getAdminRouteAuth(request: Request): Promise<AdminRouteAuthResult> {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers).catch(() => null);
    if (!session) return { userId: null, email: null, roles: [] };
    const roleData = await getPostgresPool().query<{ role: string }>(
      "select role from public.user_roles where user_id = $1",
      [session.user.id],
    );
    return {
      userId: session.user.id,
      email: session.user.email || null,
      roles: roleData.rows.map((row) => String(row.role).toLowerCase()),
    };
  }

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { userId: null, email: null, roles: [] };
  }

  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const userId = userData.user?.id || null;

  if (!userId) {
    return { userId: null, email: null, roles: [] };
  }

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return {
    userId,
    email: userData.user?.email || null,
    roles: (roleData || []).map((row) => String(row.role).toLowerCase()),
  };
}

export function hasAnyAdminRole(roles: string[], allowedRoles: string[]) {
  const allowed = new Set(allowedRoles.map((role) => role.toLowerCase()));
  return roles.some((role) => allowed.has(role.toLowerCase()));
}
