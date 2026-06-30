import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "crypto";

export const DISCORD_CODE_EXPIRY_SECONDS = 10 * 60;
export const DISCORD_MAX_ATTEMPTS = 5;
export const DISCORD_RESEND_COOLDOWN_SECONDS = 60;

export type DiscordDeliveryPayload = {
  type: "steam_link_verification";
  discordUserId: string;
  code: string;
  expiresInSeconds: number;
  personnel: {
    id: string;
    name: string;
  };
  steam: {
    id: string;
    displayName: string | null;
  };
};

export type DiscordDeliveryResult =
  | {
      accepted: true;
    }
  | {
      accepted: false;
      code: "BOT_NOT_CONFIGURED" | "BOT_DELIVERY_FAILED";
      message: string;
    };

function requirePepper() {
  const pepper = process.env.DISCORD_VERIFICATION_PEPPER?.trim();

  if (!pepper) {
    throw new Error("Missing required environment variable: DISCORD_VERIFICATION_PEPPER");
  }

  return pepper;
}

export function generateDiscordVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function normalizeDiscordVerificationCode(code: string) {
  return code.replace(/\D/g, "").slice(0, 6);
}

export function hashDiscordVerificationCode(code: string) {
  return createHmac("sha256", requirePepper())
    .update(normalizeDiscordVerificationCode(code), "utf8")
    .digest("hex");
}

export function compareDiscordCodeHash(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function signDiscordDelivery(timestamp: number, rawBody: string) {
  const secret = process.env.DISCORD_BOT_SHARED_SECRET?.trim();

  if (!secret) {
    throw new Error("Missing Discord bot shared secret");
  }

  return createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

function sanitizeDeliveryError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.slice(0, 180);
  }

  return "Discord bot delivery failed";
}

export async function deliverDiscordVerificationCode(
  payload: DiscordDeliveryPayload,
): Promise<DiscordDeliveryResult> {
  const url = process.env.DISCORD_BOT_VERIFICATION_URL?.trim();
  const secret = process.env.DISCORD_BOT_SHARED_SECRET?.trim();

  if (!url || !secret) {
    return {
      accepted: false,
      code: "BOT_NOT_CONFIGURED",
      message: "Discord verification delivery is not configured.",
    };
  }

  try {
    const rawBody = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = signDiscordDelivery(timestamp, rawBody);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-101ST-Timestamp": String(timestamp),
        "X-101ST-Signature": signature,
      },
      body: rawBody,
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        accepted: false,
        code: "BOT_DELIVERY_FAILED",
        message: `Discord bot returned HTTP ${response.status}`,
      };
    }

    const body = (await response.json()) as { accepted?: boolean };

    if (body.accepted !== true) {
      return {
        accepted: false,
        code: "BOT_DELIVERY_FAILED",
        message: "Discord bot did not accept the verification request.",
      };
    }

    return { accepted: true };
  } catch (error) {
    return {
      accepted: false,
      code: "BOT_DELIVERY_FAILED",
      message: sanitizeDeliveryError(error),
    };
  }
}
