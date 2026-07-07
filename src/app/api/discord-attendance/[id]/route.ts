import { NextResponse } from "next/server";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import {
  attendanceAssignableRoles,
  attendancePingRoles,
} from "@/data/discordAttendanceRoles";
import { refreshDiscordAttendanceMessage } from "@/lib/refreshDiscordAttendance";
import { supabaseAdmin } from "@/lib/supabase-admin";

const VALID_REPEAT_TYPES = new Set(["none", "weekly"]);
const DEFAULT_OPTIONS = [
  { emoji: "☸️", label: "Platoon" },
  { emoji: "1️⃣", label: "1-1" },
  { emoji: "2️⃣", label: "1-2" },
  { emoji: "🛡️", label: "Hammer 4" },
  { emoji: "🚪", label: "Ride Along" },
  { emoji: "❌", label: "Not Attending" },
];

type AttendanceOptionInput = {
  id: string | null;
  emoji: string;
  label: string;
  sort_order: number;
  assign_role_id: string | null;
};

const allowedPingRoleIds = new Set(attendancePingRoles.map((role) => role.id));
const allowedAssignableRoleIds = new Set(attendanceAssignableRoles.map((role) => role.id));
const allowedReminderRoleIds = allowedAssignableRoleIds;

function jsonError(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

function cleanDiscordRoleId(value: unknown) {
  const roleId = String(value || "").trim().replace(/[<@&>]/g, "");
  return /^\d{16,22}$/.test(roleId) ? roleId : "";
}

function cleanAllowedRoleId(value: unknown, allowedRoleIds: Set<string>) {
  const roleId = cleanDiscordRoleId(value);
  return roleId && allowedRoleIds.has(roleId) ? roleId : "";
}

function cleanUuid(value: unknown) {
  const id = String(value || "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : "";
}

function cleanOption(option: unknown, index: number) {
  const entry = option && typeof option === "object" ? option as Record<string, unknown> : {};
  return {
    id: cleanUuid(entry.id) || null,
    emoji: String(entry.emoji || "").trim(),
    label: String(entry.label || "").trim(),
    assign_role_id: cleanAllowedRoleId(entry.assign_role_id, allowedAssignableRoleIds) || null,
    sort_order: index,
  };
}

async function getUserAndRoles(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  if (!token) {
    return { userId: null, email: null, roles: [] as string[] };
  }

  const { data: userData } = await supabaseAdmin.auth.getUser(token);
  const userId = userData.user?.id || null;

  if (!userId) {
    return { userId: null, email: null, roles: [] as string[] };
  }

  const { data: roleData } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  return {
    userId,
    email: userData.user?.email || null,
    roles: (roleData || []).map((row) => String(row.role).toLowerCase()),
  };
}

function canManageAttendance(roles: string[]) {
  return roles.some((role) => ["admin", "nco", "akhari"].includes(role));
}

async function deleteDiscordAttendanceMessage(channelId: string | null, messageId: string | null) {
  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;

  if (!botToken || !channelId || !messageId) {
    return { attempted: false, deleted: false };
  }

  const response = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bot ${botToken}`,
      },
    },
  );

  if (response.ok || response.status === 404) {
    return { attempted: true, deleted: response.ok };
  }

  const responseText = await response.text().catch(() => "");
  throw new Error(responseText || `Discord returned HTTP ${response.status}`);
}

export async function PATCH(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const { userId, roles } = await getUserAndRoles(request);

  if (!userId || !canManageAttendance(roles)) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const eventId = String(params.id || "").trim();

  if (!eventId) {
    return jsonError("Missing attendance event id");
  }

  const { data: existingEvent, error: existingError } = await supabaseAdmin
    .from("discord_attendance_events")
    .select("id")
    .eq("id", eventId)
    .single();

  if (existingError || !existingEvent) {
    return jsonError("Attendance event not found", 404);
  }

  const body = await request.json();
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const eventStartsAt = String(body.event_starts_at || "").trim();
  const scheduledSendAt = String(body.scheduled_send_at || "").trim();
  const durationMinutes = Number(body.duration_minutes || 120);
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = repeatEnabled ? String(body.repeat_type || "weekly") : "none";
  const repeatTimezone = String(body.repeat_timezone || "Europe/London").trim();
  const footerText = String(body.footer_text || "").trim();
  const pingRoleId = cleanAllowedRoleId(body.ping_role_id, allowedPingRoleIds);
  const reminderEnabled = Boolean(body.reminder_enabled);
  const reminderScheduledAt = String(body.reminder_scheduled_at || "").trim();
  const reminderMessage = String(body.reminder_message || "").trim();
  const reminderRoleId = cleanAllowedRoleId(body.reminder_role_id, allowedReminderRoleIds);
  const optionsInput: unknown[] = Array.isArray(body.options) ? body.options : DEFAULT_OPTIONS;
  const options: AttendanceOptionInput[] = optionsInput
    .map(cleanOption)
    .filter((option): option is AttendanceOptionInput => Boolean(option.emoji && option.label));

  if (!title || !channelId || !eventStartsAt || !scheduledSendAt) {
    return jsonError("Missing required fields");
  }

  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
    return jsonError("Duration must be greater than 0");
  }

  if (!VALID_REPEAT_TYPES.has(repeatType)) {
    return jsonError("Invalid repeat type");
  }

  if (options.length < 2) {
    return jsonError("Add at least two attendance options");
  }

  if (reminderEnabled && (!reminderScheduledAt || !reminderMessage)) {
    return jsonError("Reminder time and message are required when reminders are enabled");
  }

  const channel = discordAnnouncementChannels.find((entry) => entry.id === channelId);

  if (!channel) {
    return jsonError("Invalid channel selected");
  }

  const eventDate = new Date(eventStartsAt);
  const sendDate = new Date(scheduledSendAt);
  const reminderDate = reminderScheduledAt ? new Date(reminderScheduledAt) : null;

  if (Number.isNaN(eventDate.getTime()) || Number.isNaN(sendDate.getTime())) {
    return jsonError("Invalid event or send date");
  }

  if (reminderDate && Number.isNaN(reminderDate.getTime())) {
    return jsonError("Invalid reminder date");
  }

  const { error: updateError } = await supabaseAdmin
    .from("discord_attendance_events")
    .update({
      title,
      description: description || null,
      channel_id: channelId,
      channel_name: channel.name,
      event_starts_at: eventDate.toISOString(),
      scheduled_send_at: sendDate.toISOString(),
      duration_minutes: durationMinutes,
      repeat_enabled: repeatEnabled,
      repeat_type: repeatType,
      repeat_timezone: repeatTimezone || "Europe/London",
      repeat_scheduled_send_at: repeatEnabled ? sendDate.toISOString() : null,
      footer_text: footerText || null,
      ping_role_id: pingRoleId || null,
      reminder_enabled: reminderEnabled,
      reminder_scheduled_at: reminderEnabled && reminderDate ? reminderDate.toISOString() : null,
      reminder_message: reminderEnabled ? reminderMessage : null,
      reminder_role_id: reminderEnabled && reminderRoleId ? reminderRoleId : null,
    })
    .eq("id", eventId);

  if (updateError) {
    return jsonError(updateError.message || "Failed to update attendance event", 500);
  }

  const optionIdsToKeep = options
    .map((option) => option.id)
    .filter((id): id is string => Boolean(id));

  let deleteOptionsQuery = supabaseAdmin
    .from("discord_attendance_options")
    .delete()
    .eq("event_id", eventId);

  if (optionIdsToKeep.length > 0) {
    deleteOptionsQuery = deleteOptionsQuery.not("id", "in", `(${optionIdsToKeep.join(",")})`);
  }

  const { error: deleteOptionError } = await deleteOptionsQuery;

  if (deleteOptionError) {
    return jsonError(deleteOptionError.message || "Failed to remove deleted attendance options", 500);
  }

  for (const option of options) {
    const optionPayload = {
      emoji: option.emoji,
      label: option.label,
      assign_role_id: option.assign_role_id,
      sort_order: option.sort_order,
      event_id: eventId,
    };

    if (option.id) {
      const { error: optionUpdateError } = await supabaseAdmin
        .from("discord_attendance_options")
        .update(optionPayload)
        .eq("id", option.id)
        .eq("event_id", eventId);

      if (optionUpdateError) {
        return jsonError(optionUpdateError.message || "Failed to update attendance option", 500);
      }
    } else {
      const { error: optionInsertError } = await supabaseAdmin
        .from("discord_attendance_options")
        .insert(optionPayload);

      if (optionInsertError) {
        return jsonError(optionInsertError.message || "Failed to add attendance option", 500);
      }
    }
  }

  const refreshResult = await refreshDiscordAttendanceMessage(eventId);

  return NextResponse.json({
    success: true,
    id: eventId,
    discord_message_refreshed: refreshResult.refreshed,
  });
}

export async function DELETE(
  request: Request,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  const { userId, roles } = await getUserAndRoles(request);

  if (!userId || !canManageAttendance(roles)) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const eventId = String(params.id || "").trim();

  if (!eventId) {
    return jsonError("Missing attendance event id");
  }

  const { data: existingEvent, error: existingError } = await supabaseAdmin
    .from("discord_attendance_events")
    .select("id,channel_id,discord_message_id")
    .eq("id", eventId)
    .single();

  if (existingError || !existingEvent) {
    return jsonError("Attendance event not found", 404);
  }

  try {
    await deleteDiscordAttendanceMessage(
      existingEvent.channel_id,
      existingEvent.discord_message_id,
    );
  } catch (error) {
    return jsonError(
      error instanceof Error
        ? `Failed to delete Discord message: ${error.message}`
        : "Failed to delete Discord message",
      502,
    );
  }

  const { error: deleteError } = await supabaseAdmin
    .from("discord_attendance_events")
    .delete()
    .eq("id", eventId);

  if (deleteError) {
    return jsonError(deleteError.message || "Failed to delete attendance event", 500);
  }

  return NextResponse.json({ success: true, id: eventId });
}
