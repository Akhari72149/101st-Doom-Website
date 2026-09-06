import { NextResponse } from "next/server";
import { requirePageAccess } from "@/lib/route-permissions";

const DISCORD_GUILD_ID = "445933549816774656";

const baseNumberEmojis = [
  { label: "0", value: "\u0030\ufe0f\u20e3", preview: "\u0030\ufe0f\u20e3", source: "base" },
  { label: "1", value: "\u0031\ufe0f\u20e3", preview: "\u0031\ufe0f\u20e3", source: "base" },
  { label: "2", value: "\u0032\ufe0f\u20e3", preview: "\u0032\ufe0f\u20e3", source: "base" },
  { label: "3", value: "\u0033\ufe0f\u20e3", preview: "\u0033\ufe0f\u20e3", source: "base" },
  { label: "4", value: "\u0034\ufe0f\u20e3", preview: "\u0034\ufe0f\u20e3", source: "base" },
  { label: "5", value: "\u0035\ufe0f\u20e3", preview: "\u0035\ufe0f\u20e3", source: "base" },
  { label: "6", value: "\u0036\ufe0f\u20e3", preview: "\u0036\ufe0f\u20e3", source: "base" },
  { label: "7", value: "\u0037\ufe0f\u20e3", preview: "\u0037\ufe0f\u20e3", source: "base" },
  { label: "8", value: "\u0038\ufe0f\u20e3", preview: "\u0038\ufe0f\u20e3", source: "base" },
  { label: "9", value: "\u0039\ufe0f\u20e3", preview: "\u0039\ufe0f\u20e3", source: "base" },
  { label: "10", value: "\ud83d\udd1f", preview: "\ud83d\udd1f", source: "base" },
] as const;

type DiscordGuildEmoji = {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
};

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.discord-attendance", "read"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const botToken = process.env.DISCORD_BOT_TOKEN || process.env.TOKEN;

  if (!botToken) {
    return NextResponse.json({
      emojis: baseNumberEmojis,
      warning: "DISCORD_BOT_TOKEN is not configured; only base number emojis are available.",
    });
  }

  const response = await fetch(
    `https://discord.com/api/v10/guilds/${DISCORD_GUILD_ID}/emojis`,
    {
      headers: {
        Authorization: `Bot ${botToken}`,
      },
      next: { revalidate: 300 },
    },
  );

  if (!response.ok) {
    return NextResponse.json({
      emojis: baseNumberEmojis,
      warning: "Discord emojis could not be loaded; only base number emojis are available.",
    });
  }

  const guildEmojis = (await response.json()) as DiscordGuildEmoji[];
  const serverEmojis = guildEmojis
    .filter((emoji) => emoji.id && emoji.name && emoji.available !== false)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((emoji) => {
      const prefix = emoji.animated ? "a" : "";
      return {
        id: emoji.id,
        label: `:${emoji.name}:`,
        name: emoji.name,
        value: `<${prefix}:${emoji.name}:${emoji.id}>`,
        preview: `:${emoji.name}:`,
        imageUrl: `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? "gif" : "png"}?size=48&quality=lossless`,
        animated: Boolean(emoji.animated),
        source: "server",
      };
    });

  return NextResponse.json({ emojis: [...baseNumberEmojis, ...serverEmojis] });
}
