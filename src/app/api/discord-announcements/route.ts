import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";

const VALID_REPEAT_TYPES = ["none", "daily", "weekly", "monthly", "custom"] as const;
const DISCORD_MESSAGE_LIMIT = 2000;
const ANNOUNCEMENT_ADMIN_ROLES = ["admin", "logistics"];

function isValidRepeatType(value: string): value is (typeof VALID_REPEAT_TYPES)[number] {
  return VALID_REPEAT_TYPES.some((repeatType) => repeatType === value);
}

export async function POST(req: Request) {
  const { userId, roles } = await getAdminRouteAuth(req);

  if (!userId || !hasAnyAdminRole(roles, ANNOUNCEMENT_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const scheduledFor = String(body.scheduled_for || "");
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = String(body.repeat_type || "none");
  const repeatIntervalMinutes =
    body.repeat_interval_minutes == null ? null : Number(body.repeat_interval_minutes);
  const pingRole = Boolean(body.ping_role);

  const roleId = process.env.DISCORD_ANNOUNCEMENT_ROLE_ID || null;

  if (!title || !message || !channelId || !scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidRepeatType(repeatType)) {
    return NextResponse.json({ error: "Invalid repeat type" }, { status: 400 });
  }

  const allowedChannel = discordAnnouncementChannels.find((c) => c.id === channelId);

  if (!allowedChannel) {
    return NextResponse.json({ error: "Invalid channel selected" }, { status: 400 });
  }

  const preview =
    pingRole && roleId ? `<@&${roleId}> ${message}` : message;

  if (preview.length > DISCORD_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: `Message exceeds ${DISCORD_MESSAGE_LIMIT} characters` },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduledFor);

  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Scheduled time must be a valid future date" },
      { status: 400 }
    );
  }

  if (repeatEnabled && repeatType === "custom") {
    if (!repeatIntervalMinutes || repeatIntervalMinutes <= 0) {
      return NextResponse.json(
        { error: "Custom repeat interval must be greater than 0" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin.from("discord_announcements").insert({
    title,
    message,
    channel_id: channelId,
    channel_name: allowedChannel.name,
    scheduled_for: scheduledDate.toISOString(),
    repeat_enabled: repeatEnabled,
    repeat_type: repeatEnabled ? repeatType : "none",
    repeat_interval_minutes:
      repeatEnabled && repeatType === "custom" ? repeatIntervalMinutes : null,
    ping_role: pingRole,
    ping_role_id: pingRole ? roleId : null,
    active: true,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const { userId, roles } = await getAdminRouteAuth(req);

  if (!userId || !hasAnyAdminRole(roles, ANNOUNCEMENT_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const id = String(body.id || "").trim();
  if (!id) {
    return NextResponse.json({ error: "Missing announcement id" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const scheduledFor = String(body.scheduled_for || "");
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = String(body.repeat_type || "none");
  const repeatIntervalMinutes =
    body.repeat_interval_minutes == null ? null : Number(body.repeat_interval_minutes);
  const pingRole = Boolean(body.ping_role);

  const roleId = process.env.DISCORD_ANNOUNCEMENT_ROLE_ID || null;

  if (!title || !message || !channelId || !scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!isValidRepeatType(repeatType)) {
    return NextResponse.json({ error: "Invalid repeat type" }, { status: 400 });
  }

  const allowedChannel = discordAnnouncementChannels.find((c) => c.id === channelId);

  if (!allowedChannel) {
    return NextResponse.json({ error: "Invalid channel selected" }, { status: 400 });
  }

  const preview =
    pingRole && roleId ? `<@&${roleId}> ${message}` : message;

  if (preview.length > DISCORD_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: `Message exceeds ${DISCORD_MESSAGE_LIMIT} characters` },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduledFor);

  if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Scheduled time must be a valid future date" },
      { status: 400 }
    );
  }

  if (repeatEnabled && repeatType === "custom") {
    if (!repeatIntervalMinutes || repeatIntervalMinutes <= 0) {
      return NextResponse.json(
        { error: "Custom repeat interval must be greater than 0" },
        { status: 400 }
      );
    }
  }

  const { error } = await supabaseAdmin
    .from("discord_announcements")
    .update({
      title,
      message,
      channel_id: channelId,
      channel_name: allowedChannel.name,
      scheduled_for: scheduledDate.toISOString(),
      repeat_enabled: repeatEnabled,
      repeat_type: repeatEnabled ? repeatType : "none",
      repeat_interval_minutes:
        repeatEnabled && repeatType === "custom" ? repeatIntervalMinutes : null,
      ping_role: pingRole,
      ping_role_id: pingRole ? roleId : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
