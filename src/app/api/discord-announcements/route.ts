import { NextResponse } from "next/server";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import { getDiscordDatabaseBackend } from "@/lib/discord-database";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_REPEAT_TYPES = ["none", "daily", "weekly", "monthly", "custom"] as const;
const DISCORD_MESSAGE_LIMIT = 2000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type AnnouncementInput = {
  title: string; message: string; channel_id: string; channel_name: string;
  scheduled_for: string; repeat_enabled: boolean;
  repeat_type: (typeof VALID_REPEAT_TYPES)[number];
  repeat_interval_minutes: number | null; ping_role: boolean; ping_role_id: string | null;
};

function parseInput(body: Record<string, unknown>) {
  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const repeatEnabled = Boolean(body.repeat_enabled);
  const repeatType = String(body.repeat_type || "none");
  const interval = body.repeat_interval_minutes == null ? null : Number(body.repeat_interval_minutes);
  const pingRole = Boolean(body.ping_role);
  const roleId = process.env.DISCORD_ANNOUNCEMENT_ROLE_ID || null;
  const channel = discordAnnouncementChannels.find((entry) => entry.id === channelId);
  const date = new Date(String(body.scheduled_for || ""));

  if (!title || !message || !channelId || Number.isNaN(date.getTime())) return { error: "Missing or invalid required fields" } as const;
  if (date.getTime() <= Date.now()) return { error: "Scheduled time must be a valid future date" } as const;
  if (!VALID_REPEAT_TYPES.includes(repeatType as AnnouncementInput["repeat_type"])) return { error: "Invalid repeat type" } as const;
  if (!channel) return { error: "Invalid channel selected" } as const;
  if (repeatEnabled && repeatType === "custom" && (!interval || interval <= 0)) return { error: "Custom repeat interval must be greater than 0" } as const;
  const preview = pingRole && roleId ? `<@&${roleId}> ${message}` : message;
  if (preview.length > DISCORD_MESSAGE_LIMIT) return { error: `Message exceeds ${DISCORD_MESSAGE_LIMIT} characters` } as const;

  return { data: {
    title, message, channel_id: channelId, channel_name: channel.name,
    scheduled_for: date.toISOString(), repeat_enabled: repeatEnabled,
    repeat_type: (repeatEnabled ? repeatType : "none") as AnnouncementInput["repeat_type"],
    repeat_interval_minutes: repeatEnabled && repeatType === "custom" ? interval : null,
    ping_role: pingRole, ping_role_id: pingRole ? roleId : null,
  } satisfies AnnouncementInput } as const;
}

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.discord-announcements", "read"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    if (getDiscordDatabaseBackend() === "postgres") {
      const result = await getPostgresPool().query(`select id,title,message,channel_id,channel_name,scheduled_for,repeat_enabled,repeat_type,repeat_interval_minutes,ping_role,ping_role_id,active,last_sent_at,created_at from public.discord_announcements order by scheduled_for`);
      return NextResponse.json({ announcements: result.rows }, { headers: { "Cache-Control": "no-store" } });
    }
    const result = await supabaseAdmin.from("discord_announcements").select("id,title,message,channel_id,channel_name,scheduled_for,repeat_enabled,repeat_type,repeat_interval_minutes,ping_role,ping_role_id,active,last_sent_at,created_at").order("scheduled_for");
    if (result.error) throw result.error;
    return NextResponse.json({ announcements: result.data || [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[discord-announcements] Read failed", error);
    return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, "admin.discord-announcements", "edit"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = parseInput(await request.json().catch(() => ({})));
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    if (getDiscordDatabaseBackend() === "postgres") {
      const d = parsed.data;
      await getPostgresPool().query(`insert into public.discord_announcements(title,message,channel_id,channel_name,scheduled_for,repeat_enabled,repeat_type,repeat_interval_minutes,ping_role,ping_role_id,active) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)`, [d.title,d.message,d.channel_id,d.channel_name,d.scheduled_for,d.repeat_enabled,d.repeat_type,d.repeat_interval_minutes,d.ping_role,d.ping_role_id]);
    } else {
      const result = await supabaseAdmin.from("discord_announcements").insert({ ...parsed.data, active: true });
      if (result.error) throw result.error;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[discord-announcements] Create failed", error);
    return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  if (!(await requirePageAccess(request, "admin.discord-announcements", "edit"))) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const id = String(body.id || "").trim();
  if (!UUID.test(id)) return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  const parsed = parseInput(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    let found = true;
    if (getDiscordDatabaseBackend() === "postgres") {
      const d = parsed.data;
      const result = await getPostgresPool().query(`update public.discord_announcements set title=$2,message=$3,channel_id=$4,channel_name=$5,scheduled_for=$6,repeat_enabled=$7,repeat_type=$8,repeat_interval_minutes=$9,ping_role=$10,ping_role_id=$11 where id=$1`, [id,d.title,d.message,d.channel_id,d.channel_name,d.scheduled_for,d.repeat_enabled,d.repeat_type,d.repeat_interval_minutes,d.ping_role,d.ping_role_id]);
      found = Boolean(result.rowCount);
    } else {
      const result = await supabaseAdmin.from("discord_announcements").update(parsed.data).eq("id", id).select("id").maybeSingle();
      if (result.error) throw result.error;
      found = Boolean(result.data);
    }
    return found ? NextResponse.json({ success: true }) : NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  } catch (error) {
    console.error("[discord-announcements] Update failed", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}
