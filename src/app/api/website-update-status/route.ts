import { NextResponse } from "next/server";
import { getPostgresPool } from "@/lib/postgres/pool";
import { updateStageProgress, type PublicUpdateJob } from "@/lib/website-update-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type UpdateJobRow = {
  id: string;
  status: PublicUpdateJob["status"];
  stage: string;
  message: string | null;
  requested_at: Date;
  completed_at: Date | null;
  updated_at: Date;
};

let statusCache: { expiresAt: number; body: { active: boolean; job: PublicUpdateJob | null; serverTime: string } } | null = null;

export async function GET() {
  if (statusCache && statusCache.expiresAt > Date.now()) {
    return NextResponse.json(statusCache.body, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    });
  }
  try {
    const result = await getPostgresPool().query<UpdateJobRow>(`select id,status,stage,message,
        requested_at,completed_at,updated_at
      from public.website_update_jobs
      where status in ('pending','running')
         or completed_at > now() - interval '10 minutes'
      order by requested_at desc limit 1`);
    const row = result.rows[0] || null;
    const job = row
      ? {
          id: row.id,
          status: row.status,
          stage: row.stage,
          message: row.message || "Website update is being prepared",
          progress: updateStageProgress(row.stage, row.status),
          requestedAt: row.requested_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
          completedAt: row.completed_at?.toISOString() || null,
        }
      : null;

    const body = {
      active: Boolean(job && ["pending", "running"].includes(job.status)),
      job,
      serverTime: new Date().toISOString(),
    };
    statusCache = { expiresAt: Date.now() + 1_000, body };
    return NextResponse.json(
      body,
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    );
  } catch (error) {
    console.error("[website-update-status] Read failed", error);
    return NextResponse.json(
      { active: false, job: null, error: "Update status is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
