"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserCheck,
  Users,
  XCircle,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type ReadinessStatus = "ready" | "review" | "in-progress" | "setup-required";
type CriterionState = "met" | "not-met" | "review" | "unavailable";

type Criterion = {
  key: string;
  label: string;
  current: string;
  target: string;
  state: CriterionState;
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
  targetConfigured: boolean;
  status: ReadinessStatus;
  criteria: Criterion[];
};

type ResponseBody = {
  people: Person[];
  summary: { ready: number; review: number; inProgress: number; needsSetup: number };
  attendanceWindow: { first_record: string | null; last_record: string | null; periods: number };
  calculatedAt: string;
};

const statusDetails = {
  ready: { label: "Ready", className: "border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]", icon: CheckCircle2 },
  review: { label: "Command review", className: "border-cyan-300/35 bg-cyan-300/10 text-cyan-200", icon: ShieldCheck },
  "in-progress": { label: "In progress", className: "border-amber-300/35 bg-amber-300/10 text-amber-200", icon: Clock3 },
  "setup-required": { label: "Setup required", className: "border-red-300/35 bg-red-300/10 text-red-200", icon: TriangleAlert },
} as const;

function formatDate(value: string | null) {
  if (!value) return "No records";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
  const router = useRouter();
  const [data, setData] = useState<ResponseBody | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<ReadinessStatus | "all">("all");
  const [rank, setRank] = useState("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/promotion-readiness", {
        cache: "no-store",
        headers: await getAppAuthHeaders(),
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

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.promotion-readiness", "read")) {
        router.replace(session ? "/" : "/login");
        return;
      }
      await load();
    })();
  }, [load, router]);

  const ranks = useMemo(() => [...new Set((data?.people || []).map((person) => person.current_rank || "Unranked"))].sort(), [data]);
  const people = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.people || []).filter((person) => {
      if (status !== "all" && person.status !== status) return false;
      if (rank !== "all" && (person.current_rank || "Unranked") !== rank) return false;
      if (!query) return true;
      return [person.name, person.birth_number, person.current_rank, person.targetRank, person.slotted_position]
        .some((value) => (value || "").toLowerCase().includes(query));
    });
  }, [data, rank, search, status]);

  const summaries = [
    { status: "ready" as const, label: "Ready", value: data?.summary.ready || 0, icon: CheckCircle2, color: "text-[#00ff66]" },
    { status: "review" as const, label: "Command review", value: data?.summary.review || 0, icon: ShieldCheck, color: "text-cyan-300" },
    { status: "in-progress" as const, label: "In progress", value: data?.summary.inProgress || 0, icon: Clock3, color: "text-amber-300" },
    { status: "setup-required" as const, label: "Setup required", value: data?.summary.needsSetup || 0, icon: TriangleAlert, color: "text-red-300" },
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

        <div className="border-b border-cyan-300/15 bg-cyan-300/[0.04] px-5 py-4 text-sm leading-6 text-[#9db3a7] sm:px-7">
          This page provides recommendations only. Attendance is calculated as <strong className="text-cyan-200">Y / (Y + N)</strong>; Excused and LOA records are excluded. Course completion and command approval always require human confirmation.
        </div>

        <div className="grid gap-px border-b border-[#00ff66]/15 bg-[#00ff66]/10 sm:grid-cols-2 xl:grid-cols-4">
          {summaries.map((item) => (
            <button key={item.status} onClick={() => setStatus(status === item.status ? "all" : item.status)} className={`bg-[#020806] p-5 text-left transition hover:bg-white/[0.03] ${status === item.status ? "outline outline-1 outline-[#00ff66]/50" : ""}`}>
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

        <section className="divide-y divide-[#00ff66]/10">
          {loading && !data ? (
            <div className="grid min-h-80 place-items-center text-[#00ff66]"><RefreshCw className="animate-spin" /></div>
          ) : people.length ? people.map((person) => {
            const detail = statusDetails[person.status];
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
                    <strong className="text-[#00ff66]">{person.targetRank || "No published route"}</strong>
                  </div>

                  <div className="grid grid-cols-3 gap-px bg-white/10">
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">TIG</p><p className="mt-1 font-bold">{person.tig_days}d</p></div>
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">Attendance</p><p className="mt-1 font-bold">{person.attendancePercentage === null ? "N/A" : `${person.attendancePercentage}%`}</p></div>
                    <div className="bg-[#020806] p-3"><p className="text-[10px] uppercase tracking-[0.14em] text-[#657b6f]">Service</p><p className="mt-1 font-bold">{person.service_days}d</p></div>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <span className={`inline-flex items-center gap-2 border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${detail.className}`}>
                    <detail.icon size={15} />{detail.label}
                  </span>
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
                      )) : (
                        <div className="border border-red-300/25 bg-red-300/5 p-3 text-sm text-red-200">No standard promotion route is configured for this rank.</div>
                      )}
                      {person.targetRank && !person.targetConfigured && (
                        <div className="flex items-start gap-3 border border-red-300/25 bg-red-300/5 p-3 text-red-200">
                          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
                          <div><p className="text-xs font-bold uppercase tracking-[0.12em]">Rank setup required</p><p className="mt-1 text-xs text-white/65">{person.targetRank} is not yet an active rank definition.</p></div>
                        </div>
                      )}
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
    </main>
  );
}
