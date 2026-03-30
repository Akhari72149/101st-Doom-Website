import { NextResponse } from "next/server";
import { requireDiscordAnnouncementAccess } from "@/lib/require-discord-announcement-access";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_REPEAT_TYPES = ["none", "daily", "weekly", "monthly", "custom"] as const;
const DISCORD_MESSAGE_LIMIT = 2000;

export async function POST(req: Request) {
  const auth = await requireDiscordAnnouncementAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const channelName = body.channel_name ? String(body.channel_name) : null;
  const scheduledFor = String(body.scheduled_for || "");
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = String(body.repeat_type || "none");
  const repeatIntervalMinutes =
    body.repeat_interval_minutes == null ? null : Number(body.repeat_interval_minutes);
  const pingRole = Boolean(body.ping_role);
  const pingRoleId = body.ping_role_id ? String(body.ping_role_id) : null;

  if (!title || !message || !channelId || !scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REPEAT_TYPES.includes(repeatType as any)) {
    return NextResponse.json({ error: "Invalid repeat type" }, { status: 400 });
  }

  const preview = pingRole && pingRoleId ? `<@&${pingRoleId}> ${message}` : message;
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
    channel_name: channelName,
    scheduled_for: scheduledDate.toISOString(),
    repeat_enabled: repeatEnabled,
    repeat_type: repeatEnabled ? repeatType : "none",
    repeat_interval_minutes:
      repeatEnabled && repeatType === "custom" ? repeatIntervalMinutes : null,
    ping_role: pingRole,
    ping_role_id: pingRole ? pingRoleId : null,
    active: true,
    created_by: auth.user.id,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function PUT(req: Request) {
  const auth = await requireDiscordAnnouncementAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const id = String(body.id || "").trim();

  if (!id) {
    return NextResponse.json({ error: "Missing announcement id" }, { status: 400 });
  }

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const channelName = body.channel_name ? String(body.channel_name) : null;
  const scheduledFor = String(body.scheduled_for || "");
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = String(body.repeat_type || "none");
  const repeatIntervalMinutes =
    body.repeat_interval_minutes == null ? null : Number(body.repeat_interval_minutes);
  const pingRole = Boolean(body.ping_role);
  const pingRoleId = body.ping_role_id ? String(body.ping_role_id) : null;

  if (!title || !message || !channelId || !scheduledFor) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!VALID_REPEAT_TYPES.includes(repeatType as any)) {
    return NextResponse.json({ error: "Invalid repeat type" }, { status: 400 });
  }

  const preview = pingRole && pingRoleId ? `<@&${pingRoleId}> ${message}` : message;
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
      channel_name: channelName,
      scheduled_for: scheduledDate.toISOString(),
      repeat_enabled: repeatEnabled,
      repeat_type: repeatEnabled ? repeatType : "none",
      repeat_interval_minutes:
        repeatEnabled && repeatType === "custom" ? repeatIntervalMinutes : null,
      ping_role: pingRole,
      ping_role_id: pingRole ? pingRoleId : null,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}