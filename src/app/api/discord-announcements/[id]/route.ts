import { NextResponse } from "next/server";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getDiscordDatabaseBackend } from "@/lib/discord-database";
import { getPostgresPool } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanUuid(value: unknown) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

async function requireAnnouncementAdmin(request: Request) {
  return requirePageAccess(request, "admin.discord-announcements", "edit");
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requireAnnouncementAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = cleanUuid(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  }

  const body = await request.json();
  if (typeof body.active !== "boolean") {
    return NextResponse.json({ error: "Missing active state" }, { status: 400 });
  }

  try {
    if (getDiscordDatabaseBackend() === "postgres") {
      const result = await getPostgresPool().query("update public.discord_announcements set active=$2 where id=$1", [id, body.active]);
      if (!result.rowCount) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    } else {
      const result = await supabaseAdmin.from("discord_announcements").update({ active: body.active }).eq("id", id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[discord-announcements] Active-state update failed", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requireAnnouncementAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = cleanUuid(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  }

  try {
    if (getDiscordDatabaseBackend() === "postgres") {
      const result = await getPostgresPool().query("delete from public.discord_announcements where id=$1", [id]);
      if (!result.rowCount) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    } else {
      const result = await supabaseAdmin.from("discord_announcements").delete().eq("id", id).select("id").maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[discord-announcements] Delete failed", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
