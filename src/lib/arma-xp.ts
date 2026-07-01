import "server-only";

import { createHash, createHmac, timingSafeEqual } from "crypto";

export const ARMA_XP_SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export const ARMA_XP_VALUES = {
  INFANTRY: 10,
  SPECIALIST_INFANTRY: 15,
  CREW_OR_PILOT: 15,
  STATIC_WEAPON: 20,
  LIGHT_VEHICLE: 35,
  VEHICLE: 40,
  APC_IFV: 60,
  TANK: 100,
  AIRCRAFT: 125,
} as const;

export const ARMA_DEATH_XP_PENALTY = -5;
export const ARMA_TEAMKILL_XP_PENALTY = -25;

const VALID_EVENT_TYPES = new Set([
  "KILL",
  "DEATH",
  "OBJECTIVE",
  "MISSION_COMPLETE",
]);

const STEAM_ID_PATTERN = /^\d{17}$/;

export type ArmaXpEventType = "KILL" | "DEATH" | "OBJECTIVE" | "MISSION_COMPLETE";

export type ArmaXpPayload = {
  eventId?: string;
  eventType: ArmaXpEventType;
  schemaVersion?: number;
  serverId: string;
  missionId: string;
  occurredAt: string;
  attackerSteamId?: string;
  victimSteamId?: string;
  steamId?: string;
  targetCategory?: string;
  targetClass?: string;
  targetDisplayName?: string;
  weaponClass?: string;
  distanceMeters?: number;
  isTeamkill?: boolean;
  isAi?: boolean;
};

export type NormalizedArmaXpEvent = Required<
  Pick<ArmaXpPayload, "eventType" | "serverId" | "missionId" | "occurredAt">
> &
  Omit<ArmaXpPayload, "eventType" | "serverId" | "missionId" | "occurredAt"> & {
    eventUid: string;
    steamId: string;
    occurredAtDate: Date;
    targetCategory: string;
    isTeamkill: boolean;
  };

export type ArmaXpValidationResult =
  | {
      ok: true;
      event: NormalizedArmaXpEvent;
    }
  | {
      ok: false;
      error: string;
    };

export type ArmaXpSignatureResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: "MISSING_SIGNATURE_CONFIG" | "MISSING_SIGNATURE" | "STALE_SIGNATURE" | "BAD_SIGNATURE";
    };

function getIngestSecret() {
  return process.env.ARMA_XP_INGEST_SECRET?.trim() || "";
}

function normalizeSignature(signature: string) {
  return signature.trim().replace(/^sha256=/i, "").toLowerCase();
}

function safeCompareHex(left: string, right: string) {
  const cleanLeft = normalizeSignature(left);
  const cleanRight = normalizeSignature(right);

  if (!/^[a-f0-9]{64}$/.test(cleanLeft) || !/^[a-f0-9]{64}$/.test(cleanRight)) {
    return false;
  }

  const leftBuffer = Buffer.from(cleanLeft, "hex");
  const rightBuffer = Buffer.from(cleanRight, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signArmaXpPayload(timestamp: number, rawBody: string) {
  const secret = getIngestSecret();

  if (!secret) {
    throw new Error("Missing required environment variable: ARMA_XP_INGEST_SECRET");
  }

  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

export function verifyArmaXpSignature(headers: Headers, rawBody: string): ArmaXpSignatureResult {
  const secret = getIngestSecret();

  if (!secret) {
    return { ok: false, error: "MISSING_SIGNATURE_CONFIG" };
  }

  const timestampHeader = headers.get("X-101ST-Timestamp");
  const signatureHeader = headers.get("X-101ST-Signature");

  if (!timestampHeader || !signatureHeader) {
    return { ok: false, error: "MISSING_SIGNATURE" };
  }

  const timestamp = Number(timestampHeader);

  if (!Number.isFinite(timestamp)) {
    return { ok: false, error: "MISSING_SIGNATURE" };
  }

  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - timestamp) > ARMA_XP_SIGNATURE_TOLERANCE_SECONDS) {
    return { ok: false, error: "STALE_SIGNATURE" };
  }

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  if (!safeCompareHex(signatureHeader, expected)) {
    return { ok: false, error: "BAD_SIGNATURE" };
  }

  return { ok: true };
}

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

function normalizeEventType(value: unknown): ArmaXpEventType | null {
  const eventType = cleanString(value, 32).toUpperCase();
  return VALID_EVENT_TYPES.has(eventType) ? (eventType as ArmaXpEventType) : null;
}

function normalizeTargetCategory(value: unknown) {
  return cleanString(value, 64).toUpperCase() || "UNKNOWN";
}

function normalizeDistanceMeters(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  return Math.max(0, Math.round(value));
}

function makeEventUid(payload: ArmaXpPayload, steamId: string) {
  if (payload.eventId && cleanString(payload.eventId, 160)) {
    return cleanString(payload.eventId, 160);
  }

  const source = JSON.stringify([
    payload.eventType,
    payload.serverId,
    payload.missionId,
    payload.occurredAt,
    steamId,
    payload.attackerSteamId || "",
    payload.victimSteamId || "",
    payload.targetCategory || "",
    payload.targetClass || "",
    payload.weaponClass || "",
    payload.distanceMeters ?? "",
    payload.isTeamkill === true,
  ]);

  return createHash("sha256").update(source, "utf8").digest("hex");
}

export function normalizeArmaXpPayload(value: unknown): ArmaXpValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "INVALID_JSON" };
  }

  const input = value as Record<string, unknown>;
  const eventType = normalizeEventType(input.eventType);

  if (!eventType) {
    return { ok: false, error: "INVALID_EVENT_TYPE" };
  }

  const serverId = cleanString(input.serverId, 80);
  const missionId = cleanString(input.missionId, 160);
  const occurredAt = cleanString(input.occurredAt, 80);
  const occurredAtDate = new Date(occurredAt);

  if (!serverId || !missionId || Number.isNaN(occurredAtDate.getTime())) {
    return { ok: false, error: "INVALID_EVENT_METADATA" };
  }

  const attackerSteamId = cleanOptionalSteamId(input.attackerSteamId);
  const victimSteamId = cleanOptionalSteamId(input.victimSteamId);
  const eventSteamId = cleanOptionalSteamId(input.steamId);
  const steamId = eventType === "DEATH" ? eventSteamId || victimSteamId : attackerSteamId;

  if (!steamId) {
    return {
      ok: false,
      error: eventType === "DEATH" ? "MISSING_PLAYER_STEAM_ID" : "MISSING_ATTACKER_STEAM_ID",
    };
  }

  const payload: ArmaXpPayload = {
    eventId: cleanString(input.eventId, 160) || undefined,
    eventType,
    schemaVersion: typeof input.schemaVersion === "number" ? input.schemaVersion : undefined,
    serverId,
    missionId,
    occurredAt,
    attackerSteamId: attackerSteamId || undefined,
    victimSteamId: victimSteamId || undefined,
    steamId,
    targetCategory: normalizeTargetCategory(input.targetCategory),
    targetClass: cleanString(input.targetClass, 180) || undefined,
    targetDisplayName: cleanString(input.targetDisplayName, 180) || undefined,
    weaponClass: cleanString(input.weaponClass, 180) || undefined,
    distanceMeters: normalizeDistanceMeters(input.distanceMeters),
    isTeamkill: input.isTeamkill === true,
    isAi: typeof input.isAi === "boolean" ? input.isAi : undefined,
  };

  return {
    ok: true,
    event: {
      ...payload,
      eventType,
      serverId,
      missionId,
      occurredAt,
      eventUid: makeEventUid(payload, steamId),
      steamId,
      occurredAtDate,
      targetCategory: payload.targetCategory || "UNKNOWN",
      isTeamkill: payload.isTeamkill === true,
    },
  };
}

export function calculateArmaXpDelta(event: NormalizedArmaXpEvent) {
  if (event.eventType === "DEATH") {
    return ARMA_DEATH_XP_PENALTY;
  }

  if (event.eventType === "KILL") {
    if (event.isTeamkill) {
      return ARMA_TEAMKILL_XP_PENALTY;
    }

    if (event.victimSteamId && event.victimSteamId === event.attackerSteamId) {
      return 0;
    }

    return ARMA_XP_VALUES[event.targetCategory as keyof typeof ARMA_XP_VALUES] ?? 0;
  }

  if (event.eventType === "OBJECTIVE") {
    return 100;
  }

  if (event.eventType === "MISSION_COMPLETE") {
    return 75;
  }

  return 0;
}
