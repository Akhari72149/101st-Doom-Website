import { NextResponse } from "next/server";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import {
  attendanceAssignableRoles,
  attendancePingRoles,
} from "@/data/discordAttendanceRoles";
import { refreshDiscordAttendanceMessage } from "@/lib/refreshDiscordAttendance";
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
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const attendanceAccess = await requirePageAccess(request, "admin.discord-attendance", "edit");

  if (!attendanceAccess) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const eventId = String(params.id || "").trim();

  if (!eventId) {
    return jsonError("Missing attendance event id");
  }

  if (!cleanUuid(eventId)) return jsonError("Invalid attendance event id");
  if (getDiscordDatabaseBackend() === "postgres") {
    const existing = await getPostgresPool().query("select id from public.discord_attendance_events where id=$1", [eventId]);
    if (!existing.rowCount) return jsonError("Attendance event not found", 404);
  } else {
    const existing = await supabaseAdmin.from("discord_attendance_events").select("id").eq("id", eventId).maybeSingle();
    if (existing.error || !existing.data) return jsonError("Attendance event not found", 404);
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

  if (getDiscordDatabaseBackend() === "postgres") {
    try {
      await withPostgresTransaction(async (client) => {
        await client.query(`update public.discord_attendance_events set
          title=$2,description=$3,channel_id=$4,channel_name=$5,event_starts_at=$6,
          scheduled_send_at=$7,duration_minutes=$8,repeat_enabled=$9,repeat_type=$10,
          repeat_timezone=$11,repeat_scheduled_send_at=$12,footer_text=$13,ping_role_id=$14,
          reminder_enabled=$15,reminder_scheduled_at=$16,reminder_message=$17,
          reminder_role_id=$18,updated_at=now() where id=$1`,
          [eventId,title,description||null,channelId,channel.name,eventDate.toISOString(),
            sendDate.toISOString(),durationMinutes,repeatEnabled,repeatType,
            repeatTimezone||"Europe/London",repeatEnabled?sendDate.toISOString():null,
            footerText||null,pingRoleId||null,reminderEnabled,
            reminderEnabled&&reminderDate?reminderDate.toISOString():null,
            reminderEnabled?reminderMessage:null,
            reminderEnabled&&reminderRoleId?reminderRoleId:null]);
        const ids = options.map((option) => option.id).filter((id): id is string => Boolean(id));
        await client.query(`delete from public.discord_attendance_options where event_id=$1 and not(id=any($2::uuid[]))`, [eventId, ids]);
        for (const option of options) {
          if (option.id) {
            const updated = await client.query(`update public.discord_attendance_options set emoji=$3,label=$4,assign_role_id=$5,sort_order=$6 where id=$2 and event_id=$1`, [eventId,option.id,option.emoji,option.label,option.assign_role_id,option.sort_order]);
            if (!updated.rowCount) throw new Error("Attendance option not found");
          } else {
            await client.query(`insert into public.discord_attendance_options(event_id,emoji,label,assign_role_id,sort_order) values($1,$2,$3,$4,$5)`, [eventId,option.emoji,option.label,option.assign_role_id,option.sort_order]);
          }
        }
      });
      const refreshResult = await refreshDiscordAttendanceMessage(eventId);
      return NextResponse.json({ success: true, id: eventId, discord_message_refreshed: refreshResult.refreshed });
    } catch (error) {
      console.error("[discord-attendance] Native update failed", error);
      return jsonError("Failed to update attendance event", 500);
    }
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
  if (!requestHasSameOrigin(request)) return jsonError("Invalid request origin", 403);
  const attendanceAccess = await requirePageAccess(request, "admin.discord-attendance", "edit");

  if (!attendanceAccess) {
    return jsonError("Unauthorized", 401);
  }

  const params = await context.params;
  const eventId = String(params.id || "").trim();

  if (!eventId) {
    return jsonError("Missing attendance event id");
  }

  if (!cleanUuid(eventId)) return jsonError("Invalid attendance event id");
  let existingEvent: { id: string; channel_id: string | null; discord_message_id: string | null } | null = null;
  if (getDiscordDatabaseBackend() === "postgres") {
    const existing = await getPostgresPool().query<{ id: string; channel_id: string | null; discord_message_id: string | null }>("select id,channel_id,discord_message_id from public.discord_attendance_events where id=$1", [eventId]);
    existingEvent = existing.rows[0] || null;
  } else {
    const existing = await supabaseAdmin.from("discord_attendance_events").select("id,channel_id,discord_message_id").eq("id", eventId).maybeSingle();
    if (existing.error) return jsonError("Failed to load attendance event", 500);
    existingEvent = existing.data;
  }
  if (!existingEvent) return jsonError("Attendance event not found", 404);

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

  if (getDiscordDatabaseBackend() === "postgres") {
    await getPostgresPool().query("delete from public.discord_attendance_events where id=$1", [eventId]);
  } else {
    const deleted = await supabaseAdmin.from("discord_attendance_events").delete().eq("id", eventId);
    if (deleted.error) return jsonError(deleted.error.message || "Failed to delete attendance event", 500);
  }

  return NextResponse.json({ success: true, id: eventId });
}
