import { NextResponse } from "next/server";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import {
  attendanceAssignableRoles,
  attendancePingRoles,
} from "@/data/discordAttendanceRoles";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getDiscordDatabaseBackend } from "@/lib/discord-database";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.discord-attendance", "read"))) return jsonError("Unauthorized", 401);
  if (getDiscordDatabaseBackend() === "postgres") {
    try {
      const result = await getPostgresPool().query(`
        select e.id,e.title,e.description,e.channel_id,e.channel_name,e.event_starts_at,
          e.duration_minutes,e.scheduled_send_at,e.repeat_scheduled_send_at,e.repeat_enabled,
          e.repeat_type,e.footer_text,e.status,e.discord_message_id,e.ping_role_id,
          e.reminder_enabled,e.reminder_scheduled_at,e.reminder_sent_at,e.reminder_message,
          e.reminder_role_id,coalesce(jsonb_agg(jsonb_build_object(
            'id',o.id,'emoji',o.emoji,'label',o.label,'assign_role_id',o.assign_role_id,
            'sort_order',o.sort_order) order by o.sort_order) filter (where o.id is not null),'[]'::jsonb) options
        from public.discord_attendance_events e
        left join public.discord_attendance_options o on o.event_id=e.id
        group by e.id order by e.scheduled_send_at limit 40`);
      return NextResponse.json({ events: result.rows }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      console.error("[discord-attendance] Native read failed", error);
      return jsonError("Failed to load attendance events", 500);
    }
  }
  const { data, error } = await supabaseAdmin.from("discord_attendance_events").select(`
    id,title,description,channel_id,channel_name,event_starts_at,duration_minutes,scheduled_send_at,
    repeat_scheduled_send_at,repeat_enabled,repeat_type,footer_text,status,discord_message_id,ping_role_id,
    reminder_enabled,reminder_scheduled_at,reminder_sent_at,reminder_message,reminder_role_id,
    options:discord_attendance_options(id,emoji,label,assign_role_id,sort_order)
  `).order("scheduled_send_at").limit(40);
  if (error) return jsonError("Failed to load attendance events", 500);
  return NextResponse.json({ events: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const auth = await requirePageAccess(request, "admin.discord-attendance", "edit");
  if (!auth) {
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
    created_by: auth.userId,
    created_by_name: auth.email,
    status: "scheduled",
  };

  if (getDiscordDatabaseBackend() === "postgres") {
    try {
      const id = await withPostgresTransaction(async (client) => {
        const event = await client.query<{ id: string }>(`insert into public.discord_attendance_events(
          title,description,channel_id,channel_name,event_starts_at,scheduled_send_at,duration_minutes,
          repeat_enabled,repeat_type,repeat_timezone,repeat_scheduled_send_at,footer_text,ping_role_id,
          reminder_enabled,reminder_scheduled_at,reminder_message,reminder_role_id,created_by,
          created_by_name,status) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'scheduled') returning id`,
          [baseEventPayload.title,baseEventPayload.description,baseEventPayload.channel_id,
            baseEventPayload.channel_name,baseEventPayload.event_starts_at,baseEventPayload.scheduled_send_at,
            baseEventPayload.duration_minutes,baseEventPayload.repeat_enabled,baseEventPayload.repeat_type,
            baseEventPayload.repeat_timezone,baseEventPayload.repeat_scheduled_send_at,
            baseEventPayload.footer_text,baseEventPayload.ping_role_id,baseEventPayload.reminder_enabled,
            baseEventPayload.reminder_scheduled_at,baseEventPayload.reminder_message,
            baseEventPayload.reminder_role_id,baseEventPayload.created_by,baseEventPayload.created_by_name]);
        for (const option of options) {
          await client.query(`insert into public.discord_attendance_options(event_id,emoji,label,assign_role_id,sort_order) values($1,$2,$3,$4,$5)`, [event.rows[0].id,option.emoji,option.label,option.assign_role_id,option.sort_order]);
        }
        return event.rows[0].id;
      });
      return NextResponse.json({ success: true, id, scheduled_id: null, send_now: true, repeat_enabled: repeatEnabled });
    } catch (error) {
      console.error("[discord-attendance] Native create failed", error);
      return jsonError("Failed to create attendance event", 500);
    }
  }

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
