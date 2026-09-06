import { NextResponse } from "next/server";
import { verifyArmaXpSignature } from "@/lib/arma-xp";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type CampaignStatusPayload = {
  eventType?: unknown;
  schemaVersion?: unknown;
  serverId?: unknown;
  missionId?: unknown;
  campaignId?: unknown;
  occurredAt?: unknown;
  world?: unknown;
  playerCount?: unknown;
  globalInfection?: unknown;
  researchData?: unknown;
  safehouseCount?: unknown;
  unlockedSafehouseCount?: unknown;
  activeHordeCount?: unknown;
  safehouseSiegeActive?: unknown;
  story?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: noStoreHeaders,
  });
}

function cleanString(value: unknown, maxLength = 180) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function cleanNumber(value: unknown, fallback: number | null = null) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : fallback;
}

function storyNumber(story: unknown, key: string, fallback = 0) {
  if (!story || typeof story !== "object" || Array.isArray(story)) {
    return fallback;
  }

  return cleanInteger((story as Record<string, unknown>)[key], fallback);
}

function normalizeCampaignStatusPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false as const, error: "INVALID_JSON" };
  }

  const input = value as CampaignStatusPayload;

  if (cleanString(input.eventType, 64).toUpperCase() !== "CAMPAIGN_STATUS") {
    return { ok: false as const, error: "INVALID_EVENT_TYPE" };
  }

  const serverId = cleanString(input.serverId, 80);
  const missionId = cleanString(input.missionId, 160);
  const campaignId = cleanString(input.campaignId, 120) || "operation-last-stand";
  const occurredAtText = cleanString(input.occurredAt, 80);
  const occurredAt = new Date(occurredAtText);

  if (!serverId || !missionId || Number.isNaN(occurredAt.getTime())) {
    return { ok: false as const, error: "INVALID_STATUS_METADATA" };
  }

  return {
    ok: true as const,
    snapshot: {
      server_id: serverId,
      mission_id: missionId,
      campaign_id: campaignId,
      occurred_at: occurredAt.toISOString(),
      received_at: new Date().toISOString(),
      world: cleanString(input.world, 80) || null,
      player_count: cleanInteger(input.playerCount),
      global_infection: cleanNumber(input.globalInfection),
      research_data: cleanInteger(input.researchData),
      safehouse_count: cleanInteger(input.safehouseCount),
      unlocked_safehouse_count: cleanInteger(input.unlockedSafehouseCount),
      active_horde_count: cleanInteger(input.activeHordeCount),
      safehouse_siege_active: input.safehouseSiegeActive === true,
      story_week: storyNumber(input.story, "week", 1),
      story_active_count: storyNumber(input.story, "active"),
      story_complete_count: storyNumber(input.story, "complete"),
      story_evidence_count: storyNumber(input.story, "evidence"),
      payload: value,
      updated_at: new Date().toISOString(),
    },
  };
}

function sanitizeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "CAMPAIGN_STATUS_FAILED").slice(0, 180);
  }

  return "CAMPAIGN_STATUS_FAILED";
}

function isPostgresBackend() {
  const value = process.env.ARMA_DATABASE_BACKEND || "supabase";
  if (value !== "postgres" && value !== "supabase") throw new Error("Unknown ARMA_DATABASE_BACKEND");
  return value === "postgres";
}

export async function GET() {
  if (isPostgresBackend()) {
    try {
      const pool = getPostgresPool();
      const [current, history, episode] = await Promise.all([
        pool.query(`select * from public.arma_campaign_status_current where campaign_id='operation-last-stand' order by received_at desc limit 1`),
        pool.query(`select id,server_id,mission_id,campaign_id,occurred_at,received_at,world,player_count,global_infection,research_data,safehouse_count,unlocked_safehouse_count,active_horde_count,safehouse_siege_active,story_week,story_active_count,story_complete_count,story_evidence_count,payload from public.arma_campaign_status_history where campaign_id='operation-last-stand' order by received_at desc limit 1`),
        pool.query(`select id,campaign_id,week_number,title,summary,status,starts_at,created_at,updated_at from public.arma_campaign_story_episodes where campaign_id='operation-last-stand' and status='active' order by week_number desc limit 1`),
      ]);
      const activeEpisode = episode.rows[0] || null;
      const objectives = activeEpisode ? await pool.query(`select id,campaign_id,week_number,size,title,description,marker,implementation_note,action,sort_order,status,created_at,updated_at from public.arma_campaign_story_objectives where campaign_id='operation-last-stand' and week_number=$1 order by sort_order`, [activeEpisode.week_number]) : { rows: [] };
      return jsonResponse({ ok:true,snapshot:current.rows[0]||null,history:history.rows,storyEpisode:activeEpisode,storyObjectives:objectives.rows });
    } catch (error) {
      console.error("[arma-campaign] Native read failed", error);
      return jsonResponse({ ok:false,error:"CAMPAIGN_STATUS_READ_FAILED" },500);
    }
  }
  const [currentResult, historyResult, storyEpisodeResult, storyObjectivesResult] = await Promise.all([
    supabaseAdmin
      .from("arma_campaign_status_current")
      .select("*")
      .eq("campaign_id", "operation-last-stand")
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("arma_campaign_status_history")
      .select(
        "id, server_id, mission_id, campaign_id, occurred_at, received_at, world, player_count, global_infection, research_data, safehouse_count, unlocked_safehouse_count, active_horde_count, safehouse_siege_active, story_week, story_active_count, story_complete_count, story_evidence_count, payload",
      )
      .eq("campaign_id", "operation-last-stand")
      .order("received_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("arma_campaign_story_episodes")
      .select("id, campaign_id, week_number, title, summary, status, starts_at, created_at, updated_at")
      .eq("campaign_id", "operation-last-stand")
      .eq("status", "active")
      .order("week_number", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("arma_campaign_story_objectives")
      .select("id, campaign_id, week_number, size, title, description, marker, implementation_note, action, sort_order, status, created_at, updated_at")
      .eq("campaign_id", "operation-last-stand")
      .order("week_number", { ascending: false })
      .order("sort_order", { ascending: true }),
  ]);

  if (currentResult.error) {
    console.error("[arma-campaign] Status read failed:", {
      code: currentResult.error.code,
      message: currentResult.error.message,
    });

    return jsonResponse({ ok: false, error: "CAMPAIGN_STATUS_READ_FAILED" }, 500);
  }

  if (historyResult.error) {
    console.error("[arma-campaign] History read failed:", {
      code: historyResult.error.code,
      message: historyResult.error.message,
    });

    return jsonResponse({ ok: false, error: "CAMPAIGN_STATUS_HISTORY_READ_FAILED" }, 500);
  }

  if (storyEpisodeResult.error) {
    console.error("[arma-campaign] Story episode read failed:", {
      code: storyEpisodeResult.error.code,
      message: storyEpisodeResult.error.message,
    });

    return jsonResponse({ ok: false, error: "CAMPAIGN_STORY_READ_FAILED" }, 500);
  }

  if (storyObjectivesResult.error) {
    console.error("[arma-campaign] Story objectives read failed:", {
      code: storyObjectivesResult.error.code,
      message: storyObjectivesResult.error.message,
    });

    return jsonResponse({ ok: false, error: "CAMPAIGN_STORY_OBJECTIVES_READ_FAILED" }, 500);
  }

  const activeEpisode = storyEpisodeResult.data ?? null;
  const storyObjectives = activeEpisode
    ? (storyObjectivesResult.data ?? []).filter((objective) => objective.week_number === activeEpisode.week_number)
    : [];

  return jsonResponse({
    ok: true,
    snapshot: currentResult.data ?? null,
    history: historyResult.data ?? [],
    storyEpisode: activeEpisode,
    storyObjectives,
  });
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

  const validation = normalizeCampaignStatusPayload(parsedBody);

  if (!validation.ok) {
    return jsonResponse({ accepted: false, error: validation.error }, 400);
  }

  const snapshot = validation.snapshot;
  const historySnapshot: Omit<typeof snapshot, "updated_at"> = {
    server_id: snapshot.server_id,
    mission_id: snapshot.mission_id,
    campaign_id: snapshot.campaign_id,
    occurred_at: snapshot.occurred_at,
    received_at: snapshot.received_at,
    world: snapshot.world,
    player_count: snapshot.player_count,
    global_infection: snapshot.global_infection,
    research_data: snapshot.research_data,
    safehouse_count: snapshot.safehouse_count,
    unlocked_safehouse_count: snapshot.unlocked_safehouse_count,
    active_horde_count: snapshot.active_horde_count,
    safehouse_siege_active: snapshot.safehouse_siege_active,
    story_week: snapshot.story_week,
    story_active_count: snapshot.story_active_count,
    story_complete_count: snapshot.story_complete_count,
    story_evidence_count: snapshot.story_evidence_count,
    payload: snapshot.payload,
  };

  if (isPostgresBackend()) {
    try {
      await withPostgresTransaction(async (client) => {
        const columns = ["server_id","mission_id","campaign_id","occurred_at","received_at","world","player_count","global_infection","research_data","safehouse_count","unlocked_safehouse_count","active_horde_count","safehouse_siege_active","story_week","story_active_count","story_complete_count","story_evidence_count","payload"];
        const values = columns.map((key) => historySnapshot[key as keyof typeof historySnapshot]);
        await client.query(`insert into public.arma_campaign_status_history(${columns.join(",")}) values(${columns.map((_,index)=>`$${index+1}`).join(",")}) on conflict(server_id,mission_id,campaign_id) do update set occurred_at=excluded.occurred_at,received_at=excluded.received_at,world=excluded.world,player_count=excluded.player_count,global_infection=excluded.global_infection,research_data=excluded.research_data,safehouse_count=excluded.safehouse_count,unlocked_safehouse_count=excluded.unlocked_safehouse_count,active_horde_count=excluded.active_horde_count,safehouse_siege_active=excluded.safehouse_siege_active,story_week=excluded.story_week,story_active_count=excluded.story_active_count,story_complete_count=excluded.story_complete_count,story_evidence_count=excluded.story_evidence_count,payload=excluded.payload`, values.map((value,index)=>columns[index]==="payload"?JSON.stringify(value):value));
        await client.query(`insert into public.arma_campaign_status_current(${columns.join(",")},updated_at) values(${columns.map((_,index)=>`$${index+1}`).join(",")},$${columns.length+1}) on conflict(server_id,mission_id,campaign_id) do update set occurred_at=excluded.occurred_at,received_at=excluded.received_at,world=excluded.world,player_count=excluded.player_count,global_infection=excluded.global_infection,research_data=excluded.research_data,safehouse_count=excluded.safehouse_count,unlocked_safehouse_count=excluded.unlocked_safehouse_count,active_horde_count=excluded.active_horde_count,safehouse_siege_active=excluded.safehouse_siege_active,story_week=excluded.story_week,story_active_count=excluded.story_active_count,story_complete_count=excluded.story_complete_count,story_evidence_count=excluded.story_evidence_count,payload=excluded.payload,updated_at=excluded.updated_at`, [...values.map((value,index)=>columns[index]==="payload"?JSON.stringify(value):value),snapshot.updated_at]);
      });
      return jsonResponse({ accepted:true,eventType:"CAMPAIGN_STATUS",serverId:snapshot.server_id,missionId:snapshot.mission_id,occurredAt:snapshot.occurred_at,receivedAt:snapshot.received_at,playerCount:snapshot.player_count,globalInfection:snapshot.global_infection });
    } catch (error) {
      console.error("[arma-campaign] Native upsert failed", error);
      return jsonResponse({ accepted:false,error:"CAMPAIGN_STATUS_FAILED",message:sanitizeError(error) },500);
    }
  }

  const { error: historyError } = await supabaseAdmin
    .from("arma_campaign_status_history")
    .upsert(historySnapshot, {
      onConflict: "server_id,mission_id,campaign_id",
    });

  if (historyError) {
    console.error("[arma-campaign] History upsert failed:", {
      code: historyError.code,
      message: historyError.message,
    });

    return jsonResponse(
      {
        accepted: false,
        error: "CAMPAIGN_STATUS_HISTORY_FAILED",
        message: sanitizeError(historyError),
      },
      500,
    );
  }

  const { error: currentError } = await supabaseAdmin
    .from("arma_campaign_status_current")
    .upsert(snapshot, {
      onConflict: "server_id,mission_id,campaign_id",
    });

  if (currentError) {
    console.error("[arma-campaign] Current upsert failed:", {
      code: currentError.code,
      message: currentError.message,
    });

    return jsonResponse(
      {
        accepted: false,
        error: "CAMPAIGN_STATUS_CURRENT_FAILED",
        message: sanitizeError(currentError),
      },
      500,
    );
  }

  return jsonResponse({
    accepted: true,
    eventType: "CAMPAIGN_STATUS",
    serverId: snapshot.server_id,
    missionId: snapshot.mission_id,
    occurredAt: snapshot.occurred_at,
    receivedAt: snapshot.received_at,
    playerCount: snapshot.player_count,
    globalInfection: snapshot.global_infection,
  });
}
