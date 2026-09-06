import { NextResponse } from "next/server";
import axios from "axios";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;

export async function POST(req: Request) {
  if (!requestHasSameOrigin(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  if (!(await requirePageAccess(req, "admin.positions", "edit"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const body = await req.json();

    const { discord_id, rank_role_id } = body;

    if (!discord_id || !rank_role_id) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // Add role to user
    await axios.put(
      `https://discord.com/api/guilds/${GUILD_ID}/members/${discord_id}/roles/${rank_role_id}`,
      {},
      {
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
        },
      }
    );

    return NextResponse.json({ success: true });

  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Rank update failed" },
      { status: 500 }
    );
  }
}
