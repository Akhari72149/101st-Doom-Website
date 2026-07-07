import { NextResponse } from "next/server";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import {
  attendanceAssignableRoles,
  attendancePingRoles,
} from "@/data/discordAttendanceRoles";
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
  emoji: string;
  label: string;
  sort_order: number;
  assign_role_id: string | null;
};

const allowedPingRoleIds = new Set<string>(
  attendancePingRoles.map((role) => String(role.id)),
);

const allowedAssignableRoleIds = new Set<string>(
  attendanceAssignableRoles.map((role) => String(role.id)),
);

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

function cleanOption(option: unknown, index: number): AttendanceOptionInput {
  const entry =
    option && typeof option === "object" ? (option as Record<string, unknown>) : {};

  return {
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

export async function POST(request: Request) {
  const { userId, email, roles } = await getUserAndRoles(request);

  if (!userId || !canManageAttendance(roles)) {
    return jsonError("Unauthorized", 401);
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
    .filter((option): option is AttendanceOptionInput =>
      Boolean(option.emoji && option.label),
    );

  if (!title || !channelId || !eventStartsAt || (repeatEnabled && !scheduledSendAt)) {
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

  const now = new Date();
  const eventDate = new Date(eventStartsAt);
  const sendDate = scheduledSendAt ? new Date(scheduledSendAt) : now;
  const reminderDate = reminderScheduledAt ? new Date(reminderScheduledAt) : null;

  if (
    Number.isNaN(eventDate.getTime()) ||
    (repeatEnabled && Number.isNaN(sendDate.getTime()))
  ) {
    return jsonError("Invalid event or send date");
  }

  if (reminderDate && Number.isNaN(reminderDate.getTime())) {
    return jsonError("Invalid reminder date");
  }

  if (repeatEnabled && sendDate <= now) {
    return jsonError("Weekly send time must be in the future");
  }

  const baseEventPayload = {
    title,
    description: description || null,
    channel_id: channelId,
    channel_name: channel.name,
    event_starts_at: eventDate.toISOString(),
    scheduled_send_at: now.toISOString(),
    duration_minutes: durationMinutes,
    repeat_enabled: repeatEnabled,
    repeat_type: repeatType,
    repeat_timezone: repeatTimezone || "Europe/London",
    repeat_scheduled_send_at: repeatEnabled ? sendDate.toISOString() : null,
    footer_text: footerText || null,
    ping_role_id: pingRoleId || null,
    reminder_enabled: reminderEnabled,
    reminder_scheduled_at:
      reminderEnabled && reminderDate ? reminderDate.toISOString() : null,
    reminder_message: reminderEnabled ? reminderMessage : null,
    reminder_role_id: reminderEnabled && reminderRoleId ? reminderRoleId : null,
    created_by: userId,
    created_by_name: email,
    status: "scheduled",
  };

  const { data: event, error } = await supabaseAdmin
    .from("discord_attendance_events")
    .insert(baseEventPayload)
    .select("id")
    .single<{ id: string }>();

  if (error || !event) {
    return jsonError(error?.message || "Failed to create attendance event", 500);
  }

  const { error: optionError } = await supabaseAdmin
    .from("discord_attendance_options")
    .insert(options.map((option: AttendanceOptionInput) => ({ ...option, event_id: event.id })));

  if (optionError) {
    await supabaseAdmin
      .from("discord_attendance_events")
      .delete()
      .eq("id", event.id);

    return jsonError(optionError.message, 500);
  }

  return NextResponse.json({
    success: true,
    id: event.id,
    scheduled_id: null,
    send_now: true,
    repeat_enabled: repeatEnabled,
  });
}
