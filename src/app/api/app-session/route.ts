import { NextResponse } from "next/server";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers, { allowPasswordChangeRequired: true });
    if (!session) {
      return NextResponse.json({ user: null, roles: [] }, {
        status: 401,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const nativeUser = session.user as typeof session.user & {
      username?: string | null;
      displayUsername?: string | null;
      mustChangePassword?: boolean;
    };
    const mustChangePassword = Boolean(nativeUser.mustChangePassword);
    const [roleData, permissionData] = await Promise.all([
      getPostgresPool().query<{ role: string }>(
        "select role from public.user_roles where user_id = $1",
        [nativeUser.id],
      ),
      mustChangePassword
        ? Promise.resolve({ rows: [] as Array<{ permission_key: string; access_level: "read" | "edit" | "full" }> })
        : getPostgresPool().query<{ permission_key: string; access_level: "read" | "edit" | "full" }>(
          "select permission_key, access_level from public.user_page_permissions where user_id = $1 and access_level <> 'none'",
          [nativeUser.id],
        ),
    ]);
    const username = nativeUser.username || nativeUser.displayUsername || "";

    return NextResponse.json({
      user: {
        id: nativeUser.id,
        displayName: nativeUser.name || username,
        username,
        email: nativeUser.email || null,
      },
      roles: mustChangePassword ? [] : roleData.rows.map((row) => String(row.role).toLowerCase()),
      permissions: Object.fromEntries(
        permissionData.rows.map((row) => [row.permission_key, row.access_level]),
      ),
      mode: "native",
      mustChangePassword,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ user: null, roles: [] }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const [{ data }, { data: permissionRows }] = await Promise.all([
    supabaseAdmin.from("profiles").select("display_name").eq("id", auth.userId).maybeSingle(),
    supabaseAdmin.from("user_page_permissions").select("permission_key,access_level").eq("user_id", auth.userId),
  ]);
  const displayName = data?.display_name || "";
  const permissions = Object.fromEntries(
    (permissionRows || [])
      .filter((row) => row.access_level !== "none")
      .map((row) => [row.permission_key, row.access_level as "read" | "edit" | "full"]),
  );

  return NextResponse.json({
    user: {
      id: auth.userId,
      displayName,
      username: "",
      email: auth.email,
    },
    roles: auth.roles,
    permissions,
    mode: "supabase",
    mustChangePassword: false,
  }, { headers: { "Cache-Control": "no-store" } });
}
