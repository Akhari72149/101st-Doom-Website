import { NextResponse } from "next/server";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";

const COMMAND = /^(start|stop) server ([1-5])$/;

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, "admin.server-control", "edit").catch(() => null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
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
