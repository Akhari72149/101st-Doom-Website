import { NextResponse } from "next/server";
import { normalizeArmaMedicalPayload } from "@/lib/arma-medical";
import { verifyArmaXpSignature } from "@/lib/arma-xp";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

type RecordArmaMedicalEventResult = {
  accepted: boolean;
  duplicate: boolean;
  personnel_id: string | null;
  medical_metric: string | null;
  medical_quantity: number | string | null;
  xp_delta: number | null;
  xp_total: number | null;
  current_level: number | null;
  week_xp: number | null;
  lifetime_blood_litres: number | string | null;
  lifetime_plasma_litres: number | string | null;
  lifetime_saline_litres: number | string | null;
  lifetime_bandage_count: number | null;
  lifetime_stitched_body_part_count: number | null;
  lifetime_surgery_count: number | null;
  lifetime_heart_restart_count: number | null;
  lifetime_lung_treatment_count: number | null;
  lifetime_airway_check_count: number | null;
  lifetime_fracture_check_count: number | null;
  lifetime_ultrasound_scan_count: number | null;
  lifetime_chest_seal_count: number | null;
  week_blood_litres: number | string | null;
  week_plasma_litres: number | string | null;
  week_saline_litres: number | string | null;
  week_bandage_count: number | null;
  week_stitched_body_part_count: number | null;
  week_surgery_count: number | null;
  week_heart_restart_count: number | null;
  week_lung_treatment_count: number | null;
  week_airway_check_count: number | null;
  week_fracture_check_count: number | null;
  week_ultrasound_scan_count: number | null;
  week_chest_seal_count: number | null;
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

function numeric(value: number | string | null) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sanitizeError(error: unknown) {
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "MEDICAL_INGEST_FAILED").slice(0, 180);
  }

  return "MEDICAL_INGEST_FAILED";
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

  const validation = normalizeArmaMedicalPayload(parsedBody);

  if (!validation.ok) {
    return jsonResponse({ accepted: false, error: validation.error }, 400);
  }

  const event = validation.event;

  const { data, error } = await supabaseAdmin
    .rpc("record_arma_medical_event", {
      p_event_uid: event.eventUid,
      p_steam_id: event.steamId,
      p_medical_metric: event.medicalMetric,
      p_medical_quantity: event.medicalQuantity,
      p_server_id: event.serverId,
      p_mission_id: event.missionId,
      p_occurred_at: event.occurredAtDate.toISOString(),
      p_medical_action: event.medicalAction || null,
      p_item_class: event.itemClass || null,
      p_treatment_class: event.treatmentClass || null,
      p_body_part: event.bodyPart || null,
      p_patient_steam_id: event.patientSteamId || null,
    })
    .maybeSingle<RecordArmaMedicalEventResult>();

  if (error) {
    console.error("[arma-medical] Event ingest failed:", {
      code: error.code,
      message: error.message,
      safeError: "MEDICAL_INGEST_FAILED",
    });

    return jsonResponse(
      {
        accepted: false,
        error: "MEDICAL_INGEST_FAILED",
        message: sanitizeError(error),
      },
      500,
    );
  }

  if (!data) {
    return jsonResponse({ accepted: false, error: "MEDICAL_INGEST_FAILED" }, 500);
  }

  if (!data.accepted) {
    return jsonResponse(
      {
        accepted: false,
        error: data.reason,
        eventType: event.eventType,
        steamId: event.steamId,
        medicalMetric: event.medicalMetric,
        medicalQuantity: event.medicalQuantity,
        xpDelta: data.xp_delta,
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
    medical: {
      metric: data.medical_metric,
      quantity: numeric(data.medical_quantity),
      action: event.medicalAction || null,
      itemClass: event.itemClass || null,
      treatmentClass: event.treatmentClass || null,
      bodyPart: event.bodyPart || null,
      lifetime: {
        bloodLitres: numeric(data.lifetime_blood_litres),
        plasmaLitres: numeric(data.lifetime_plasma_litres),
        salineLitres: numeric(data.lifetime_saline_litres),
        bandages: data.lifetime_bandage_count || 0,
        stitchedBodyParts: data.lifetime_stitched_body_part_count || 0,
        surgeries: data.lifetime_surgery_count || 0,
        heartRestarts: data.lifetime_heart_restart_count || 0,
        lungTreatments: data.lifetime_lung_treatment_count || 0,
        airwayChecks: data.lifetime_airway_check_count || 0,
        fractureChecks: data.lifetime_fracture_check_count || 0,
        ultrasoundScans: data.lifetime_ultrasound_scan_count || 0,
        chestSeals: data.lifetime_chest_seal_count || 0,
      },
      weekly: {
        weekStartDate: data.week_start_date,
        weekEndAt: data.week_end_at,
        xp: data.week_xp || 0,
        bloodLitres: numeric(data.week_blood_litres),
        plasmaLitres: numeric(data.week_plasma_litres),
        salineLitres: numeric(data.week_saline_litres),
        bandages: data.week_bandage_count || 0,
        stitchedBodyParts: data.week_stitched_body_part_count || 0,
        surgeries: data.week_surgery_count || 0,
        heartRestarts: data.week_heart_restart_count || 0,
        lungTreatments: data.week_lung_treatment_count || 0,
        airwayChecks: data.week_airway_check_count || 0,
        fractureChecks: data.week_fracture_check_count || 0,
        ultrasoundScans: data.week_ultrasound_scan_count || 0,
        chestSeals: data.week_chest_seal_count || 0,
      },
    },
  });
}
