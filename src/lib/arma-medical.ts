import "server-only";

import { createHash } from "crypto";

const STEAM_ID_PATTERN = /^\d{17}$/;

const VALID_MEDICAL_METRICS = new Set([
  "BLOOD_LITRES",
  "PLASMA_LITRES",
  "SALINE_LITRES",
  "BANDAGE_APPLIED",
  "STITCHED_BODY_PART",
  "SURGERY_COMPLETE",
  "HEART_RESTARTED",
  "LUNG_TREATED",
  "AIRWAY_CHECKED",
]);

export type ArmaMedicalPayload = {
  eventId?: string;
  eventType: "MEDICAL";
  schemaVersion?: number;
  serverId: string;
  missionId: string;
  occurredAt: string;
  steamId: string;
  patientSteamId?: string;
  medicalMetric: string;
  medicalQuantity?: number;
  medicalAction?: string;
  itemClass?: string;
  treatmentClass?: string;
  bodyPart?: string;
};

export type NormalizedArmaMedicalEvent = Required<
  Pick<
    ArmaMedicalPayload,
    "eventType" | "serverId" | "missionId" | "occurredAt" | "steamId" | "medicalMetric"
  >
> &
  Omit<
    ArmaMedicalPayload,
    "eventType" | "serverId" | "missionId" | "occurredAt" | "steamId" | "medicalMetric"
  > & {
    eventUid: string;
    occurredAtDate: Date;
    medicalQuantity: number;
  };

export type ArmaMedicalValidationResult =
  | {
      ok: true;
      event: NormalizedArmaMedicalEvent;
    }
  | {
      ok: false;
      error: string;
    };

function cleanString(value: unknown, maxLength = 240) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().slice(0, maxLength);
}

function cleanOptionalSteamId(value: unknown) {
  const steamId = cleanString(value, 32);
  return STEAM_ID_PATTERN.test(steamId) ? steamId : "";
}

function normalizeMedicalMetric(value: unknown) {
  const metric = cleanString(value, 80).toUpperCase();
  return VALID_MEDICAL_METRICS.has(metric) ? metric : "";
}

function normalizeMedicalQuantity(value: unknown, metric: string) {
  const fallback = metric.endsWith("_LITRES") ? 0 : 1;
  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(0, Math.round(parsed * 100) / 100);
}

function makeEventUid(payload: ArmaMedicalPayload, steamId: string) {
  if (payload.eventId && cleanString(payload.eventId, 160)) {
    return cleanString(payload.eventId, 160);
  }

  const source = JSON.stringify([
    payload.eventType,
    payload.serverId,
    payload.missionId,
    payload.occurredAt,
    steamId,
    payload.patientSteamId || "",
    payload.medicalMetric || "",
    payload.medicalQuantity ?? "",
    payload.medicalAction || "",
    payload.itemClass || "",
    payload.treatmentClass || "",
    payload.bodyPart || "",
  ]);

  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function normalizeArmaMedicalPayload(value: unknown): ArmaMedicalValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "INVALID_JSON" };
  }

  const input = value as Record<string, unknown>;
  const eventType = cleanString(input.eventType, 32).toUpperCase();

  if (eventType !== "MEDICAL") {
    return { ok: false, error: "INVALID_EVENT_TYPE" };
  }

  const serverId = cleanString(input.serverId, 80);
  const missionId = cleanString(input.missionId, 160);
  const occurredAt = cleanString(input.occurredAt, 80);
  const occurredAtDate = new Date(occurredAt);

  if (!serverId || !missionId || Number.isNaN(occurredAtDate.getTime())) {
    return { ok: false, error: "INVALID_EVENT_METADATA" };
  }

  const steamId = cleanOptionalSteamId(input.steamId);

  if (!steamId) {
    return { ok: false, error: "MISSING_PLAYER_STEAM_ID" };
  }

  const medicalMetric = normalizeMedicalMetric(input.medicalMetric);

  if (!medicalMetric) {
    return { ok: false, error: "INVALID_MEDICAL_METRIC" };
  }

  const medicalQuantity = normalizeMedicalQuantity(input.medicalQuantity, medicalMetric);

  if (medicalQuantity <= 0) {
    return { ok: false, error: "INVALID_MEDICAL_QUANTITY" };
  }

  const payload: ArmaMedicalPayload = {
    eventId: cleanString(input.eventId, 160) || undefined,
    eventType: "MEDICAL",
    schemaVersion: typeof input.schemaVersion === "number" ? input.schemaVersion : undefined,
    serverId,
    missionId,
    occurredAt,
    steamId,
    patientSteamId: cleanOptionalSteamId(input.patientSteamId) || undefined,
    medicalMetric,
    medicalQuantity,
    medicalAction: cleanString(input.medicalAction, 100) || undefined,
    itemClass: cleanString(input.itemClass, 180) || undefined,
    treatmentClass: cleanString(input.treatmentClass, 180) || undefined,
    bodyPart: cleanString(input.bodyPart, 80) || undefined,
  };

  return {
    ok: true,
    event: {
      ...payload,
      eventUid: makeEventUid(payload, steamId),
      occurredAtDate,
      medicalQuantity,
    },
  };
}
