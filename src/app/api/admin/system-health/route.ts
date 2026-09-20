import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requirePageAccess } from "@/lib/route-permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await requirePageAccess(request, "admin.system-health", "read").catch(() => null))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const pool = getPostgresPool();
    const [database, jobs, outbox, outboxIssues, updater, xp] = await Promise.all([
      pool.query(`select current_database() database, current_user role,
        current_setting('server_version') version, now() server_time`),
      pool.query(`select distinct on (job_name) job_name,status,started_at,completed_at,error_message
        from public.system_job_runs order by job_name,completed_at desc`),
      pool.query(`select status,count(*)::integer count,min(created_at) oldest,
        max(processed_at) last_processed from public.discord_role_outbox group by status`),
      pool.query(`select id,event_type,status,attempt_count,last_error,created_at,updated_at,available_at
        from public.discord_role_outbox
        where status in ('dead','pending','processing')
        order by case status when 'dead' then 0 when 'processing' then 1 else 2 end,
                 updated_at desc
        limit 100`),
      pool.query(`select status,stage,message,updated_at,completed_at,target_commit
        from public.website_update_jobs order by requested_at desc limit 1`),
      pool.query(`select max(last_event_at) last_event_at,count(*) filter(where total_xp>0)::integer active_profiles
        from public.personnel_xp_profiles`),
    ]);
    return NextResponse.json({
      checkedAt: new Date().toISOString(), database: database.rows[0], scheduledJobs: jobs.rows,
      discordOutbox: outbox.rows, discordOutboxIssues: outboxIssues.rows,
      updater: updater.rows[0] || null, xp: xp.rows[0],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[system-health] Check failed", error);
    return NextResponse.json({ error: "System health check failed" }, { status: 500 });
  }
}
