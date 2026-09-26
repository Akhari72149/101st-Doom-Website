import "server-only";

export async function broadcastWebsiteAction(payload: Record<string, unknown>) {
  const url = process.env.WEBSITE_BOT_ACTION_URL;
  const secret = process.env.WEBSITE_BOT_SECRET;

  if (!url || !secret) {
    console.warn("[website-action] Bot notification configuration is missing");
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Bot action endpoint returned HTTP ${response.status}`);
    return true;
  } catch (error) {
    console.error("[website-action] Discord notification failed", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
