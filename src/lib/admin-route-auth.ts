import { supabaseAdmin } from "@/lib/supabase-admin";

export type AdminRouteAuthResult = {
  userId: string | null;
  email: string | null;
  roles: string[];
};

export async function getAdminRouteAuth(request: Request): Promise<AdminRouteAuthResult> {
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
