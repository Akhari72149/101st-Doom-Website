import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type ResetResult = {
  receipts_deleted: number;
  weekly_stats_deleted: number;
  target_stats_deleted: number;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

async function resetWeeklyXp(request: Request) {
  if (!isAuthorized(request)) {
    return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const { data, error } = await supabaseAdmin
    .rpc("reset_arma_xp_weekly_data")
    .maybeSingle<ResetResult>();

  if (error) {
    console.error("[arma-xp] Weekly XP reset failed:", {
      code: error.code,
      message: error.message,
      safeError: "XP_WEEKLY_RESET_FAILED",
    });

    return jsonResponse({ ok: false, error: "XP_WEEKLY_RESET_FAILED" }, 500);
  }

  return jsonResponse({
    ok: true,
    resetAt: new Date().toISOString(),
    deleted: {
      receipts: data?.receipts_deleted ?? 0,
      weeklyStats: data?.weekly_stats_deleted ?? 0,
      targetStats: data?.target_stats_deleted ?? 0,
    },
  });
}

export async function GET(request: Request) {
  return resetWeeklyXp(request);
}

export async function POST(request: Request) {
  return resetWeeklyXp(request);
}
