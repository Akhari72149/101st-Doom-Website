import { NextResponse } from "next/server";
import { getNativeAuth, getNativeSession } from "@/lib/postgres/auth";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED !== "true") {
    return NextResponse.json({ error: "Native authentication is unavailable" }, { status: 404 });
  }
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const session = await getNativeSession(request.headers, { allowPasswordChangeRequired: true });
  if (!session) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    currentPassword?: unknown;
    newPassword?: unknown;
  } | null;
  const currentPassword = String(body?.currentPassword || "");
  const newPassword = String(body?.newPassword || "");

  if (newPassword.length < 12 || newPassword.length > 128) {
    return NextResponse.json({ error: "The new password must be between 12 and 128 characters" }, { status: 400 });
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "Choose a password different from the temporary password" }, { status: 400 });
  }

  try {
    await getNativeAuth().api.changePassword({
      headers: request.headers,
      body: { currentPassword, newPassword, revokeOtherSessions: true },
    });
  } catch {
    return NextResponse.json({ error: "The current password was not accepted" }, { status: 400 });
  }

  try {
    await getPostgresPool().query(
      `update public.app_auth_users
       set "mustChangePassword" = false, "updatedAt" = now()
       where id = $1`,
      [session.user.id],
    );
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[account] Password changed but first-login flag could not be cleared", error);
    return NextResponse.json({ error: "Password changed, but account activation could not be completed" }, { status: 500 });
  }
}
