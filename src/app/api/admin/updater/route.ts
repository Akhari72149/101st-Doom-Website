import { NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getPostgresPool } from "@/lib/postgres/pool";
import { requestHasSameOrigin, requirePageAccess } from "@/lib/route-permissions";
import { getAvailableRelease, getInstalledRelease } from "@/lib/website-updater";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const run = promisify(execFile);

type UpdateJob = {
  id: string;
  requested_by_name: string;
  from_commit: string;
  target_commit: string;
  status: "pending" | "running" | "succeeded" | "failed";
  stage: string;
  message: string | null;
  requested_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  updated_at: Date;
};

async function latestJob() {
  const result = await getPostgresPool().query<UpdateJob>(`select id,requested_by_name,
      from_commit,target_commit,status,stage,message,requested_at,started_at,completed_at,updated_at
    from public.website_update_jobs order by requested_at desc limit 1`);
  return result.rows[0] || null;
}

async function wakeUpdaterWorker() {
  if (process.platform !== "win32") return false;
  const taskName = process.env.WEBSITE_UPDATER_TASK_NAME || "101st Doom Website Updater";
  try {
    await run("schtasks.exe", ["/Run", "/TN", taskName], {
      windowsHide: true,
      timeout: 15_000,
    });
    return true;
  } catch (error) {
    console.warn("[updater] Update was queued but the worker task could not be started immediately", error);
    return false;
  }
}

export async function GET(request: Request) {
  const read = await requirePageAccess(request, "admin.updater", "read");
  if (!read) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    const [installed, available, job, full] = await Promise.all([
      getInstalledRelease(),
      getAvailableRelease(),
      latestJob(),
      requirePageAccess(request, "admin.updater", "full"),
    ]);
    return NextResponse.json({
      installed,
      available,
      updateAvailable: installed.sha !== available.sha,
      canInstall: Boolean(full),
      updaterEnabled: process.env.WEBSITE_UPDATER_ENABLED === "true",
      job,
      server: {
        node: process.version,
        platform: `${process.platform} ${process.arch}`,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        now: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("[updater] Status check failed", error);
    return NextResponse.json({ error: "Unable to check website releases" }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!requestHasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  const auth = await requirePageAccess(request, "admin.updater", "full");
  if (!auth) return NextResponse.json({ error: "Full Updater permission is required" }, { status: 403 });
  if (process.env.WEBSITE_UPDATER_ENABLED !== "true") {
    return NextResponse.json({ error: "The external website updater is not enabled" }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { targetCommit?: unknown } | null;
  const approvedTarget = String(body?.targetCommit || "").trim().toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(approvedTarget)) {
    return NextResponse.json({ error: "Invalid approved update" }, { status: 400 });
  }

  try {
    const [installed, available] = await Promise.all([getInstalledRelease(), getAvailableRelease(true)]);
    if (!installed.clean) {
      return NextResponse.json({ error: "The deployed Git working tree is not clean" }, { status: 409 });
    }
    if (installed.sha === available.sha) {
      return NextResponse.json({ error: "The website is already up to date" }, { status: 409 });
    }
    if (approvedTarget !== available.sha) {
      return NextResponse.json({ error: "The available release changed; check again before approving it" }, { status: 409 });
    }
    const result = await getPostgresPool().query<UpdateJob>(`insert into public.website_update_jobs
        (requested_by,requested_by_name,from_commit,target_commit)
      values ($1,$2,$3,$4)
      returning id,requested_by_name,from_commit,target_commit,status,stage,message,
        requested_at,started_at,completed_at,updated_at`, [
      auth.userId,
      auth.email || "Unknown",
      installed.sha,
      available.sha,
    ]);
    const workerTriggered = await wakeUpdaterWorker();
    return NextResponse.json({ queued: true, workerTriggered, job: result.rows[0] }, { status: 202 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      return NextResponse.json({ error: "Another website update is already queued or running" }, { status: 409 });
    }
    console.error("[updater] Queue failed", error);
    return NextResponse.json({ error: "Unable to queue website update" }, { status: 500 });
  }
}
