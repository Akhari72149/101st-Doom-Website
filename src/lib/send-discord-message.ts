export async function sendDiscordMessage({
  channelId,
  message,
}: {
  channelId: string;
  message: string;
}) {
  const res = await fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      },
      body: JSON.stringify({
        content: message,
        allowed_mentions: {
          parse: ["roles"],
        },
      }),
    }
  );

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Discord send failed: ${res.status} ${text}`);
  }

  return text ? JSON.parse(text) : null;
}