import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendDiscordMessage } from "@/lib/send-discord-message";

function getNextScheduledFor(currentIso: string, repeatType: string, repeatIntervalMinutes: number | null) {
  const date = new Date(currentIso);

  if (repeatType === "daily") {
    date.setDate(date.getDate() + 1);
    return date.toISOString();
  }

  if (repeatType === "weekly") {
    date.setDate(date.getDate() + 7);
    return date.toISOString();
  }

  if (repeatType === "monthly") {
    date.setMonth(date.getMonth() + 1);
    return date.toISOString();
  }

  if (repeatType === "custom" && repeatIntervalMinutes && repeatIntervalMinutes > 0) {
    date.setMinutes(date.getMinutes() + repeatIntervalMinutes);
    return date.toISOString();
  }

  return null;
}

export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data: dueAnnouncements, error } = await supabaseAdmin
    .from("discord_announcements")
    .select("*")
    .eq("active", true)
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: any[] = [];

  for (const item of dueAnnouncements || []) {
    try {
      const finalMessage =
        item.ping_role && item.ping_role_id
          ? `<@&${item.ping_role_id}> ${item.message}`
          : item.message;

      await sendDiscordMessage({
        channelId: item.channel_id,
        message: finalMessage,
      });

      if (item.repeat_enabled) {
        const nextScheduledFor = getNextScheduledFor(
          item.scheduled_for,
          item.repeat_type,
          item.repeat_interval_minutes
        );

        await supabaseAdmin
          .from("discord_announcements")
          .update({
            last_sent_at: new Date().toISOString(),
            scheduled_for: nextScheduledFor,
          })
          .eq("id", item.id);
      } else {
        await supabaseAdmin
          .from("discord_announcements")
          .update({
            last_sent_at: new Date().toISOString(),
            active: false,
          })
          .eq("id", item.id);
      }

      results.push({ id: item.id, success: true });
    } catch (err: any) {
      results.push({ id: item.id, success: false, error: err.message });
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results,
  });
}