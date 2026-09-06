import { NextResponse } from "next/server";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";
import { requireNativePermission } from "@/lib/postgres/permissions";

export const runtime = "nodejs";

const COMMAND = /^(start|stop) server ([1-5])$/;

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(process.env.APP_ORIGIN || request.url).origin; } catch { return false; }
}

async function canControl(request: Request) {
  if (process.env.NATIVE_AUTH_ENABLED === "true") {
    if (await requireNativePermission(request, "admin.server-control", "edit").catch(() => null)) return true;
  }
  const auth = await getAdminRouteAuth(request);
  return Boolean(auth.userId && hasAnyAdminRole(auth.roles, ["servermaintenance", "akhari"]));
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await canControl(request))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { command?: unknown } | null;
  const command = String(body?.command || "").trim().toLowerCase();
  if (!COMMAND.test(command)) return NextResponse.json({ error: "Invalid server command" }, { status: 400 });

  const listenerUrl = process.env.SERVER_CONTROL_LISTENER_URL || "http://199.33.118.13:3001/server";
  try {
    const response = await fetch(listenerUrl, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }), signal: AbortSignal.timeout(10_000),
    });
    const result = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Server listener rejected the command" }, { status: 502 });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[server-control] Listener request failed", error);
    return NextResponse.json({ error: "Server listener is unavailable" }, { status: 502 });
  }
}
