import { NextResponse } from "next/server";
import { requireDiscordAnnouncementAccess } from "@/lib/require-discord-announcement-access";

export async function GET() {
  const auth = await requireDiscordAnnouncementAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const guildId = process.env.DISCORD_GUILD_ID;

  const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
    },
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json(
      { error: data?.message || "Failed to fetch Discord channels" },
      { status: res.status }
    );
  }

  const channels = (data || [])
    .filter((c: any) => c.type === 0)
    .map((c: any) => ({
      id: c.id,
      name: c.name,
    }))
    .sort((a: any, b: any) => a.name.localeCompare(b.name));

  return NextResponse.json({ channels });
}