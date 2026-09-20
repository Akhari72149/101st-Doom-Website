"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Database,
  RefreshCw,
  Send,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type OutboxSummary = {
  status: string;
  count: number;
  oldest: string | null;
  last_processed: string | null;
};

type OutboxIssue = {
  id: string;
  event_type: string;
  status: "dead" | "pending" | "processing";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  available_at: string;
};

type Health = {
  checkedAt: string;
  database: { database: string; role: string; version: string; server_time: string };
  scheduledJobs: Array<{ job_name: string; status: string; completed_at: string; error_message: string | null }>;
  discordOutbox: OutboxSummary[];
  discordOutboxIssues: OutboxIssue[];
  updater: { status: string; stage: string; message: string; updated_at: string } | null;
  xp: { last_event_at: string | null; active_profiles: number };
};

const fmt = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
  : "No recorded activity";

export default function SystemHealthPage() {
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outboxOpen, setOutboxOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/system-health", {
        cache: "no-store",
        headers: await getAppAuthHeaders(),
      });
      const body = await response.json() as Health & { error?: string };
      if (!response.ok) throw new Error(body.error || "Health check failed");
      setHealth(body);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Health check failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.system-health", "read")) {
        router.replace(session ? "/" : "/login");
        return;
      }
      await load();
    })();
  }, [load, router]);

  const outbox = useMemo(
    () => Object.fromEntries((health?.discordOutbox || []).map((row) => [row.status, row])),
    [health],
  );
  const deadCount = Number(outbox.dead?.count || 0);
  const cards = [
    {
      title: "PostgreSQL",
      icon: Database,
      status: health ? "Operational" : "Unknown",
      detail: health ? `${health.database.database} · PostgreSQL ${health.database.version}` : "Waiting for check",
      good: Boolean(health),
    },
    {
      title: "XP Ingest",
      icon: Activity,
      status: health?.xp.last_event_at ? "Activity recorded" : "No activity recorded",
      detail: `${health?.xp.active_profiles || 0} profiles · last event ${fmt(health?.xp.last_event_at)}`,
      good: Boolean(health?.xp.last_event_at),
    },
    {
      title: "Website Updater",
      icon: Wrench,
      status: health?.updater?.status || "No runs recorded",
      detail: health?.updater
        ? `${health.updater.stage} · ${health.updater.message || "No message"} · ${fmt(health.updater.updated_at)}`
        : "No update jobs recorded",
      good: health?.updater?.status !== "failed",
    },
  ];

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/80">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00ff66]/20 p-6">
          <div className="flex items-center gap-4">
            <Activity className="text-[#00ff66]" />
            <div>
              <p className="text-xs uppercase tracking-[.22em] text-[#00ff66]">Operations</p>
              <h1 className="text-3xl font-black uppercase">System Health</h1>
            </div>
          </div>
          <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 border border-[#00ff66]/30 px-4 py-3 text-[#00ff66] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />Check again
          </button>
        </header>

        {error && <div className="border-b border-red-400/30 bg-red-400/10 p-4 text-red-200">{error}</div>}

        <div className="grid gap-px bg-[#00ff66]/10 md:grid-cols-2">
          <button
            type="button"
            onClick={() => setOutboxOpen((open) => !open)}
            aria-expanded={outboxOpen}
            className="bg-[#020806] p-6 text-left transition hover:bg-white/[.03]"
          >
            <div className="mb-4 flex items-center justify-between">
              <Send className="text-cyan-300" />
              <div className="flex items-center gap-3">
                <span className={deadCount === 0 ? "text-[#00ff66]" : "text-amber-300"}>
                  {deadCount === 0 ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
                </span>
                <ChevronDown size={18} className={`text-gray-400 transition ${outboxOpen ? "rotate-180" : ""}`} />
              </div>
            </div>
            <h2 className="text-lg font-bold uppercase tracking-wider">Discord Outbox</h2>
            <p className={deadCount === 0 ? "mt-2 text-[#00ff66]" : "mt-2 text-amber-200"}>{deadCount > 0 ? "Needs attention" : "Operational"}</p>
            <p className="mt-2 text-sm leading-6 text-gray-400">
              {outbox.pending?.count || 0} pending · {deadCount} dead-lettered · last processed {fmt(outbox.succeeded?.last_processed)}
            </p>
            <p className="mt-4 text-xs font-bold uppercase tracking-[.14em] text-cyan-200">Click to {outboxOpen ? "hide" : "view"} issues</p>
          </button>

          {cards.map((card) => (
            <article key={card.title} className="bg-[#020806] p-6">
              <div className="mb-4 flex items-center justify-between">
                <card.icon className="text-cyan-300" />
                <span className={card.good ? "text-[#00ff66]" : "text-amber-300"}>
                  {card.good ? <CheckCircle2 size={19} /> : <TriangleAlert size={19} />}
                </span>
              </div>
              <h2 className="text-lg font-bold uppercase tracking-wider">{card.title}</h2>
              <p className={card.good ? "mt-2 text-[#00ff66]" : "mt-2 text-amber-200"}>{card.status}</p>
              <p className="mt-2 text-sm leading-6 text-gray-400">{card.detail}</p>
            </article>
          ))}
        </div>

        {outboxOpen && (
          <section className="border-t border-amber-300/25 bg-amber-300/[.03] p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-amber-200">Discord delivery queue</p>
                <h2 className="mt-2 text-xl font-black uppercase">Pending and failed events</h2>
              </div>
              <span className="text-xs uppercase tracking-[.12em] text-gray-500">Up to 100 newest issues</span>
            </div>
            <div className="mt-5 grid gap-3">
              {(health?.discordOutboxIssues || []).map((issue) => (
                <article key={issue.id} className="border border-white/10 bg-[#020806] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold uppercase tracking-[.08em]">{issue.event_type.replaceAll("_", " ")}</h3>
                      <p className="mt-1 font-mono text-xs text-gray-600">{issue.id}</p>
                    </div>
                    <span className={`border px-2 py-1 text-xs font-bold uppercase ${issue.status === "dead" ? "border-red-300/30 bg-red-300/10 text-red-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
                      {issue.status === "dead" ? "Dead-lettered" : issue.status}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                    <div><span className="text-gray-500">Attempts</span><p className="mt-1 font-bold">{issue.attempt_count}</p></div>
                    <div><span className="text-gray-500">Created</span><p className="mt-1">{fmt(issue.created_at)}</p></div>
                    <div><span className="text-gray-500">Last updated</span><p className="mt-1">{fmt(issue.updated_at)}</p></div>
                  </div>
                  <div className={`mt-4 border-l-2 px-3 py-2 text-sm ${issue.last_error ? "border-red-300/50 bg-red-300/[.05] text-red-100" : "border-white/15 bg-white/[.02] text-gray-400"}`}>
                    {issue.last_error || (issue.status === "pending" ? `Awaiting delivery; available ${fmt(issue.available_at)}` : "Currently being processed by the Discord worker.")}
                  </div>
                </article>
              ))}
              {!health?.discordOutboxIssues.length && <p className="border border-white/10 bg-[#020806] p-5 text-gray-400">No pending, processing, or dead-lettered Discord events.</p>}
            </div>
          </section>
        )}

        <section className="border-t border-[#00ff66]/15 p-6">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-bold uppercase"><Clock3 size={18} className="text-[#00ff66]" />Scheduled Jobs</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {(health?.scheduledJobs || []).map((job) => (
              <div key={job.job_name} className="border border-white/10 bg-white/[.02] p-4">
                <div className="flex justify-between gap-3"><strong>{job.job_name}</strong><span className={job.status === "succeeded" ? "text-[#00ff66]" : "text-red-300"}>{job.status}</span></div>
                <p className="mt-2 text-sm text-gray-400">Last run: {fmt(job.completed_at)}</p>
                {job.error_message && <p className="mt-2 text-sm text-red-300">{job.error_message}</p>}
              </div>
            ))}
            {!health?.scheduledJobs.length && <p className="text-gray-400">No scheduler executions have been recorded since health tracking was enabled.</p>}
          </div>
        </section>
        <footer className="border-t border-[#00ff66]/15 px-6 py-4 text-xs uppercase tracking-wider text-gray-500">Checked {fmt(health?.checkedAt)}</footer>
      </section>
    </main>
  );
}
