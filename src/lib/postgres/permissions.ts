import "server-only";
import { pagePermissionDefinitions, type PagePermissionAccess } from "@/data/pagePermissions";
import { getNativeSession } from "./auth";
import { getPostgresPool } from "./pool";

const levels: Record<PagePermissionAccess, number> = { none: 0, read: 1, edit: 2, full: 3 };

export async function requireNativePermission(request: Request, permission: string, required: Exclude<PagePermissionAccess, "none">) {
  if (!pagePermissionDefinitions.some((entry) => entry.key === permission)) throw new Error("Unknown page permission");
  const session = await getNativeSession(request.headers);
  if (!session) return null;
  const result = await getPostgresPool().query<{ access_level: PagePermissionAccess }>(
    "select access_level from public.user_page_permissions where user_id = $1 and permission_key = $2",
    [session.user.id, permission],
  );
  const access = result.rows[0]?.access_level;
  return access && (levels[access] ?? 0) >= levels[required] ? session : null;
}
