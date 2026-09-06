import { NextResponse } from "next/server";
import { getAdminRouteAuth } from "@/lib/admin-route-auth";
import { getNativeSession } from "@/lib/postgres/auth";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const auth = await getAdminRouteAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ user: null, roles: [] }, {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let displayName = "";
  let username = "";
  let permissions: Record<string, "read" | "edit" | "full"> = {};
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    const session = await getNativeSession(request.headers);
    const nativeUser = session?.user as {
      name?: string | null;
      username?: string | null;
      displayUsername?: string | null;
    } | undefined;
    username = nativeUser?.username || nativeUser?.displayUsername || "";
    displayName = nativeUser?.name || username;
    const result = await getPostgresPool().query<{ permission_key: string; access_level: "read" | "edit" | "full" }>(
      "select permission_key, access_level from public.user_page_permissions where user_id = $1 and access_level <> 'none'",
      [auth.userId],
    );
    permissions = Object.fromEntries(result.rows.map((row) => [row.permission_key, row.access_level]));
  } else {
    const [{ data }, { data: permissionRows }] = await Promise.all([
      supabaseAdmin.from("profiles").select("display_name").eq("id", auth.userId).maybeSingle(),
      supabaseAdmin.from("user_page_permissions").select("permission_key,access_level").eq("user_id", auth.userId),
    ]);
    displayName = data?.display_name || "";
    permissions = Object.fromEntries(
      (permissionRows || [])
        .filter((row) => row.access_level !== "none")
        .map((row) => [row.permission_key, row.access_level as "read" | "edit" | "full"]),
    );
  }

  return NextResponse.json({
    user: {
      id: auth.userId,
      displayName,
      username,
      email: auth.email,
    },
    roles: auth.roles,
    permissions,
    mode: process.env.NATIVE_AUTH_ENABLED === "true" ? "native" : "supabase",
  }, { headers: { "Cache-Control": "no-store" } });
}
