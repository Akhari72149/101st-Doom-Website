import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { authorizeServerAgent, configuredServerAgentId } from "@/lib/server-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPTIONS = { headers: { "Cache-Control": "no-store" } };
const AGENT_ID = /^[a-z0-9][a-z0-9_-]{1,63}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Body = {
  action?: unknown;
  agentId?: unknown;
  displayName?: unknown;
  version?: unknown;
  details?: unknown;
  jobId?: unknown;
  claimToken?: unknown;
  level?: unknown;
  message?: unknown;
  result?: unknown;
  error?: unknown;
};

function cleanAgentId(value: unknown) {
  const id = String(value || "").trim().toLowerCase();
  return AGENT_ID.test(id) ? id : "";
}

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

async function verifyAgent(body: Body) {
  const agentId = cleanAgentId(body.agentId);
  return agentId && agentId === configuredServerAgentId() ? agentId : "";
}

export async function POST(request: Request) {
  if (!authorizeServerAgent(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401, ...OPTIONS });
  }

  const body = await request.json().catch(() => null) as Body | null;
  if (!body) return NextResponse.json({ error: "INVALID_JSON" }, { status: 400, ...OPTIONS });
  const agentId = await verifyAgent(body);
  if (!agentId) return NextResponse.json({ error: "INVALID_AGENT" }, { status: 403, ...OPTIONS });

  try {
    if (body.action === "heartbeat") {
      const displayName = String(body.displayName || "Arma Server Agent").trim().slice(0, 120);
      const version = String(body.version || "unknown").trim().slice(0, 40);
      await getPostgresPool().query(
        `insert into public.server_control_agents(id,display_name,version,status,details,last_seen_at,updated_at)
         values($1,$2,$3,'online',$4::jsonb,now(),now())
         on conflict(id) do update set display_name=excluded.display_name,version=excluded.version,
           status='online',details=excluded.details,last_seen_at=now(),updated_at=now()`,
        [agentId, displayName || "Arma Server Agent", version, JSON.stringify(jsonObject(body.details))],
      );
      return NextResponse.json({ ok: true, serverTime: new Date().toISOString() }, OPTIONS);
    }

    if (body.action === "claim") {
      const job = await withPostgresTransaction(async (client) => {
        await client.query(
          `update public.server_control_jobs set status='pending',claimed_by=null,claim_token=null,
             error_message='Recovered after the previous agent claim expired.',updated_at=now()
           where agent_id=$1 and status='processing' and updated_at < now()-interval '30 minutes'`,
          [agentId],
        );
        const token = randomUUID();
        const claimed = await client.query(
          `with next_job as (
             select id from public.server_control_jobs
             where agent_id=$1 and status='pending'
             order by requested_at for update skip locked limit 1
           )
           update public.server_control_jobs jobs
              set status='processing',claimed_by=$1,claim_token=$2,attempts=attempts+1,
                  started_at=coalesce(started_at,now()),updated_at=now()
             from next_job where jobs.id=next_job.id
           returning jobs.id,jobs.server_id,jobs.action,jobs.payload,jobs.claim_token,jobs.attempts`,
          [agentId, token],
        );
        if (claimed.rowCount) {
          await client.query("update public.server_control_agents set status='busy',last_seen_at=now(),updated_at=now() where id=$1", [agentId]);
        }
        return claimed.rows[0] || null;
      });
      return NextResponse.json({ job }, OPTIONS);
    }

    const jobId = String(body.jobId || "");
    const claimToken = String(body.claimToken || "");
    if (!UUID.test(jobId) || !UUID.test(claimToken)) {
      return NextResponse.json({ error: "INVALID_JOB" }, { status: 400, ...OPTIONS });
    }

    if (body.action === "log") {
      const level = ["info", "warning", "error"].includes(String(body.level)) ? String(body.level) : "info";
      const message = String(body.message || "").trim().slice(0, 4000);
      if (!message) return NextResponse.json({ error: "INVALID_LOG" }, { status: 400, ...OPTIONS });
      const inserted = await getPostgresPool().query(
        `insert into public.server_control_job_logs(job_id,level,message)
         select id,$4,$5 from public.server_control_jobs
         where id=$1 and agent_id=$2 and claim_token=$3 and status='processing'
         returning id`,
        [jobId, agentId, claimToken, level, message],
      );
      if (!inserted.rowCount) return NextResponse.json({ error: "CLAIM_LOST" }, { status: 409, ...OPTIONS });
      await getPostgresPool().query("update public.server_control_jobs set updated_at=now() where id=$1", [jobId]);
      return NextResponse.json({ ok: true }, OPTIONS);
    }

    if (body.action === "complete" || body.action === "fail") {
      const failed = body.action === "fail";
      const error = failed ? String(body.error || "Agent task failed").trim().slice(0, 2000) : null;
      const completed = await withPostgresTransaction(async (client) => {
        const result = await client.query<{ id: string; requested_by: string | null; action: string; server_id: number | null }>(
          `update public.server_control_jobs set status=$4,result=$5::jsonb,error_message=$6,
             completed_at=now(),updated_at=now(),claim_token=null
           where id=$1 and agent_id=$2 and claim_token=$3 and status='processing'
           returning id,requested_by,action,server_id`,
          [jobId, agentId, claimToken, failed ? "failed" : "succeeded", JSON.stringify(jsonObject(body.result)), error],
        );
        if (result.rowCount) {
          await client.query("update public.server_control_agents set status=$2,last_seen_at=now(),updated_at=now() where id=$1", [agentId, failed ? "error" : "online"]);
          const job = result.rows[0];
          await client.query(
            `insert into public.audit_logs(user_id,action,details)
             values($1,$2,$3)`,
            [job.requested_by, failed ? "SERVER_CONTROL_JOB_FAILED" : "SERVER_CONTROL_JOB_COMPLETED",
              `${job.action} for Server ${job.server_id ?? "n/a"} ${failed ? `failed: ${error}` : "completed successfully"}. Job ${job.id}.`],
          );
        }
        return Boolean(result.rowCount);
      });
      return NextResponse.json({ completed }, { status: completed ? 200 : 409, ...OPTIONS });
    }

    return NextResponse.json({ error: "INVALID_ACTION" }, { status: 400, ...OPTIONS });
  } catch (error) {
    console.error("[server-agent] Request failed", error);
    return NextResponse.json({ error: "AGENT_REQUEST_FAILED" }, { status: 500, ...OPTIONS });
  }
}

