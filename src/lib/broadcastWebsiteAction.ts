export async function broadcastWebsiteAction(payload: any) {
  try {
    const url = process.env.WEBSITE_BOT_ACTION_URL;
    const secret = process.env.WEBSITE_BOT_SECRET;

    if (!url || !secret) {
      console.warn("Website action broadcast env vars missing.");
      return;
    }

    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Failed to broadcast website action:", error);
  }
}