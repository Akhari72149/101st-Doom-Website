"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createDiscordOutboxWorker } = require("./discord-outbox-worker");

test("claims, applies and completes a certificate role event", async () => {
  const requests = [];
  const added = [];
  const member = {
    roles: {
      cache: new Map(),
      add: async (role) => added.push(role),
      remove: async () => {},
      set: async () => {},
    },
  };
  const client = {
    guilds: {
      fetch: async () => ({ members: { fetch: async () => member } }),
    },
  };
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const result = body.action === "claim"
      ? {
          events: [{
            id: "3d2fb67a-91e1-4b2b-82b8-639ad3d6b983",
            eventType: "CERT_ROLE_SYNC",
            attemptCount: 1,
            payload: {
              discordId: "76561198192344539",
              roleId: "1165712538047090688",
              action: "assign",
            },
          }],
        }
      : { completed: true };
    return { ok: true, status: 200, json: async () => result };
  };
  const logger = { log() {}, error() {} };
  const worker = createDiscordOutboxWorker({
    client,
    endpoint: "https://example.invalid/api/internal/discord-outbox",
    secret: "test-secret",
    guildId: "445933549816774656",
    workerId: "test-worker",
    fetchImpl,
    logger,
  });

  await worker.poll();

  assert.deepEqual(added, ["1165712538047090688"]);
  assert.deepEqual(requests.map((request) => request.action), ["claim", "complete"]);
});

test("reports invalid events as failures", async () => {
  const requests = [];
  const fetchImpl = async (_url, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    const result = body.action === "claim"
      ? {
          events: [{
            id: "3d2fb67a-91e1-4b2b-82b8-639ad3d6b983",
            eventType: "CERT_ROLE_SYNC",
            attemptCount: 1,
            payload: { discordId: "invalid", roleId: "invalid", action: "assign" },
          }],
        }
      : { event: { status: "pending" } };
    return { ok: true, status: 200, json: async () => result };
  };
  const worker = createDiscordOutboxWorker({
    client: { guilds: { fetch: async () => { throw new Error("not reached"); } } },
    endpoint: "https://example.invalid/api/internal/discord-outbox",
    secret: "test-secret",
    guildId: "445933549816774656",
    workerId: "test-worker",
    fetchImpl,
    logger: { log() {}, error() {} },
  });

  await worker.poll();

  assert.deepEqual(requests.map((request) => request.action), ["claim", "fail"]);
  assert.match(requests[1].error, /Invalid discordId/);
});
