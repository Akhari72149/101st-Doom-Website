"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  RefreshCw,
  Rocket,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";

type ReadinessStatus = "ready" | "review" | "in-progress" | "setup-required" | "terminal";
type CriterionState = "met" | "not-met" | "review" | "unavailable";

type Criterion = {
  key: string;
  label: string;
  current: string;
  target: string;
  state: CriterionState;
};

type SetupIssue = {
  key: string;
  label: string;
  detail: string;
  affected?: number;
};

type Person = {
  id: string;
  name: string;
  birth_number: string;
  slotted_position: string | null;
  current_rank: string | null;
  tig_days: number;
  service_days: number;
  attended: number;
  missed: number;
  attendancePercentage: number | null;
  targetRank: string | null;
  targetRankId: string | null;
  targetConfigured: boolean;
  approvalPermission: "company" | null;
  companyApproval: {
    id: string;
    approved_by_name: string;
    approved_at: string;
  } | null;
  canApprove: boolean;
  canPromote: boolean;
  status: ReadinessStatus;
  criteria: Criterion[];
  setupIssues: SetupIssue[];
};

type AnnouncementIssue = {
  id: string;
  status: "pending" | "processing" | "dead";
  attempt_count: number;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  personnel_name: string;
  old_rank_name: string;
  new_rank_name: string;
};

type ResponseBody = {
  people: Person[];
  summary: { ready: number; review: number; inProgress: number; needsSetup: number; terminal: number };
  setupIssues: Array<SetupIssue & { affected: number }>;
  canPromote: boolean;
  announcementControl: { enabled: boolean; pending: number };
  announcementIssues: AnnouncementIssue[];
  attendanceWindow: { first_record: string | null; last_record: string | null; periods: number; startsAt: string };
  calculatedAt: string;
};

const statusDetails = {
  ready: { label: "Ready", className: "border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]", icon: CheckCircle2 },
  review: { label: "Command review", className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200", icon: ShieldCheck },
  "in-progress": { label: "In progress", className: "border-amber-300/35 bg-amber-300/10 text-amber-200", icon: Clock3 },
  "setup-required": { label: "Setup required", className: "border-red-300/35 bg-red-300/10 text-red-200", icon: TriangleAlert },
  terminal: { label: "Final rank", className: "border-white/20 bg-white/5 text-white/70", icon: ShieldCheck },
} as const;

function formatDate(value: string | null) {
  if (!value) return "No records";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

function issueMessage(issue: AnnouncementIssue) {
  if (issue.last_error) return issue.last_error;
  if (issue.status === "processing") return "The bot has claimed this message and is currently delivering it.";
  if (issue.status === "dead") return "Delivery stopped after the maximum number of attempts.";
  const waitingSeconds = Math.max(0, Math.floor((Date.now() - new Date(issue.created_at).getTime()) / 1000));
  return waitingSeconds > 30
    ? "The bot has not collected this message. Check that the bot service and Discord outbox connection are running."
    : "Waiting for the bot worker to collect this message.";
}

function criterionStyle(state: CriterionState) {
  if (state === "met") return "border-[#00ff66]/25 bg-[#00ff66]/5 text-[#00ff66]";
  if (state === "review") return "border-cyan-300/25 bg-cyan-300/5 text-cyan-200";
  if (state === "unavailable") return "border-red-300/25 bg-red-300/5 text-red-200";
  return "border-amber-300/25 bg-amber-300/5 text-amber-200";
}

function CriterionIcon({ state }: { state: CriterionState }) {
  if (state === "met") return <CheckCircle2 size={16} />;
  if (state === "review") return <ShieldCheck size={16} />;
  if (state === "unavailable") return <TriangleAlert size={16} />;
  return <XCircle size={16} />;
}

export default function PromotionReadinessPage() {
  const [data, setData] = useState<ResponseBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReadinessStatus | "all">("all");
  const [rank, setRank] = useState("all");
  const [view, setView] = useState<"ready" | "all">("ready");
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [updatingAnnouncements, setUpdatingAnnouncements] = useState(false);
  const [showAnnouncementIssues, setShowAnnouncementIssues] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promotion-readiness", {
        cache: "no-store",
      });
      const body = await response.json() as ResponseBody & { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to calculate promotion readiness");
      setData(body);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to calculate promotion readiness");
    } finally {
      setLoading(false);
    }
  }, []);

  const promote = useCallback(async (person: Person) => {
    if (!window.confirm(`Promote ${person.name} from ${person.current_rank || "Unranked"} to ${person.targetRank}?`)) return;
    setPromotingId(person.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/promotion-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ personnelId: person.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Promotion failed");
      setNotice(`${person.name} was promoted to ${person.targetRank}.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Promotion failed");
    } finally {
      setPromotingId(null);
    }
  }, [load]);

  const approveCompanyPromotion = useCallback(async (person: Person) => {
    if (!window.confirm(`Record company approval for ${person.name} to progress from ${person.current_rank || "Unranked"} to ${person.targetRank}?`)) return;
    setApprovingId(person.id);
    setNotice("");
    try {
      const response = await fetch("/api/admin/promotion-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve-company", personnelId: person.id }),
      });
      const body = await response.json() as { error?: string; processedBy?: string };
      if (!response.ok) throw new Error(body.error || "Company approval failed");
      setNotice(`${person.name}'s promotion was approved by ${body.processedBy || "Company"}. A promotion administrator can now complete it.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Company approval failed");
    } finally {
      setApprovingId(null);
    }
  }, [load]);

  const setAnnouncements = useCallback(async (enabled: boolean) => {
    const pending = data?.announcementControl.pending || 0;
    if (enabled && pending > 0 && !window.confirm(`Enable announcements and release ${pending} stored promotion message${pending === 1 ? "" : "s"}?`)) return;
    setUpdatingAnnouncements(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/promotion-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set-announcements", enabled }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Failed to update announcements");
      setNotice(enabled ? "Promotion announcements are now live." : "Promotion announcements are paused; new messages will be stored.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update announcements");
    } finally {
      setUpdatingAnnouncements(false);
    }
  }, [data, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const ranks = useMemo(() => [...new Set((data?.people || []).map((person) => person.current_rank || "Unranked"))].sort(), [data]);
  const people = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.people || []).filter((person) => {
      if (view === "ready" && person.status !== "ready" && !person.canPromote && !person.canApprove) return false;
      if (status !== "all" && person.status !== status) return false;
      if (rank !== "all" && (person.current_rank || "Unranked") !== rank) return false;
      if (!query) return true;
      return [person.name, person.birth_number, person.current_rank, person.targetRank, person.slotted_position]
        .some((value) => (value || "").toLowerCase().includes(query));
    });
  }, [data, rank, search, status, view]);

  const summaries = [
    { status: "ready" as const, label: "Ready", value: data?.summary.ready || 0, icon: CheckCircle2, color: "text-[#00ff66]" },
    { status: "review" as const, label: "Command review", value: data?.summary.review || 0, icon: ShieldCheck, color: "text-cyan-300" },
    { status: "in-progress" as const, label: "In progress", value: data?.summary.inProgress || 0, icon: Clock3, color: "text-amber-300" },
    { status: "setup-required" as const, label: "Setup required", value: data?.summary.needsSetup || 0, icon: TriangleAlert, color: "text-red-300" },
    { status: "terminal" as const, label: "Final rank", value: data?.summary.terminal || 0, icon: ShieldCheck, color: "text-white/70" },
  ];

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/80">
        <header className="flex flex-wrap items-center justify-between gap-5 border-b border-[#00ff66]/20 p-5 sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid h-12 w-12 place-items-center border border-[#00ff66]/30 bg-[#00ff66]/5 text-[#00ff66]">
              <UserCheck size={23} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#00ff66]">Personnel Administration</p>
              <h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">Promotion Readiness</h1>
            </div>
          </div>
          <button onClick={() => void load()} disabled={loading} className="flex min-h-11 items-center gap-2 border border-[#00ff66]/30 px-4 font-bold uppercase tracking-[0.12em] text-[#00ff66] disabled:opacity-50">
            <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
            Recalculate
          </button>
        </header>

        {error && <div className="border-b border-red-300/25 bg-red-300/10 px-5 py-4 text-red-200">{error}</div>}
        {notice && <div className="border-b border-[#00ff66]/25 bg-[#00ff66]/10 px-5 py-4 text-[#00ff66]">{notice}</div>}

        <div className="border-b border-cyan-300/15 bg-cyan-300/[0.04] px-5 py-4 text-sm leading-6 text-[#9db3a7] sm:px-7">
          Attendance is calculated from <strong className="text-cyan-200">MainOps from 1 August 2026 onwards</strong> as Y / (Y + N); Excused and LOA records are excluded. Course completion and command approval always require human confirmation.
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#00ff66]/15 px-5 py-4 sm:px-7">
          <div className="flex items-center gap-3">
            <span className={`grid h-10 w-10 place-items-center border ${data?.announcementControl.enabled ? "border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]" : "border-amber-300/35 bg-amber-300/10 text-amber-200"}`}>
              {data?.announcementControl.enabled ? <Bell size={18} /> : <BellOff size={18} />}
            </span>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.14em] text-white">Discord Promotion Announcements</p>
              <p className={`mt-1 text-sm ${data?.announcementControl.enabled ? "text-[#00ff66]" : "text-amber-200"}`}>
                {data?.announcementControl.enabled ? "Live" : "Paused"}
                {Boolean(data?.announcementControl.pending) && ` · ${data?.announcementControl.pending} stored`}
              </p>
            </div>
          </div>
          {data?.canPromote && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAnnouncementIssues(true)}
                className="inline-flex min-h-11 items-center gap-2 border border-cyan-300/35 px-4 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-300/10"
              >
                <TriangleAlert size={16} /> Delivery Issues
                {data.announcementIssues.length > 0 && <span className="border border-cyan-300/30 bg-cyan-300/10 px-1.5 py-0.5 text-[10px]">{data.announcementIssues.length}</span>}
              </button>
              <button
                type="button"
                onClick={() => void setAnnouncements(!data.announcementControl.enabled)}
                disabled={updatingAnnouncements}
                className={`inline-flex min-h-11 items-center gap-2 border px-4 text-xs font-black uppercase tracking-[0.12em] transition disabled:cursor-wait disabled:opacity-50 ${data.announcementControl.enabled ? "border-amber-300/40 text-amber-200 hover:bg-amber-300/10" : "border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10"}`}
              >
                {updatingAnnouncements ? <RefreshCw size={16} className="animate-spin" /> : data.announcementControl.enabled ? <BellOff size={16} /> : <Bell size={16} />}
                {updatingAnnouncements ? "Updating" : data.announcementControl.enabled ? "Pause" : "Enable"}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 border-b border-[#00ff66]/20">
          <button onClick={() => { setView("ready"); setStatus("all"); }} className={`min-h-14 border-r border-[#00ff66]/20 px-4 text-sm font-black uppercase tracking-[0.12em] ${view === "ready" ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#81958a] hover:bg-white/[0.03]"}`}>
            Ready to Promote <span className="ml-2 text-xs">{data?.people.filter((person) => person.status === "ready" || person.canPromote).length || 0}</span>
          </button>
          <button onClick={() => setView("all")} className={`min-h-14 px-4 text-sm font-black uppercase tracking-[0.12em] ${view === "all" ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#81958a] hover:bg-white/[0.03]"}`}>
            All Personnel
          </button>
        </div>

        <div className="grid gap-px border-b border-[#00ff66]/15 bg-[#00ff66]/10 sm:grid-cols-2 xl:grid-cols-5">
          {summaries.map((item) => (
            <button key={item.status} onClick={() => { setView("all"); setStatus(status === item.status ? "all" : item.status); }} className={`bg-[#020806] p-5 text-left transition hover:bg-white/[0.03] ${view === "all" && status === item.status ? "outline outline-1 outline-[#00ff66]/50" : ""}`}>
              <div className="flex items-center justify-between gap-4">
                <item.icon size={20} className={item.color} />
                <span className={`text-3xl font-black ${item.color}`}>{item.value}</span>
              </div>
              <p className="mt-3 text-xs font-bold uppercase tracking-[0.16em] text-[#879b90]">{item.label}</p>
            </button>
          ))}
        </div>

        <section className="border-b border-[#00ff66]/15 p-5 sm:p-7">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5f7669]" size={18} />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search personnel, service number, rank, or slot" className="min-h-12 w-full border border-white/15 bg-[#020806] pl-12 pr-4 outline-none focus:border-[#00ff66]/60" />
            </label>
            <select value={status} onChange={(event) => setStatus(event.target.value as ReadinessStatus | "all")} className="min-h-12 border border-white/15 bg-[#020806] px-4 outline-none focus:border-[#00ff66]/60">
              <option value="all">All readiness states</option>
              <option value="ready">Ready</option>
              <option value="review">Command review</option>
              <option value="in-progress">In progress</option>
              <option value="setup-required">Setup required</option>
              <option value="terminal">Final rank</option>
            </select>
            <select value={rank} onChange={(event) => setRank(event.target.value)} className="min-h-12 border border-white/15 bg-[#020806] px-4 outline-none focus:border-[#00ff66]/60">
              <option value="all">All current ranks</option>
              {ranks.map((rankName) => <option key={rankName} value={rankName}>{rankName}</option>)}
            </select>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.12em] text-[#71877a]">
            <span>{people.length} of {data?.people.length || 0} active personnel shown</span>
            <span>Attendance evidence: {formatDate(data?.attendanceWindow.first_record || null)} to {formatDate(data?.attendanceWindow.last_record || null)} · {data?.attendanceWindow.periods || 0} periods</span>
          </div>
        </section>

        {!!data?.setupIssues.length && (
          <section className="border-b border-red-300/20 bg-red-300/[0.03] p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-200">Required setup</p>
                <h2 className="mt-2 text-xl font-black uppercase">Configuration actions</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#94a99e]">
                  Complete these actions to replace setup warnings with calculated readiness results.
                </p>
              </div>
              <a href="/admin/ranks" className="border border-red-300/30 px-4 py-3 text-xs font-bold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-300/10">
                Open Rank Management
              </a>
            </div>
            <div className="mt-5 grid gap-px bg-red-300/15 lg:grid-cols-2">
              {data.setupIssues.map((issue) => (
                <article key={issue.key} className="bg-[#020806] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-red-100">{issue.label}</h3>
                      <p className="mt-2 text-sm leading-6 text-[#8fa398]">{issue.detail}</p>
                    </div>
                    <span className="shrink-0 border border-red-300/25 bg-red-300/10 px-2 py-1 text-xs font-bold text-red-200">
                      {issue.affected} affected
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        <section className="divide-y divide-[#00ff66]/10">
          {loading && !data ? (
            <div className="grid min-h-80 place-items-center text-[#00ff66]"><RefreshCw className="animate-spin" /></div>
          ) : people.length ? people.map((person) => {
            const detail = statusDetails[person.status];
            const usesOperationCounts = ["CR", "CR-C"].includes((person.current_rank || "").toUpperCase());
            return (
              <article key={person.id} className="p-5 sm:p-6">
                <div className="grid gap-5 xl:grid-cols-[minmax(220px,0.8fr)_minmax(280px,1.1fr)_minmax(380px,1.4fr)] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 shrink-0 place-items-center border border-white/10 text-[#00ff66]"><Users size={18} /></div>
                      <div className="min-w-0">
                        <h2 className="truncate text-lg font-black">{person.name}</h2>
                        <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[#71877a]">{person.birth_number} · {person.slotted_position || "Unslotted"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 border-l-2 border-[#00ff66]/30 pl-4">
                    <strong>{person.current_rank || "Unranked"}</strong>
                    <ArrowRight size={17} className="shrink-0 text-[#00ff66]" />
                    <strong className="text-[#00ff66]">{person.targetRank || (person.status === "terminal" ? "Final rank" : "No published route")}</strong>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-white/10">
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">TIG</p><p className="mt-1 font-bold">{person.tig_days}d</p></div>
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">{usesOperationCounts ? "Op credits" : "Attendance"}</p><p className="mt-1 font-bold">{usesOperationCounts ? `${person.attended}/4` : person.attendancePercentage === null ? "N/A" : `${person.attendancePercentage}%`}</p></div>
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">Service</p><p className="mt-1 font-bold">{person.service_days}d</p></div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${detail.className}`}>
                    <detail.icon size={15} />{detail.label}
                  </span>
                  <div className="flex flex-wrap items-center gap-3">
                    {person.companyApproval && (
                      <span className="border border-cyan-300/30 bg-cyan-300/[0.07] px-3 py-2 text-xs text-cyan-100">
                        Company approved by <strong>{person.companyApproval.approved_by_name}</strong> · {formatDateTime(person.companyApproval.approved_at)}
                      </span>
                    )}
                    {person.canApprove && (
                      <button
                        onClick={() => void approveCompanyPromotion(person)}
                        disabled={approvingId !== null || promotingId !== null}
                        className="inline-flex min-h-11 items-center gap-2 border border-cyan-300/45 bg-cyan-300/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 transition hover:bg-cyan-300/20 disabled:cursor-wait disabled:opacity-50"
                      >
                        {approvingId === person.id ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                        {approvingId === person.id ? "Approving" : "Company Approve"}
                      </button>
                    )}
                    {person.canPromote && (
                      <button
                        onClick={() => void promote(person)}
                        disabled={promotingId !== null || approvingId !== null}
                        className="inline-flex min-h-11 items-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:cursor-wait disabled:opacity-50"
                      >
                        {promotingId === person.id ? <RefreshCw size={16} className="animate-spin" /> : <Rocket size={16} />}
                        {promotingId === person.id ? "Promoting" : "Promote"}
                      </button>
                    )}
                  </div>
                  {person.setupIssues.length > 0 && (
                    <div className="w-full border-l-2 border-red-300/40 bg-red-300/[0.04] px-4 py-3 text-sm text-red-100">
                      <strong className="mr-2 uppercase tracking-[0.1em]">Setup:</strong>
                      {person.setupIssues.map((issue) => issue.label).join("; ")}
                    </div>
                  )}
                  <details className="group w-full border-t border-white/10 pt-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-xs font-bold uppercase tracking-[0.14em] text-[#91a59a]">
                      Requirement breakdown
                      <ChevronDown size={16} className="transition group-open:rotate-180" />
                    </summary>
                    <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {person.criteria.length ? person.criteria.map((item) => (
                        <div key={item.key} className={`flex items-start gap-3 border p-3 ${criterionStyle(item.state)}`}>
                          <span className="mt-0.5 shrink-0"><CriterionIcon state={item.state} /></span>
                          <div>
                            <p className="text-xs font-bold uppercase tracking-[0.12em]">{item.label}</p>
                            <p className="mt-1 text-xs text-white/65">{item.current} · target {item.target}</p>
                          </div>
                        </div>
                      )) : person.status === "terminal" ? (
                        <div className="border border-white/15 bg-white/[0.03] p-3 text-sm text-white/65">This is a confirmed final rank with no further standard progression.</div>
                      ) : (
                        <div className="border border-red-300/25 bg-red-300/5 p-3 text-sm text-red-200">No standard promotion route is configured for this rank.</div>
                      )}
                      {person.setupIssues.map((issue) => (
                        <div key={issue.key} className="flex items-start gap-3 border border-red-300/25 bg-red-300/5 p-3 text-red-200">
                          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                          <div><p className="text-xs font-bold uppercase tracking-[0.12em]">{issue.label}</p><p className="mt-1 text-xs text-white/65">{issue.detail}</p></div>
                        </div>
                      ))}
                    </div>
                  </details>
                </div>
              </article>
            );
          }) : (
            <div className="grid min-h-72 place-items-center px-5 text-center text-[#71877a]">
              <div><CircleDashed className="mx-auto mb-3" /><p>No personnel match the selected filters.</p></div>
            </div>
          )}
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#00ff66]/15 px-5 py-4 text-xs uppercase tracking-[0.12em] text-[#64796d] sm:px-7">
          <span>Recommendations do not replace command approval</span>
          <span>Calculated {data ? formatDate(data.calculatedAt) : "Not yet"}</span>
        </footer>
      </section>

      {showAnnouncementIssues && data?.canPromote && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="promotion-delivery-title">
          <section className="flex max-h-[85vh] w-full max-w-4xl flex-col border border-cyan-300/30 bg-[#020806] shadow-[0_0_60px_rgba(34,211,238,0.12)]">
            <header className="flex items-start justify-between gap-4 border-b border-cyan-300/20 px-5 py-4 sm:px-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-cyan-300">Discord Delivery Monitor</p>
                <h2 id="promotion-delivery-title" className="mt-1 text-xl font-black uppercase">Promotion Message Issues</h2>
                <p className="mt-2 text-sm text-[#8ba397]">Pending, processing, or failed messages are shown here. Completed messages disappear automatically.</p>
              </div>
              <button type="button" onClick={() => setShowAnnouncementIssues(false)} className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 text-gray-400 transition hover:border-white/30 hover:text-white" aria-label="Close delivery issues">
                <X size={19} />
              </button>
            </header>

            <div className="overflow-y-auto p-5 sm:p-6">
              {data.announcementIssues.length ? (
                <div className="space-y-3">
                  {data.announcementIssues.map((issue) => (
                    <article key={issue.id} className={`border p-4 ${issue.status === "dead" ? "border-red-300/30 bg-red-300/[0.06]" : issue.status === "processing" ? "border-cyan-300/30 bg-cyan-300/[0.06]" : "border-amber-300/25 bg-amber-300/[0.04]"}`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-black text-white">{issue.personnel_name}</p>
                          <p className="mt-1 text-sm text-[#91a79b]">{issue.old_rank_name} <ArrowRight className="mx-1 inline" size={14} /> {issue.new_rank_name}</p>
                        </div>
                        <span className={`border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${issue.status === "dead" ? "border-red-300/35 text-red-200" : issue.status === "processing" ? "border-cyan-300/35 text-cyan-200" : "border-amber-300/35 text-amber-200"}`}>{issue.status}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-gray-300">{issueMessage(issue)}</p>
                      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[#63786d]">
                        <span>Attempts {issue.attempt_count}/5</span>
                        <span>Queued {formatDateTime(issue.created_at)}</span>
                        <span>Updated {formatDateTime(issue.updated_at)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="grid min-h-44 place-items-center border border-[#00ff66]/20 bg-[#00ff66]/5 text-center">
                  <div><CheckCircle2 className="mx-auto text-[#00ff66]" size={28} /><p className="mt-3 font-black uppercase text-[#00ff66]">No delivery issues</p><p className="mt-1 text-sm text-[#81958a]">There are no unsent promotion messages.</p></div>
                </div>
              )}
            </div>

            <footer className="flex justify-end gap-3 border-t border-cyan-300/15 px-5 py-4 sm:px-6">
              <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center gap-2 border border-cyan-300/30 px-4 text-xs font-black uppercase tracking-[0.12em] text-cyan-200 disabled:opacity-50">
                <RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Refresh
              </button>
              <button type="button" onClick={() => setShowAnnouncementIssues(false)} className="min-h-10 border border-white/15 px-4 text-xs font-black uppercase tracking-[0.12em] text-white">Close</button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
