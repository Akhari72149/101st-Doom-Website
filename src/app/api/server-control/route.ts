import { NextResponse } from "next/server";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getPostgresPool, withPostgresTransaction } from "@/lib/postgres/pool";
import { configuredServerAgentId } from "@/lib/server-agent-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LEGACY_COMMAND = /^(start|stop) server ([1-3])$/;
const QUEUED_COMMAND = /^(start|stop|restart|update|update mods|copy keys) server ([1-3])$/;
const ACTIONS: Record<string, string> = {
  start: "server.start",
  stop: "server.stop",
  restart: "server.restart",
  update: "steamcmd.server.update",
  "update mods": "steamcmd.mods.update",
  "copy keys": "mods.keys.copy",
};

function agentEnabled() {
  return process.env.SERVER_CONTROL_AGENT_ENABLED === "true";
}
async function actorName(userId: string, email: string | null) {
  const result = await getPostgresPool().query<{ display_name: string | null }>(
    `select coalesce(nullif("displayUsername",''),nullif(name,''),nullif(username,'')) display_name
       from public.app_auth_users where id=$1`,
    [userId],
  );
  return result.rows[0]?.display_name || email || "Website administrator";
}

export async function GET(request: Request) {
  const auth = await requirePageAccess(request, "admin.server-control", "read").catch(() => null);
  if (!auth) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!agentEnabled()) {
    return NextResponse.json({ mode: "legacy", agent: null, jobs: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const agentId = configuredServerAgentId();
    const [agent, jobs] = await Promise.all([
      getPostgresPool().query(
        `select id,display_name,version,status,details,last_seen_at,
                (last_seen_at is not null and last_seen_at > now()-interval '45 seconds') online
           from public.server_control_agents where id=$1`,
        [agentId],
      ),
      getPostgresPool().query(
        `select jobs.id,jobs.server_id,jobs.action,jobs.status,jobs.requested_by_name,jobs.attempts,
                jobs.error_message,jobs.requested_at,jobs.started_at,jobs.completed_at,jobs.updated_at,
                coalesce((select jsonb_agg(jsonb_build_object('id',logs.id,'level',logs.level,
                  'message',logs.message,'createdAt',logs.created_at) order by logs.id)
                  from (select * from public.server_control_job_logs where job_id=jobs.id order by id desc limit 80) logs),'[]'::jsonb) logs
           from public.server_control_jobs jobs where jobs.agent_id=$1
          order by jobs.requested_at desc limit 25`,
        [agentId],
      ),
    ]);
    return NextResponse.json(
      { mode: "agent", agent: agent.rows[0] || null, jobs: jobs.rows },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[server-control] Status read failed", error);
    return NextResponse.json({ error: "Failed to load server-control activity" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  const body = await request.json().catch(() => null) as { command?: unknown } | null;
  const command = String(body?.command || "").trim().toLowerCase();
  const match = command.match(agentEnabled() ? QUEUED_COMMAND : LEGACY_COMMAND);
  if (!match) return NextResponse.json({ error: "Invalid server command" }, { status: 400 });

  const requiresFull = ["update", "update mods", "copy keys"].includes(match[1]);
  const auth = await requirePageAccess(request, "admin.server-control", requiresFull ? "full" : "edit").catch(() => null);
  if (!auth?.userId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (agentEnabled()) {
    const serverId = Number(match[2]);
    const action = ACTIONS[match[1]];
    try {
      const requestedBy = await actorName(auth.userId, auth.email);
      const job = await withPostgresTransaction(async (client) => {
        await client.query(
          `insert into public.server_control_agents(id,display_name,status)
           values($1,'Primary Arma Server','offline') on conflict(id) do nothing`,
          [configuredServerAgentId()],
        );
        const inserted = await client.query<{ id: string }>(
          `insert into public.server_control_jobs(agent_id,server_id,action,requested_by,requested_by_name)
           values($1,$2,$3,$4,$5) returning id`,
          [configuredServerAgentId(), serverId, action, auth.userId, requestedBy],
        );
        await client.query(
          `insert into public.audit_logs(user_id,action,details)
           values($1,'SERVER_CONTROL_JOB_QUEUED',$2)`,
          [auth.userId, `${requestedBy} queued ${action} for Server ${serverId}. Job ${inserted.rows[0].id}.`],
        );
        return inserted.rows[0];
      });
      return NextResponse.json({ queued: true, jobId: job.id }, { status: 202 });
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return NextResponse.json({ error: `Server ${serverId} already has a pending operation.` }, { status: 409 });
      }
      console.error("[server-control] Queue failed", error);
      return NextResponse.json({ error: "Failed to queue server operation" }, { status: 500 });
    }
  }

  const listenerUrl = process.env.SERVER_CONTROL_LISTENER_URL || "http://199.33.118.13:3001/server";
  try {
    const response = await fetch(listenerUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command }),
      signal: AbortSignal.timeout(10_000),
    });
    const result = await response.text();
    if (!response.ok) return NextResponse.json({ error: "Server listener rejected the command" }, { status: 502 });
    return NextResponse.json({ result });
  } catch (error) {
    console.error("[server-control] Listener request failed", error);
    return NextResponse.json({ error: "Server listener is unavailable" }, { status: 502 });
  }
}
