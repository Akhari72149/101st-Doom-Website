import { NextResponse } from "next/server";
import { calculateArmaXpDelta, normalizeArmaXpPayload, verifyArmaXpSignature } from "@/lib/arma-xp";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type RecordArmaXpEventResult = {
  accepted: boolean;
  duplicate: boolean;
  personnel_id: string | null;
  xp_delta: number | null;
  xp_total: number | null;
  current_level: number | null;
  week_xp: number | null;
  week_kill_count: number | null;
  week_death_count: number | null;
  week_teamkill_count: number | null;
  week_start_date: string | null;
  week_end_at: string | null;
  reason: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

function sanitizeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "XP_INGEST_FAILED").slice(0, 180);
  }

  return "XP_INGEST_FAILED";
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = verifyArmaXpSignature(request.headers, rawBody);

  if (!signature.ok) {
    return jsonResponse({ accepted: false, error: signature.error }, 401);
  }

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ accepted: false, error: "INVALID_JSON" }, 400);
  }

  const validation = normalizeArmaXpPayload(parsedBody);

  if (!validation.ok) {
    return jsonResponse({ accepted: false, error: validation.error }, 400);
  }

  const event = validation.event;
  const xpDelta = calculateArmaXpDelta(event);

  const { data, error } = await supabaseAdmin
    .rpc("record_arma_xp_event", {
      p_event_uid: event.eventUid,
      p_event_type: event.eventType,
      p_steam_id: event.steamId,
      p_xp_delta: xpDelta,
      p_server_id: event.serverId,
      p_mission_id: event.missionId,
      p_occurred_at: event.occurredAtDate.toISOString(),
      p_target_category: event.targetCategory,
    })
    .maybeSingle<RecordArmaXpEventResult>();

  if (error) {
    console.error("[arma-xp] Event ingest failed:", {
      code: error.code,
      message: error.message,
      safeError: "XP_INGEST_FAILED",
    });

    return jsonResponse(
      {
        accepted: false,
        error: "XP_INGEST_FAILED",
        message: sanitizeError(error),
      },
      500,
    );
  }

  if (!data) {
    return jsonResponse({ accepted: false, error: "XP_INGEST_FAILED" }, 500);
  }

  if (!data.accepted) {
    return jsonResponse(
      {
        accepted: false,
        error: data.reason,
        eventType: event.eventType,
        steamId: event.steamId,
        xpDelta,
      },
      data.reason === "STEAM_NOT_LINKED" ? 202 : 400,
    );
  }

  return jsonResponse({
    accepted: true,
    duplicate: data.duplicate,
    reason: data.reason,
    eventUid: event.eventUid,
    personnelId: data.personnel_id,
    steamId: event.steamId,
    eventType: event.eventType,
    xpDelta: data.xp_delta,
    xpTotal: data.xp_total,
    currentLevel: data.current_level,
    weekly: {
      xp: data.week_xp,
      kills: data.week_kill_count,
      deaths: data.week_death_count,
      teamkills: data.week_teamkill_count,
      weekStartDate: data.week_start_date,
      weekEndAt: data.week_end_at,
    },
  });
}
