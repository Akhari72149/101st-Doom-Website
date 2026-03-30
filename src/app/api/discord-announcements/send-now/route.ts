import { NextResponse } from "next/server";
import { requireDiscordAnnouncementAccess } from "@/lib/require-discord-announcement-access";
import { sendDiscordMessage } from "@/lib/send-discord-message";

const DISCORD_MESSAGE_LIMIT = 2000;

export async function POST(req: Request) {
  const auth = await requireDiscordAnnouncementAccess();

  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();

  const title = String(body.title || "").trim();
  const message = String(body.message || "").trim();
  const channelId = String(body.channel_id || "").trim();
  const pingRole = Boolean(body.ping_role);
  const pingRoleId = body.ping_role_id ? String(body.ping_role_id) : null;

  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  if (!channelId) {
    return NextResponse.json({ error: "Channel is required" }, { status: 400 });
  }

  const finalMessage = pingRole && pingRoleId
    ? `<@&${pingRoleId}> ${message}`
    : message;

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
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to send announcement" },
      { status: 500 }
    );
  }
}