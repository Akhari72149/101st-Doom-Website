import { NextResponse } from "next/server";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const ANNOUNCEMENT_ADMIN_ROLES = ["admin", "logistics"];

function cleanUuid(value: unknown) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

async function requireAnnouncementAdmin(request: Request) {
  const { userId, roles } = await getAdminRouteAuth(request);
  return Boolean(userId && hasAnyAdminRole(roles, ANNOUNCEMENT_ADMIN_ROLES));
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
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

  const { error } = await supabaseAdmin
    .from("discord_announcements")
    .update({ active: body.active })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  if (!(await requireAnnouncementAdmin(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = await context.params;
  const id = cleanUuid(params.id);
  if (!id) {
    return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("discord_announcements")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
