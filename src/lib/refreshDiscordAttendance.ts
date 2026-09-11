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

export async function refreshDiscordAttendanceMessage(
  eventId: string,
  mode: "refresh" | "ensure-sent" = "refresh",
) {
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
      body: JSON.stringify({ event_id: eventId, mode }),
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      console.error(
        "Attendance refresh failed:",
        responseText || `HTTP ${response.status}`,
      );
      return { refreshed: false, reason: "BOT_REFRESH_FAILED" };
    }

    const result = await response.json().catch(() => ({})) as {
      action?: "refreshed" | "sent";
    };

    return {
      refreshed: true,
      reason: result.action === "sent" ? "SENT" : "REFRESHED",
    };
  } catch (error) {
    console.error("Failed to refresh attendance message:", error);
    return { refreshed: false, reason: "BOT_REFRESH_FAILED" };
  }
}
