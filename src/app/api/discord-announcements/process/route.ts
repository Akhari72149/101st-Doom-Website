import { NextResponse } from "next/server";
import { getDiscordDatabaseBackend } from "@/lib/discord-database";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { sendDiscordMessage } from "@/lib/send-discord-message";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProcessResult = { id: string; success: boolean; error?: string };
type Announcement = {
  id: string; message: string; channel_id: string; scheduled_for: string;
  repeat_enabled: boolean; repeat_type: string; repeat_interval_minutes: number | null;
  ping_role: boolean; ping_role_id: string | null;
};

function getNextScheduledFor(current: string, repeatType: string, interval: number | null) {
  const date = new Date(current);
  if (repeatType === "daily") date.setUTCDate(date.getUTCDate() + 1);
  else if (repeatType === "weekly") date.setUTCDate(date.getUTCDate() + 7);
  else if (repeatType === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
  else if (repeatType === "custom" && interval && interval > 0) date.setUTCMinutes(date.getUTCMinutes() + interval);
  else return null;
  while (date.getTime() <= Date.now()) {
    if (repeatType === "daily") date.setUTCDate(date.getUTCDate() + 1);
    else if (repeatType === "weekly") date.setUTCDate(date.getUTCDate() + 7);
    else if (repeatType === "monthly") date.setUTCMonth(date.getUTCMonth() + 1);
    else date.setUTCMinutes(date.getUTCMinutes() + Number(interval));
  }
  return date.toISOString();
}

async function send(item: Announcement) {
  const message = item.ping_role && item.ping_role_id ? `<@&${item.ping_role_id}> ${item.message}` : item.message;
  await sendDiscordMessage({ channelId: item.channel_id, message });
}

async function processPostgres() {
  const due = await getPostgresPool().query<{ id: string }>(`select id from public.discord_announcements where active=true and scheduled_for<=now() order by scheduled_for limit 50`);
  const results: ProcessResult[] = [];
  for (const candidate of due.rows) {
    try {
      const processed = await withPostgresTransaction(async (client) => {
        const locked = await client.query<Announcement>(`select id,message,channel_id,scheduled_for,repeat_enabled,repeat_type,repeat_interval_minutes,ping_role,ping_role_id from public.discord_announcements where id=$1 and active=true and scheduled_for<=now() for update skip locked`, [candidate.id]);
        const item = locked.rows[0];
        if (!item) return false;
        await send(item);
        const next = item.repeat_enabled ? getNextScheduledFor(item.scheduled_for, item.repeat_type, item.repeat_interval_minutes) : null;
        await client.query(`update public.discord_announcements set last_sent_at=now(),scheduled_for=coalesce($2::timestamptz,scheduled_for),active=$3 where id=$1`, [item.id, next, Boolean(next)]);
        return true;
      });
      if (processed) results.push({ id: candidate.id, success: true });
    } catch (error) {
      results.push({ id: candidate.id, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}

async function processSupabase() {
  const now = new Date().toISOString();
  const due = await supabaseAdmin.from("discord_announcements").select("*").eq("active", true).lte("scheduled_for", now).order("scheduled_for", { ascending: true }).limit(50);
  if (due.error) throw due.error;
  const results: ProcessResult[] = [];
  for (const item of (due.data || []) as Announcement[]) {
    try {
      await send(item);
      const next = item.repeat_enabled ? getNextScheduledFor(item.scheduled_for, item.repeat_type, item.repeat_interval_minutes) : null;
      const update = await supabaseAdmin.from("discord_announcements").update({ last_sent_at: new Date().toISOString(), scheduled_for: next || item.scheduled_for, active: Boolean(next) }).eq("id", item.id);
      if (update.error) throw update.error;
      results.push({ id: item.id, success: true });
    } catch (error) {
      results.push({ id: item.id, success: false, error: error instanceof Error ? error.message : "Unknown error" });
    }
  }
  return results;
}

export async function POST(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const results = getDiscordDatabaseBackend() === "postgres" ? await processPostgres() : await processSupabase();
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error("[discord-announcements] Processing failed", error);
    return NextResponse.json({ error: "Failed to process announcements" }, { status: 500 });
  }
}
