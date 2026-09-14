import "server-only";
import { timingSafeEqual } from "crypto";
import { withPostgresTransaction } from "./postgres/pool";

const MAX_BATCH_SIZE = 10;
const MAX_ATTEMPTS = 5;
const WORKER_PATTERN = /^[a-zA-Z0-9._:-]{3,100}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type DiscordOutboxAction = "claim" | "complete" | "fail";

export function authorizeDiscordOutbox(header: string | null) {
  const expected = process.env.WEBSITE_BOT_SECRET?.trim();
  const supplied = header?.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected || expected.length < 32 || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

function requireWorker(value: unknown) {
  if (typeof value !== "string" || !WORKER_PATTERN.test(value)) {
    throw new Error("INVALID_WORKER");
  }
  return value;
}

function requireEventId(value: unknown) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    throw new Error("INVALID_EVENT_ID");
  }
  return value;
}

export async function claimDiscordOutbox(workerValue: unknown, limitValue: unknown) {
  const worker = requireWorker(workerValue);
  const parsedLimit = typeof limitValue === "number" ? Math.trunc(limitValue) : 1;
  const limit = Math.min(Math.max(parsedLimit, 1), MAX_BATCH_SIZE);

  return withPostgresTransaction(async (client) => {
    await client.query(`
      update public.discord_role_outbox
      set status = 'pending', locked_at = null, locked_by = null, updated_at = now()
      where status = 'processing'
        and locked_at < now() - interval '5 minutes'
        and attempt_count < $1
    `, [MAX_ATTEMPTS]);
    await client.query(`
      update public.discord_role_outbox
      set status = 'dead', locked_at = null, locked_by = null,
          last_error = coalesce(last_error, 'Worker lease expired after maximum attempts'),
          updated_at = now()
      where status = 'processing'
        and locked_at < now() - interval '5 minutes'
        and attempt_count >= $1
    `, [MAX_ATTEMPTS]);

    const result = await client.query(`
      with candidates as (
        select id
        from public.discord_role_outbox
        where status = 'pending' and available_at <= now()
        order by available_at, created_at
        for update skip locked
        limit $1
      )
      update public.discord_role_outbox outbox
      set status = 'processing', attempt_count = attempt_count + 1,
          locked_at = now(), locked_by = $2, updated_at = now()
      from candidates
      where outbox.id = candidates.id
      returning outbox.id, outbox.event_type as "eventType",
                outbox.payload, outbox.attempt_count as "attemptCount"
    `, [limit, worker]);
    return result.rows;
  });
}

function requireDiscordRoleIds(value: unknown) {
  if (!Array.isArray(value) || value.length > 250) throw new Error("INVALID_IMPORT_RESULT");
  const roleIds = [...new Set(value.map((roleId) => String(roleId)))];
  if (roleIds.some((roleId) => !/^\d{17,20}$/.test(roleId))) {
    throw new Error("INVALID_IMPORT_RESULT");
  }
  return roleIds;
}

export async function completeDiscordOutbox(
  workerValue: unknown,
  eventIdValue: unknown,
  resultValue?: unknown,
) {
  const worker = requireWorker(workerValue);
  const eventId = requireEventId(eventIdValue);
  return withPostgresTransaction(async (client) => {
    const claimed = await client.query<{event_type:string;payload:Record<string,unknown>}>(`
      select event_type, payload
      from public.discord_role_outbox
      where id = $1 and status = 'processing' and locked_by = $2
      for update
    `, [eventId, worker]);
    if (!claimed.rows[0]) return false;

    if (claimed.rows[0].event_type === "USER_FULL_IMPORT") {
      const personnelId = claimed.rows[0].payload.personnelId;
      if (typeof personnelId !== "string" || !UUID_PATTERN.test(personnelId)) {
        throw new Error("INVALID_IMPORT_EVENT");
      }
      const result = resultValue && typeof resultValue === "object"
        ? resultValue as Record<string, unknown>
        : null;
      const roleIds = requireDiscordRoleIds(result?.discordRoleIds);
      const rank = await client.query<{id:string}>(`
        select id from public.ranks
        where discord_role_id = any($1::text[])
        order by rank_level desc
        limit 1
      `, [roleIds]);
      await client.query("update public.personnel set rank_id=$2 where id=$1", [
        personnelId,
        rank.rows[0]?.id || null,
      ]);
      await client.query(`
        insert into public.personnel_certifications(personnel_id, certification_id, awarded_at)
        select $1, id, now()
        from public.certifications
        where cert_id = any($2::text[])
        on conflict (personnel_id, certification_id) do nothing
      `, [personnelId, roleIds]);
    }

    const completed = await client.query(`
      update public.discord_role_outbox
      set status = 'succeeded', processed_at = now(), locked_at = null,
          locked_by = null, last_error = null, updated_at = now(),
          payload = case
              when event_type = 'ACCOUNT_CREDENTIALS_DM' then '{}'::jsonb
              else payload
            end
      where id = $1 and status = 'processing' and locked_by = $2
      returning id
    `, [eventId, worker]);
    return completed.rowCount === 1;
  });
}

export async function failDiscordOutbox(
  workerValue: unknown,
  eventIdValue: unknown,
  errorValue: unknown,
) {
  const worker = requireWorker(workerValue);
  const eventId = requireEventId(eventIdValue);
  const message = typeof errorValue === "string"
    ? errorValue.replace(/[\r\n]+/g, " ").slice(0, 500)
    : "Discord role update failed";
  const result = await withPostgresTransaction((client) => client.query(`
    update public.discord_role_outbox
    set status = case when attempt_count >= $3 then 'dead' else 'pending' end,
        available_at = case
          when attempt_count >= $3 then available_at
          else now() + make_interval(secs => least(300, 5 * (2 ^ attempt_count))::integer)
        end,
        locked_at = null, locked_by = null, last_error = $4, updated_at = now()
    where id = $1 and status = 'processing' and locked_by = $2
    returning id, status
  `, [eventId, worker, MAX_ATTEMPTS, message]));
  return result.rows[0] || null;
}
