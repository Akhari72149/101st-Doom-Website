import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const read = await requirePageAccess(request, "admin.system-health", "read").catch(() => null);
  if (!read) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const pool = getPostgresPool();
    const [database, jobs, outbox, outboxIssues, updater, xp, edit, full] = await Promise.all([
      pool.query(`select current_database() database, current_user role,
        current_setting('server_version') version, now() server_time`),
      pool.query(`select distinct on (job_name) job_name,status,started_at,completed_at,error_message
        from public.system_job_runs order by job_name,completed_at desc`),
      pool.query(`select status,count(*)::integer count,min(created_at) oldest,
        max(processed_at) last_processed from public.discord_role_outbox group by status`),
      pool.query(`select outbox.id,outbox.event_type,outbox.status,outbox.attempt_count,
          outbox.last_error,outbox.created_at,outbox.updated_at,outbox.available_at,
          personnel.name personnel_name,personnel.status personnel_status,
          case
            when nullif(coalesce(personnel.discord_id,outbox.payload->>'discordId'), '') is null then null
            else right(coalesce(personnel.discord_id,outbox.payload->>'discordId'), 4)
          end discord_id_suffix
        from public.discord_role_outbox outbox
        left join lateral (
          select linked.name,linked.status,linked.discord_id
          from public.personnel linked
          where linked.id = case
              when coalesce(outbox.payload->>'personnelId','')
                ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
              then (outbox.payload->>'personnelId')::uuid
              else null
            end
            or linked.discord_id = outbox.payload->>'discordId'
          order by (linked.id::text = outbox.payload->>'personnelId') desc
          limit 1
        ) personnel on true
        where outbox.status in ('dead','pending','processing')
        order by case outbox.status when 'dead' then 0 when 'processing' then 1 else 2 end,
                 outbox.updated_at desc
        limit 100`),
      pool.query(`select status,stage,message,updated_at,completed_at,target_commit
        from public.website_update_jobs order by requested_at desc limit 1`),
      pool.query(`select max(last_event_at) last_event_at,count(*) filter(where total_xp>0)::integer active_profiles
        from public.personnel_xp_profiles`),
      requirePageAccess(request, "admin.system-health", "edit").catch(() => null),
      requirePageAccess(request, "admin.system-health", "full").catch(() => null),
    ]);
    return NextResponse.json({
      checkedAt: new Date().toISOString(), database: database.rows[0], scheduledJobs: jobs.rows,
      discordOutbox: outbox.rows, discordOutboxIssues: outboxIssues.rows,
      discordOutboxPermissions: { canRetry: Boolean(edit), canRemove: Boolean(full) },
      updater: updater.rows[0] || null, xp: xp.rows[0],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[system-health] Check failed", error);
    return NextResponse.json({ error: "System health check failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as {
    action?: unknown;
    eventId?: unknown;
  } | null;
  const action = body?.action === "retry" || body?.action === "remove" ? body.action : null;
  const eventId = typeof body?.eventId === "string" ? body.eventId : "";
  if (!action || !UUID_PATTERN.test(eventId)) {
    return NextResponse.json({ error: "Invalid Discord outbox action" }, { status: 400 });
  }

  const requiredAccess = action === "remove" ? "full" : "edit";
  const auth = await requirePageAccess(request, "admin.system-health", requiredAccess).catch(() => null);
  if (!auth) {
    return NextResponse.json({
      error: action === "remove"
        ? "Full System Health permission is required"
        : "Edit System Health permission is required",
    }, { status: 403 });
  }

  try {
    const result = await getPostgresPool().query<{ result: string | null }>(
      "select public.manage_dead_discord_outbox_event($1,$2,$3) result",
      [eventId, action, auth.userId],
    );
    if (!result.rows[0]?.result) {
      return NextResponse.json({ error: "The dead-lettered event no longer exists" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, action: result.rows[0].result });
  } catch (error) {
    console.error("[system-health] Discord outbox action failed", error);
    return NextResponse.json({ error: "Unable to update the Discord delivery queue" }, { status: 500 });
  }
}
