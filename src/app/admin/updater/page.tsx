"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  Download,
  GitBranch,
  Loader2,
  RefreshCw,
  Server,
  TriangleAlert,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Release = {
  sha: string;
  shortSha: string;
  message: string;
  committedAt: string | null;
  version: string;
  branch?: string;
  clean?: boolean;
};

type UpdateJob = {
  id: string;
  requested_by_name: string;
  from_commit: string;
  target_commit: string;
  status: "pending" | "running" | "succeeded" | "failed";
  stage: string;
  message: string | null;
  requested_at: string;
  completed_at: string | null;
  updated_at: string;
};

type UpdaterStatus = {
  installed: Release;
  available: Release;
  updateAvailable: boolean;
  canInstall: boolean;
  updaterEnabled: boolean;
  job: UpdateJob | null;
  server: { node: string; platform: string; timezone: string; now: string };
};

const dateTime = (value: string | null) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
  : "Not available";

export default function UpdaterPage() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loading, setLoading] = useState(true);
  const [installing, setInstalling] = useState(false);
  const [status, setStatus] = useState<UpdaterStatus | null>(null);
  const [error, setError] = useState("");

  const loadStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/updater", {
        cache: "no-store",
        headers: await getAppAuthHeaders(),
      });
      const body = await response.json().catch(() => null) as UpdaterStatus & { error?: string } | null;
      if (!response.ok || !body) throw new Error(body?.error || "Unable to load updater status");
      setStatus(body);
      setError("");
      if (!body.job || !["pending", "running"].includes(body.job.status)) setInstalling(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load updater status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session) return router.replace("/login");
      if (!hasAppPermission(session, "admin.updater", "read")) return router.replace("/");
      setLoadingAuth(false);
      await loadStatus();
    })();
  }, [loadStatus, router]);

  useEffect(() => {
    const jobActive = Boolean(status?.job && ["pending", "running"].includes(status.job.status));
    if (!installing && !jobActive) return;
    const timer = window.setInterval(() => void loadStatus(), 5_000);
    return () => window.clearInterval(timer);
  }, [installing, loadStatus, status?.job]);

  async function installUpdate() {
    if (!status?.canInstall || installing) return;
    if (!window.confirm(`Install ${status.available.version} (${status.available.shortSha})? The website will briefly go offline.`)) return;
    setInstalling(true);
    setError("");
    const response = await fetch("/api/admin/updater", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify({ targetCommit: status.available.sha }),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    if (!response.ok) {
      setInstalling(false);
      setError(body?.error || "Unable to queue website update");
      return;
    }
    await loadStatus();
  }

  if (loadingAuth) {
    return <main className="min-h-screen bg-[#020806] px-6 py-24 text-[#00ff66]">Checking access...</main>;
  }

  const active = status?.job && ["pending", "running"].includes(status.job.status);
  const healthy = status && !status.updateAvailable && status.job?.status !== "failed";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#020806] px-4 py-10 text-white sm:px-6 lg:px-10">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <section className="relative mx-auto max-w-7xl border border-[#00ff66]/20 bg-black/75 shadow-[0_0_50px_rgba(0,255,102,0.08)]">
        <header className="flex flex-col gap-6 border-b border-[#00ff66]/15 p-6 lg:flex-row lg:items-center lg:justify-between lg:p-8">
          <div className="flex items-start gap-4">
            <div className="grid h-14 w-14 shrink-0 place-items-center border border-[#00ff66]/30 bg-[#00ff66]/10 text-[#00ff66]">
              <Server size={27} />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-black uppercase tracking-[0.12em] sm:text-3xl">Website Updater</h1>
                <StatusBadge active={Boolean(active)} healthy={Boolean(healthy)} failed={status?.job?.status === "failed"} />
              </div>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-400">
                Compare the installed release with the approved main branch and monitor controlled deployments.
              </p>
            </div>
          </div>
          <button type="button" onClick={() => void loadStatus()} disabled={loading || Boolean(active)}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#00ff66]/30 bg-[#00ff66]/8 px-5 text-sm font-bold uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/15 disabled:cursor-not-allowed disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={17} /> : <RefreshCw size={17} />}
            Check Again
          </button>
        </header>

        <div className="p-6 lg:p-8">
          {error && <div className="mb-6 flex items-start gap-3 border border-red-400/35 bg-red-500/10 p-4 text-sm text-red-200"><TriangleAlert size={19} />{error}</div>}

          {status?.updateAvailable ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
              <ReleasePanel label="Installed Release" release={status.installed} />
              <div className="hidden items-center text-[#00ff66]/60 lg:flex"><ArrowRight size={26} /></div>
              <ReleasePanel label="Available Release" release={status.available} />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
              <ReleasePanel label="Current Installed Release" release={status?.installed} />
              <div className="flex items-center gap-3 border border-[#00ff66]/25 bg-[#00ff66]/8 p-5 text-[#00ff66]">
                <CheckCircle2 size={24} />
                <div>
                  <div className="font-black uppercase tracking-[0.12em]">Repository Matched</div>
                  <div className="mt-1 text-sm text-gray-300">The installed commit matches origin/main.</div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6 grid gap-4 border border-[#00ff66]/15 bg-[#03110b]/75 p-5 sm:grid-cols-2 lg:grid-cols-4">
            <Detail icon={<Code2 size={17} />} label="Database" value="PostgreSQL 16" />
            <Detail icon={<Server size={17} />} label="Node / Platform" value={status ? `${status.server.node} / ${status.server.platform}` : "Loading"} />
            <Detail icon={<Clock3 size={17} />} label="Server Timezone" value={status?.server.timezone || "Loading"} />
            <Detail icon={<GitBranch size={17} />} label="Working Tree" value={status?.installed.clean ? "Clean" : "Changes detected"} warning={status?.installed.clean === false} />
          </div>

          <div className={`mt-6 border p-5 ${status?.job?.status === "failed" ? "border-red-400/35 bg-red-500/10" : active ? "border-cyan-400/35 bg-cyan-400/10" : "border-[#00ff66]/30 bg-[#00ff66]/8"}`}>
            <div className="flex items-start gap-3">
              {active ? <Loader2 className="mt-0.5 animate-spin text-cyan-300" size={21} /> : status?.job?.status === "failed" ? <TriangleAlert className="mt-0.5 text-red-300" size={21} /> : <CheckCircle2 className="mt-0.5 text-[#00ff66]" size={21} />}
              <div>
                <div className="font-bold">{active ? `Update ${status?.job?.stage || "queued"}` : status?.updateAvailable ? "A newer release is available" : "This server is running the latest release"}</div>
                <div className="mt-1 text-sm text-gray-300">{status?.job?.message || (status?.updateAvailable ? "A full-permission updater may approve installation." : "No deployment action is required.")}</div>
                {status?.job && <div className="mt-2 text-xs uppercase tracking-[0.12em] text-gray-500">Last activity {dateTime(status.job.updated_at)} by {status.job.requested_by_name}</div>}
              </div>
            </div>
          </div>

          <footer className="mt-6 flex flex-col gap-5 border-t border-[#00ff66]/15 pt-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl text-sm leading-6 text-gray-400">
              Installation briefly stops the website, creates a verified PostgreSQL backup, fast-forwards to the approved commit, installs dependencies, applies migrations, builds, and restarts the site.
            </div>
            <button type="button" onClick={installUpdate}
              disabled={!status?.canInstall || !status?.updateAvailable || !status?.updaterEnabled || Boolean(active) || installing || !status?.installed.clean}
              title={!status?.canInstall ? "Full Updater permission is required" : undefined}
              className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/15 px-6 font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/25 disabled:cursor-not-allowed disabled:border-white/10 disabled:bg-white/[0.03] disabled:text-gray-600">
              {installing || active ? <Loader2 className="animate-spin" size={18} /> : <Download size={18} />}
              Install Update
            </button>
          </footer>
        </div>
      </section>
    </main>
  );
}

function ReleasePanel({ label, release }: { label: string; release?: Release }) {
  return <div className="min-h-52 border border-[#00ff66]/15 bg-[#03110b]/65 p-5">
    <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7f9f8f]">{label}</div>
    <div className="mt-4 text-3xl font-black text-white">{release?.version || "Checking"}</div>
    <div className="mt-1 font-mono text-sm text-cyan-300">{release?.shortSha || "-------"}</div>
    <div className="mt-5 text-sm leading-6 text-gray-200">{release?.message || "Loading release details..."}</div>
    <div className="mt-3 text-xs text-gray-500">{dateTime(release?.committedAt || null)}</div>
    {release?.branch && <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-[#00ff66]"><GitBranch size={14} />{release.branch}</div>}
  </div>;
}

function Detail({ icon, label, value, warning }: { icon: React.ReactNode; label: string; value: string; warning?: boolean }) {
  return <div><div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#7f9f8f]">{icon}{label}</div><div className={`mt-2 text-sm font-bold ${warning ? "text-amber-300" : "text-white"}`}>{value}</div></div>;
}

function StatusBadge({ active, healthy, failed }: { active: boolean; healthy: boolean; failed: boolean }) {
  const style = failed ? "border-red-400/35 bg-red-500/10 text-red-300" : active ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-300" : healthy ? "border-[#00ff66]/30 bg-[#00ff66]/10 text-[#00ff66]" : "border-amber-300/35 bg-amber-300/10 text-amber-200";
  return <span className={`border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${style}`}>{failed ? "Attention" : active ? "Updating" : healthy ? "Up to date" : "Update available"}</span>;
}
