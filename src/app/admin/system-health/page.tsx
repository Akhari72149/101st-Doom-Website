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
  RotateCcw,
  Send,
  Trash2,
  TriangleAlert,
  Wrench,
  X,
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
  personnel_name: string | null;
  personnel_status: string | null;
  discord_id_suffix: string | null;
};

type Health = {
  checkedAt: string;
  database: { database: string; role: string; version: string; server_time: string };
  scheduledJobs: Array<{ job_name: string; status: string; completed_at: string; error_message: string | null }>;
  discordOutbox: OutboxSummary[];
  discordOutboxIssues: OutboxIssue[];
  discordOutboxPermissions: { canRetry: boolean; canRemove: boolean };
  updater: { status: string; stage: string; message: string; updated_at: string } | null;
  xp: { last_event_at: string | null; active_profiles: number };
};

const fmt = (value: string | null | undefined) => value
  ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value))
  : "No recorded activity";

function outboxDiagnosis(issue: OutboxIssue) {
  if (!issue.last_error?.toLowerCase().includes("unknown member")) return null;
  if (issue.event_type === "PERSONNEL_STATUS_SYNC") {
    return "This person is no longer in the configured Discord server. If they left before removal or retirement was processed, this cleanup event can be removed safely.";
  }
  return "The linked Discord account is not in the configured Discord server. Correct the personnel Discord link or have the member rejoin before retrying.";
}

export default function SystemHealthPage() {
  const router = useRouter();
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [workingEventId, setWorkingEventId] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [removeTarget, setRemoveTarget] = useState<OutboxIssue | null>(null);

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

  const manageOutboxEvent = useCallback(async (issue: OutboxIssue, action: "retry" | "remove") => {
    setWorkingEventId(issue.id);
    setActionMessage("");
    try {
      const response = await fetch("/api/admin/system-health", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ action, eventId: issue.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Queue action failed");
      setActionMessage(action === "retry" ? "Event queued for another delivery attempt." : "Dead-lettered event removed.");
      setRemoveTarget(null);
      await load();
    } catch (caught) {
      setActionMessage(caught instanceof Error ? caught.message : "Queue action failed");
    } finally {
      setWorkingEventId("");
    }
  }, [load]);

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
  const operationalChecks = health
    ? [deadCount === 0, true, Boolean(health.xp.last_event_at), health.updater?.status !== "failed"].filter(Boolean).length
    : 0;
  const attentionChecks = 4 - operationalChecks;

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
        {actionMessage && <div className="border-b border-cyan-300/25 bg-cyan-300/[.06] p-4 text-cyan-100">{actionMessage}</div>}

        {health && <div className={`flex flex-col gap-4 border-b p-5 sm:flex-row sm:items-center sm:justify-between ${attentionChecks ? "border-amber-300/25 bg-amber-300/[.05]" : "border-[#00ff66]/25 bg-[#00ff66]/[.05]"}`}>
          <div className="flex items-start gap-3">
            {attentionChecks ? <TriangleAlert className="mt-0.5 shrink-0 text-amber-300" size={21}/> : <CheckCircle2 className="mt-0.5 shrink-0 text-[#00ff66]" size={21}/>}
            <div>
              <p className={`font-black uppercase tracking-[.12em] ${attentionChecks ? "text-amber-200" : "text-[#00ff66]"}`}>{attentionChecks ? `${attentionChecks} monitored ${attentionChecks === 1 ? "service needs" : "services need"} attention` : "All monitored services operational"}</p>
              <p className="mt-1 text-sm text-gray-400">{operationalChecks} of 4 checks currently reporting healthy.</p>
            </div>
          </div>
          <div className="border border-white/10 bg-black/30 px-3 py-2 text-xs uppercase tracking-[.12em] text-gray-400">Checked {fmt(health.checkedAt)}</div>
        </div>}

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
                  <div className="mt-4 grid gap-3 border-y border-white/10 py-3 text-sm sm:grid-cols-2">
                    <div>
                      <span className="text-gray-500">Linked personnel</span>
                      <p className="mt-1 font-bold text-white">{issue.personnel_name || "No personnel record matched"}</p>
                      {issue.personnel_status && <p className="mt-1 text-xs uppercase tracking-[.1em] text-gray-500">{issue.personnel_status}</p>}
                    </div>
                    <div>
                      <span className="text-gray-500">Discord link</span>
                      <p className="mt-1 font-mono text-white">{issue.discord_id_suffix ? `••••${issue.discord_id_suffix}` : "Not available"}</p>
                    </div>
                  </div>
                  <div className={`mt-4 border-l-2 px-3 py-2 text-sm ${issue.last_error ? "border-red-300/50 bg-red-300/[.05] text-red-100" : "border-white/15 bg-white/[.02] text-gray-400"}`}>
                    {issue.last_error || (issue.status === "pending" ? `Awaiting delivery; available ${fmt(issue.available_at)}` : "Currently being processed by the Discord worker.")}
                  </div>
                  {outboxDiagnosis(issue) && (
                    <p className="mt-3 border border-amber-300/20 bg-amber-300/[.05] p-3 text-sm leading-6 text-amber-100">
                      {outboxDiagnosis(issue)}
                    </p>
                  )}
                  {issue.status === "dead" && (health?.discordOutboxPermissions.canRetry || health?.discordOutboxPermissions.canRemove) && (
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      {health.discordOutboxPermissions.canRetry && (
                        <button
                          type="button"
                          onClick={() => void manageOutboxEvent(issue, "retry")}
                          disabled={Boolean(workingEventId)}
                          className="flex items-center gap-2 border border-cyan-300/35 px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-cyan-200 transition hover:bg-cyan-300/10 disabled:opacity-40"
                        >
                          <RotateCcw size={15} className={workingEventId === issue.id ? "animate-spin" : ""} />
                          Retry
                        </button>
                      )}
                      {health.discordOutboxPermissions.canRemove && (
                        <button
                          type="button"
                          onClick={() => setRemoveTarget(issue)}
                          disabled={Boolean(workingEventId)}
                          className="flex items-center gap-2 border border-red-300/35 px-3 py-2 text-xs font-bold uppercase tracking-[.12em] text-red-200 transition hover:bg-red-300/10 disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                          Remove
                        </button>
                      )}
                    </div>
                  )}
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

      {removeTarget && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/85 p-4" role="presentation">
          <section role="dialog" aria-modal="true" aria-labelledby="remove-outbox-title" className="w-full max-w-lg border border-red-300/35 bg-[#020806] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-red-300/20 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.18em] text-red-200">Permanent queue action</p>
                <h2 id="remove-outbox-title" className="mt-2 text-xl font-black uppercase">Remove dead letter?</h2>
              </div>
              <button type="button" onClick={() => setRemoveTarget(null)} className="border border-white/15 p-2 text-gray-400 hover:text-white" aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className="p-5 text-sm leading-6 text-gray-300">
              <p>This removes the failed event from the active Discord queue. The administrative action will remain recorded for audit purposes.</p>
              <dl className="mt-4 grid gap-3 border border-white/10 bg-black p-4 sm:grid-cols-2">
                <div><dt className="text-gray-500">Event</dt><dd className="mt-1 font-bold">{removeTarget.event_type.replaceAll("_", " ")}</dd></div>
                <div><dt className="text-gray-500">Personnel</dt><dd className="mt-1 font-bold">{removeTarget.personnel_name || "Unknown"}</dd></div>
              </dl>
            </div>
            <footer className="flex justify-end gap-2 border-t border-white/10 p-5">
              <button type="button" onClick={() => setRemoveTarget(null)} className="border border-white/15 px-4 py-2 text-sm font-bold text-gray-300 hover:bg-white/5">Cancel</button>
              <button
                type="button"
                onClick={() => void manageOutboxEvent(removeTarget, "remove")}
                disabled={Boolean(workingEventId)}
                className="flex items-center gap-2 border border-red-300/40 bg-red-300/10 px-4 py-2 text-sm font-bold text-red-100 hover:bg-red-300/20 disabled:opacity-40"
              >
                <Trash2 size={16} />
                Remove permanently
              </button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
