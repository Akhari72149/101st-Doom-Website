import { NextResponse } from "next/server";
import { sendDiscordMessage } from "@/lib/send-discord-message";
import { discordAnnouncementChannels } from "@/data/discordAnnouncementChannels";
import { getAdminRouteAuth, hasAnyAdminRole } from "@/lib/admin-route-auth";

const DISCORD_MESSAGE_LIMIT = 2000;
const ANNOUNCEMENT_ADMIN_ROLES = ["admin", "logistics"];

export async function POST(req: Request) {
  const { userId, roles } = await getAdminRouteAuth(req);

  if (!userId || !hasAnyAdminRole(roles, ANNOUNCEMENT_ADMIN_ROLES)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const pingRole = Boolean(body.ping_role);

  const roleId = process.env.DISCORD_ANNOUNCEMENT_ROLE_ID || null;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!channelId) {
    return NextResponse.json({ error: "Channel is required" }, { status: 400 });
  }

  const allowedChannel = discordAnnouncementChannels.find((c) => c.id === channelId);

  if (!allowedChannel) {
    return NextResponse.json({ error: "Invalid channel selected" }, { status: 400 });
  }

  const finalMessage =
    pingRole && roleId ? `<@&${roleId}> ${message}` : message;

  if (finalMessage.length > DISCORD_MESSAGE_LIMIT) {
    return NextResponse.json(
      { error: `Message exceeds ${DISCORD_MESSAGE_LIMIT} characters` },
      { status: 400 }
    );
  }

  try {
    await sendDiscordMessage({
      channelId,
      message: finalMessage,
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send announcement",
      },
      { status: 500 }
    );
  }
}
