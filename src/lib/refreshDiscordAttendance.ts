function getAttendanceRefreshUrl() {
  const explicitUrl = process.env.WEBSITE_BOT_ATTENDANCE_REFRESH_URL?.trim();
  if (explicitUrl) return explicitUrl;

  const actionUrl = process.env.WEBSITE_BOT_ACTION_URL?.trim();
  if (!actionUrl) return "";

  try {
    const url = new URL(actionUrl);
    url.pathname = "/attendance/refresh";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export async function refreshDiscordAttendanceMessage(eventId: string) {
  try {
    const url = getAttendanceRefreshUrl();
    const secret = process.env.WEBSITE_BOT_SECRET;

    if (!url || !secret) {
      console.warn("Attendance refresh env vars missing.");
      return { refreshed: false, reason: "NOT_CONFIGURED" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${secret}`,
      },
      body: JSON.stringify({ event_id: eventId }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        "Attendance refresh failed:",
        responseText || `HTTP ${response.status}`,
      );
      return { refreshed: false, reason: "BOT_REFRESH_FAILED" };
    }

    return { refreshed: true, reason: "REFRESHED" };
  } catch (error) {
    console.error("Failed to refresh attendance message:", error);
    return { refreshed: false, reason: "BOT_REFRESH_FAILED" };
  }
}
