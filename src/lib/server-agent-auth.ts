import "server-only";
import { timingSafeEqual } from "crypto";

function equalSecret(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function authorizeServerAgent(authorization: string | null) {
  const expected = String(process.env.SERVER_AGENT_TOKEN || "").trim();
  const provided = String(authorization || "").replace(/^Bearer\s+/i, "").trim();
  return expected.length >= 32 && provided.length >= 32 && equalSecret(provided, expected);
}

export function configuredServerAgentId() {
  return String(process.env.SERVER_AGENT_ID || "arma-primary").trim().toLowerCase();
}

