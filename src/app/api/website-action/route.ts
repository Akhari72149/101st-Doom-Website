import { NextResponse } from "next/server";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getPostgresPool } from "@/lib/postgres/pool";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: Request) {
  if (!requestHasSameOrigin(req)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(req, "admin.certifications", "edit").catch(() => null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    console.log("[website-action] API route hit");

    const body = await req.json() as Record<string, unknown>;

    const allowedActions = new Set(["CERTIFICATION_ASSIGNED", "CERTIFICATION_REVOKED"]);
    if (!allowedActions.has(String(body?.action || ""))) {
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
    }

    const botUrl = process.env.WEBSITE_BOT_ACTION_URL;
    const secret = process.env.WEBSITE_BOT_SECRET;

    console.log("[website-action] Bot URL:", botUrl ? botUrl : "MISSING");
    console.log("[website-action] Secret exists:", secret ? "YES" : "NO");

    if (!botUrl || !secret) {
      return NextResponse.json(
        {
          error: "Missing WEBSITE_BOT_ACTION_URL or WEBSITE_BOT_SECRET",
        },
        { status: 500 }
      );
    }

    const personnelId = String(body.target_personnel_id || body.personnel_id || body.personnelId || body.targetPersonnelId || "");
    let personnel: { name: string | null; discord_id: string | null } | null = null;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(personnelId)) {
      if ((process.env.PERSONNEL_DATABASE_BACKEND || "supabase") === "postgres") {
        const result = await getPostgresPool().query<{name:string|null;discord_id:string|null}>("select name,discord_id from public.personnel where id=$1", [personnelId]);
        personnel = result.rows[0] || null;
      } else {
        const result = await supabaseAdmin.from("personnel").select("name,discord_id").eq("id",personnelId).maybeSingle<{name:string|null;discord_id:string|null}>();
        personnel = result.data || null;
      }
    }
    const forwardedBody = {
      ...body,
      personnelName: personnel?.name || body.personnelName,
      personnelDiscordId: personnel?.discord_id || null,
    };

    const response = await fetch(botUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(forwardedBody),
    });

    const text = await response.text();

    console.log("[website-action] Bot response status:", response.status);
    console.log("[website-action] Bot response body:", text);

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error: unknown) {
    console.error("[website-action] API error:", error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
