#!/usr/bin/env node

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const EVENT_MARKER = "[101st Tracker] EVENT";
const DEFAULT_INGEST_URL = "https://101stdoombattalion.com/api/arma/xp-event";

function loadDotEnv(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const equalsIndex = trimmed.indexOf("=");

    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalsIndex).trim();
    let value = trimmed.slice(equalsIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function boolFromEnv(value, fallback) {
  if (value === undefined || value === "") {
    return fallback;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function numberFromEnv(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConfig() {
  loadDotEnv(path.join(__dirname, ".env"));
  loadDotEnv(process.env.ARMA_XP_BRIDGE_ENV_FILE);

  const rptPath = process.env.ARMA_XP_BRIDGE_RPT_PATH;
  const ingestUrl = process.env.ARMA_XP_INGEST_URL || DEFAULT_INGEST_URL;
  const secret = process.env.ARMA_XP_INGEST_SECRET;
  const statePath =
    process.env.ARMA_XP_BRIDGE_STATE_PATH || path.join(__dirname, "bridge-state.json");

  if (!rptPath) {
    throw new Error("Missing ARMA_XP_BRIDGE_RPT_PATH");
  }

  if (!secret) {
    throw new Error("Missing ARMA_XP_INGEST_SECRET");
  }

  return {
    rptPath,
    ingestUrl,
    secret,
    statePath,
    pollMs: numberFromEnv(process.env.ARMA_XP_BRIDGE_POLL_MS, 1000),
    retryMs: numberFromEnv(process.env.ARMA_XP_BRIDGE_RETRY_MS, 5000),
    startAtEnd: boolFromEnv(process.env.ARMA_XP_BRIDGE_START_AT_END, true),
    dryRun: boolFromEnv(process.env.ARMA_XP_BRIDGE_DRY_RUN, false),
  };
}

function loadState(statePath) {
  try {
    return JSON.parse(fs.readFileSync(statePath, "utf8"));
  } catch {
    return {
      files: {},
    };
  }
}

function saveState(statePath, state) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
}

function decodeArmaRptPayload(line) {
  const markerIndex = line.indexOf(EVENT_MARKER);

  if (markerIndex === -1) {
    return null;
  }

  let payload = line.slice(markerIndex + EVENT_MARKER.length).trim();

  if (payload.startsWith('"') && payload.endsWith('"')) {
    payload = payload.slice(1, -1);
  }

  payload = payload.replace(/""/g, '"').trim();

  if (!payload.startsWith("{") || !payload.endsWith("}")) {
    throw new Error(`Tracker event did not contain a JSON object: ${payload.slice(0, 120)}`);
  }

  return payload;
}

function signPayload(secret, timestamp, rawBody) {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
}

async function postEvent(config, rawBody) {
  const parsed = JSON.parse(rawBody);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signPayload(config.secret, timestamp, rawBody);

  if (config.dryRun) {
    console.log("[bridge] DRY RUN", {
      eventType: parsed.eventType,
      attackerSteamId: parsed.attackerSteamId,
      steamId: parsed.steamId,
      targetCategory: parsed.targetCategory,
    });
    return { accepted: true, dryRun: true };
  }

  const response = await fetch(config.ingestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-101ST-Timestamp": String(timestamp),
      "X-101ST-Signature": signature,
    },
    body: rawBody,
  });

  let responseBody = null;

  try {
    responseBody = await response.json();
  } catch {
    responseBody = { error: await response.text() };
  }

  if (!response.ok) {
    const error = new Error(`Website returned HTTP ${response.status}`);
    error.responseBody = responseBody;
    throw error;
  }

  return responseBody;
}

function readNewText(filePath, start, endExclusive) {
  if (endExclusive <= start) {
    return "";
  }

  const fd = fs.openSync(filePath, "r");

  try {
    const size = endExclusive - start;
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, start);
    return buffer.toString("utf8");
  } finally {
    fs.closeSync(fd);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run() {
  const config = getConfig();
  const state = loadState(config.statePath);
  const fileKey = path.resolve(config.rptPath).toLowerCase();
  let pendingText = "";

  console.log("[bridge] Starting Arma XP bridge");
  console.log("[bridge] RPT:", config.rptPath);
  console.log("[bridge] Ingest:", config.ingestUrl);
  console.log("[bridge] State:", config.statePath);

  while (true) {
    try {
      if (!fs.existsSync(config.rptPath)) {
        console.warn("[bridge] Waiting for RPT file...");
        await sleep(config.pollMs);
        continue;
      }

      const stats = fs.statSync(config.rptPath);
      let offset = state.files[fileKey]?.offset;

      if (typeof offset !== "number") {
        offset = config.startAtEnd ? stats.size : 0;
      }

      if (stats.size < offset) {
        console.log("[bridge] RPT file was rotated or truncated; restarting at beginning");
        offset = 0;
        pendingText = "";
      }

      const nextText = readNewText(config.rptPath, offset, stats.size);
      let nextOffset = stats.size;

      if (!nextText) {
        state.files[fileKey] = { offset, updatedAt: new Date().toISOString() };
        saveState(config.statePath, state);
        await sleep(config.pollMs);
        continue;
      }

      pendingText += nextText;
      const lines = pendingText.split(/\r?\n/);
      pendingText = lines.pop() || "";

      for (const line of lines) {
        const rawBody = decodeArmaRptPayload(line);

        if (!rawBody) {
          continue;
        }

        while (true) {
          try {
            const result = await postEvent(config, rawBody);
            console.log("[bridge] Sent", {
              accepted: result.accepted,
              duplicate: result.duplicate,
              reason: result.reason,
              eventType: result.eventType,
              xpDelta: result.xpDelta,
              xpTotal: result.xpTotal,
              currentLevel: result.currentLevel,
            });
            break;
          } catch (error) {
            console.error("[bridge] Send failed; retrying", {
              message: error.message,
              responseBody: error.responseBody,
            });
            await sleep(config.retryMs);
          }
        }
      }

      state.files[fileKey] = {
        offset: nextOffset,
        updatedAt: new Date().toISOString(),
      };
      saveState(config.statePath, state);
    } catch (error) {
      console.error("[bridge] Loop failed; retrying", {
        message: error.message,
      });
      await sleep(config.retryMs);
    }
  }
}

run().catch((error) => {
  console.error("[bridge] Fatal error:", error);
  process.exit(1);
});
