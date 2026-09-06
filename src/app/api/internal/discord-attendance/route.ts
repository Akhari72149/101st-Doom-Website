import { NextResponse } from "next/server";
import { authorizeDiscordOutbox } from "@/lib/discord-outbox";
import { getDiscordDatabaseBackend } from "@/lib/discord-database";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DISCORD_ID = /^\d{16,22}$/;
const OPTIONS = { headers: { "Cache-Control": "no-store" } };

function id(value: unknown) {
  const clean = String(value || "").trim();
  if (!UUID.test(clean)) throw new Error("INVALID_ID");
  return clean;
}

function discordId(value: unknown) {
  const clean = String(value || "").trim();
  if (!DISCORD_ID.test(clean)) throw new Error("INVALID_DISCORD_ID");
  return clean;
}

async function bundle(eventId: string) {
  const pool = getPostgresPool();
  const [event, options, responses] = await Promise.all([
    pool.query("select * from public.discord_attendance_events where id=$1", [eventId]),
    pool.query("select * from public.discord_attendance_options where event_id=$1 order by sort_order", [eventId]),
    pool.query("select * from public.discord_attendance_responses where event_id=$1 order by created_at", [eventId]),
  ]);
  if (!event.rows[0]) throw new Error("NOT_FOUND");
  return { event: event.rows[0], options: options.rows, responses: responses.rows };
}

export async function POST(request: Request) {
  if (!authorizeDiscordOutbox(request.headers.get("authorization"))) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, ...OPTIONS });
  if (getDiscordDatabaseBackend() !== "postgres") return NextResponse.json({ error: "NATIVE_ATTENDANCE_DISABLED" }, { status: 409, ...OPTIONS });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = String(body?.action || "");
  try {
    if (action === "bundle") return NextResponse.json(await bundle(id(body?.eventId)), OPTIONS);

    if (action === "claim-events") {
      const rows = await withPostgresTransaction(async (client) => {
        await client.query(`update public.discord_attendance_events set status='scheduled',failure_reason='Recovered stale send claim',updated_at=now() where status='sending' and updated_at<now()-interval '5 minutes'`);
        const result = await client.query(`with due as (select id from public.discord_attendance_events where status='scheduled' and scheduled_send_at<=now() order by scheduled_send_at for update skip locked limit 10) update public.discord_attendance_events e set status='sending',updated_at=now() from due where e.id=due.id returning e.id`);
        return result.rows;
      });
      return NextResponse.json({ events: rows }, OPTIONS);
    }

    if (action === "event-sent") {
      const result = await getPostgresPool().query(`update public.discord_attendance_events set discord_message_id=$2,last_sent_at=now(),status='sent',failure_reason=null,updated_at=now() where id=$1 and status='sending'`, [id(body?.eventId), discordId(body?.messageId)]);
      return NextResponse.json({ updated: result.rowCount === 1 }, { status: result.rowCount ? 200 : 409, ...OPTIONS });
    }

    if (action === "event-failed") {
      const error = String(body?.error || "Failed to send attendance event").replace(/[\r\n]+/g, " ").slice(0, 500);
      const result = await getPostgresPool().query(`update public.discord_attendance_events set status='failed',failure_reason=$2,updated_at=now() where id=$1 and status='sending'`, [id(body?.eventId), error]);
      return NextResponse.json({ updated: result.rowCount === 1 }, OPTIONS);
    }

    if (action === "claim-reminders") {
      const result = await getPostgresPool().query(`with due as (select id from public.discord_attendance_events where status='sent' and reminder_enabled=true and reminder_sent_at is null and reminder_scheduled_at<=now() and (reminder_claimed_at is null or reminder_claimed_at<now()-interval '5 minutes') order by reminder_scheduled_at for update skip locked limit 10) update public.discord_attendance_events e set reminder_claimed_at=now(),updated_at=now() from due where e.id=due.id returning e.id,e.channel_id,e.discord_message_id,e.reminder_message,e.reminder_role_id`);
      return NextResponse.json({ reminders: result.rows }, OPTIONS);
    }

    if (action === "reminder-sent") {
      const result = await getPostgresPool().query(`update public.discord_attendance_events set reminder_sent_at=now(),reminder_claimed_at=null,updated_at=now() where id=$1 and reminder_claimed_at is not null`, [id(body?.eventId)]);
      return NextResponse.json({ updated: result.rowCount === 1 }, OPTIONS);
    }

    if (action === "release-reminder") {
      await getPostgresPool().query(`update public.discord_attendance_events set reminder_claimed_at=null,updated_at=now() where id=$1 and reminder_sent_at is null`, [id(body?.eventId)]);
      return NextResponse.json({ updated: true }, OPTIONS);
    }

    if (action === "claim-cleanup") {
      const result = await getPostgresPool().query(`with due as (select id from public.discord_attendance_events where status='sent' and roles_removed_at is null and event_starts_at+(duration_minutes*interval '1 minute')<=now() and (roles_cleanup_claimed_at is null or roles_cleanup_claimed_at<now()-interval '5 minutes') order by event_starts_at for update skip locked limit 20) update public.discord_attendance_events e set roles_cleanup_claimed_at=now(),updated_at=now() from due where e.id=due.id returning e.id,e.channel_id,e.event_starts_at,e.duration_minutes,e.scheduled_send_at,e.repeat_scheduled_send_at,e.repeat_enabled,e.repeat_type,e.reminder_enabled,e.reminder_scheduled_at,(select coalesce(jsonb_agg(distinct r.discord_user_id),'[]'::jsonb) from public.discord_attendance_responses r where r.event_id=e.id) discord_user_ids`);
      return NextResponse.json({ events: result.rows }, OPTIONS);
    }

    if (action === "roll-weekly") {
      const eventId = id(body?.eventId);
      const eventStartsAt = new Date(String(body?.eventStartsAt || ""));
      const scheduledSendAt = new Date(String(body?.scheduledSendAt || ""));
      const reminderAt = body?.reminderScheduledAt ? new Date(String(body.reminderScheduledAt)) : null;
      if (Number.isNaN(eventStartsAt.getTime()) || Number.isNaN(scheduledSendAt.getTime()) || (reminderAt && Number.isNaN(reminderAt.getTime()))) throw new Error("INVALID_DATE");
      await withPostgresTransaction(async (client) => {
        await client.query("delete from public.discord_attendance_responses where event_id=$1", [eventId]);
        const result = await client.query(`update public.discord_attendance_events set event_starts_at=$2,scheduled_send_at=$3,repeat_scheduled_send_at=$3,reminder_scheduled_at=$4,reminder_sent_at=null,reminder_claimed_at=null,roles_removed_at=null,roles_cleanup_claimed_at=null,discord_message_id=null,status='scheduled',failure_reason=null,updated_at=now() where id=$1 and roles_cleanup_claimed_at is not null`, [eventId,eventStartsAt.toISOString(),scheduledSendAt.toISOString(),reminderAt?.toISOString() || null]);
        if (!result.rowCount) throw new Error("CONFLICT");
      });
      return NextResponse.json({ updated: true }, OPTIONS);
    }

    if (action === "close") {
      const result = await getPostgresPool().query(`update public.discord_attendance_events set roles_removed_at=now(),roles_cleanup_claimed_at=null,status='closed',updated_at=now() where id=$1 and roles_cleanup_claimed_at is not null`, [id(body?.eventId)]);
      return NextResponse.json({ updated: result.rowCount === 1 }, OPTIONS);
    }

    if (action === "release-cleanup") {
      await getPostgresPool().query(`update public.discord_attendance_events set roles_cleanup_claimed_at=null,updated_at=now() where id=$1 and roles_removed_at is null`, [id(body?.eventId)]);
      return NextResponse.json({ updated: true }, OPTIONS);
    }

    if (action === "find-message") {
      const result = await getPostgresPool().query(`select id,status from public.discord_attendance_events where discord_message_id=$1 and status='sent'`, [discordId(body?.messageId)]);
      return NextResponse.json({ event: result.rows[0] || null }, OPTIONS);
    }

    if (action === "option") {
      const result = await getPostgresPool().query(`select * from public.discord_attendance_options where event_id=$1 and id=$2`, [id(body?.eventId),id(body?.optionId)]);
      return NextResponse.json({ option: result.rows[0] || null }, OPTIONS);
    }

    if (action === "personnel") {
      const result = await getPostgresPool().query(`select id from public.personnel where regexp_replace(coalesce(discord_id,''),'[^0-9]','','g')=$1 limit 1`, [discordId(body?.discordUserId)]);
      return NextResponse.json({ personnelId: result.rows[0]?.id || null }, OPTIONS);
    }

    if (action === "upsert-response") {
      const eventId = id(body?.eventId), optionId = id(body?.optionId), userId = discordId(body?.discordUserId);
      const name = String(body?.displayName || userId).replace(/[\r\n]+/g, " ").slice(0, 100);
      const personnelId = body?.personnelId ? id(body.personnelId) : null;
      await getPostgresPool().query(`insert into public.discord_attendance_responses(event_id,option_id,discord_user_id,discord_display_name,personnel_id) values($1,$2,$3,$4,$5) on conflict(event_id,discord_user_id) do update set option_id=excluded.option_id,discord_display_name=excluded.discord_display_name,personnel_id=excluded.personnel_id,updated_at=now()`, [eventId,optionId,userId,name,personnelId]);
      return NextResponse.json({ updated: true }, OPTIONS);
    }

    if (action === "delete-response") {
      await getPostgresPool().query(`delete from public.discord_attendance_responses where event_id=$1 and option_id=$2 and discord_user_id=$3`, [id(body?.eventId),id(body?.optionId),discordId(body?.discordUserId)]);
      return NextResponse.json({ deleted: true }, OPTIONS);
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400, ...OPTIONS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ATTENDANCE_STORE_FAILED";
    const status = message.startsWith("INVALID_") ? 400 : message === "NOT_FOUND" ? 404 : message === "CONFLICT" ? 409 : 500;
    if (status === 500) console.error("[discord-attendance-store] Request failed", error);
    return NextResponse.json({ error: status === 500 ? "ATTENDANCE_STORE_FAILED" : message }, { status, ...OPTIONS });
  }
}
