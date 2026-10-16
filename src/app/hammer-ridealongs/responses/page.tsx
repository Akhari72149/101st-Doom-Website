"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ClipboardList, Pencil, Search, Trash2, X } from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";

type Trainee = { id: string; name: string; active: boolean };
type Report = {
  id: string;
  trainee_id: string;
  phase: 1 | 2;
  operation_type: "mainop" | "funop" | "training";
  zeus: string;
  pilot_supervisor: string;
  activity: "ball-gunning" | "flying";
  occurred_on: string;
  created_at: string;
};
type ResponseData = { trainees: Trainee[]; reports: Report[]; permissions: { canEdit: boolean; canFull: boolean }; error?: string };
type Draft = Omit<Report, "created_at">;

function date(value: string) {
  const parsed = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export default function HammerRidealongResponsesPage() {
  const [data, setData] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [phase, setPhase] = useState("all");
  const [operation, setOperation] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hammer-ridealongs", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
      const body = await response.json() as ResponseData;
      if (!response.ok) throw new Error(body.error || "Unable to load responses");
      setData(body);
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to load responses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!draft) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [draft]);

  const names = useMemo(() => new Map((data?.trainees || []).map((trainee) => [trainee.id, trainee.name])), [data?.trainees]);
  const reports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...(data?.reports || [])].filter((report) => {
      const matchesSearch = !query || [names.get(report.trainee_id) || "", report.zeus, report.pilot_supervisor, report.activity, report.operation_type].some((value) => value.toLowerCase().includes(query));
      return matchesSearch && (phase === "all" || report.phase === Number(phase)) && (operation === "all" || report.operation_type === operation)
        && (!fromDate || report.occurred_on.slice(0, 10) >= fromDate) && (!toDate || report.occurred_on.slice(0, 10) <= toDate);
    }).sort((a, b) => b.occurred_on.localeCompare(a.occurred_on) || b.created_at.localeCompare(a.created_at));
  }, [data?.reports, fromDate, names, operation, phase, search, toDate]);

  async function submit(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    const response = await fetch("/api/hammer-ridealongs", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify(payload) });
    const body = await response.json() as { error?: string };
    setSaving(false);
    if (!response.ok) return setMessage(body.error || "Unable to update response");
    setDraft(null);
    setMessage(success);
    await load();
  }

  return <main className="min-h-screen bg-[#020806] px-3 py-8 text-white sm:px-6 lg:px-10">
    <section className="mx-auto max-w-7xl border border-cyan-300/25 bg-black/75">
      <header className="border-b border-cyan-300/20 p-5 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-cyan-200"><ClipboardList size={15}/>Hammer Aviation</p><h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Ridealong Responses</h1><p className="mt-3 text-sm text-[#8ba095]">Every submitted ridealong form response. Corrections immediately update trainee totals.</p></div><Link href="/hammer-ridealongs" className="flex items-center gap-2 self-start border border-white/15 px-4 py-3 text-xs font-black uppercase text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66]"><ArrowLeft size={15}/>Tracker</Link></div></header>
      <div className="grid gap-3 border-b border-white/10 p-4 md:grid-cols-[minmax(220px,1fr)_150px_160px_160px_160px]"><label className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search responses</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trainee, Zeus or supervisor" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-cyan-300/50"/></label><select value={phase} onChange={(event) => setPhase(event.target.value)} className="h-11 border border-white/15 bg-black px-3 text-sm"><option value="all">All phases</option><option value="1">Phase 1</option><option value="2">Phase 2</option></select><select value={operation} onChange={(event) => setOperation(event.target.value)} className="h-11 border border-white/15 bg-black px-3 text-sm"><option value="all">All operations</option><option value="mainop">Mainop</option><option value="funop">Funop</option><option value="training">Training</option></select><label><span className="sr-only">From date</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="h-11 w-full border border-white/15 bg-black px-3 text-sm" title="From date"/></label><label><span className="sr-only">To date</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="h-11 w-full border border-white/15 bg-black px-3 text-sm" title="To date"/></label></div>
      {message && <p className="border-b border-cyan-300/20 bg-cyan-300/[.05] p-4 text-sm text-cyan-100">{message}</p>}
      {loading ? <p className="p-12 text-center text-sm uppercase tracking-[.12em] text-gray-600">Loading responses...</p> : <div className="grid gap-3 p-3 sm:p-5">{reports.map((report) => <article key={report.id} className="border border-white/10 bg-[#03100b] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center"><div className="min-w-0 lg:w-56"><p className="font-black text-white">{names.get(report.trainee_id) || "Unknown trainee"}</p><p className="mt-1 text-xs text-gray-500">{date(report.occurred_on)}</p></div><div className="grid flex-1 grid-cols-2 gap-3 text-xs sm:grid-cols-4"><div><p className="text-gray-600">Phase</p><p className="mt-1 font-black text-cyan-200">Phase {report.phase}</p></div><div><p className="text-gray-600">Activity</p><p className="mt-1 font-bold capitalize">{report.activity.replace("-", " ")}</p></div><div><p className="text-gray-600">Pilot supervisor</p><p className="mt-1 font-bold">{report.pilot_supervisor}</p></div><div><p className="text-gray-600">Zeus / operation</p><p className="mt-1 font-bold">{report.zeus} · {report.operation_type}</p></div></div>{data?.permissions.canEdit && <div className="flex gap-2"><button type="button" onClick={() => setDraft({ ...report, occurred_on: report.occurred_on.slice(0, 10) })} title="Edit response" className="grid h-9 w-9 place-items-center border border-cyan-300/30 text-cyan-200"><Pencil size={15}/></button><button type="button" onClick={() => { if (window.confirm("Delete this ridealong response?")) void submit({ action: "delete-report", id: report.id }, "Response deleted."); }} title="Delete response" className="grid h-9 w-9 place-items-center border border-red-300/30 text-red-200"><Trash2 size={15}/></button></div>}</div></article>)}{!reports.length && <p className="p-12 text-center text-sm text-gray-500">No responses match the current filters.</p>}</div>}
    </section>
    {draft && <div className="fixed inset-0 z-[120] flex bg-black/90 p-0 sm:p-4"><section role="dialog" aria-modal="true" aria-labelledby="response-edit-title" className="mx-auto flex h-full w-full max-w-2xl flex-col border border-cyan-300/30 bg-[#020806] sm:h-auto sm:max-h-[92vh]"><header className="flex items-start justify-between border-b border-white/10 p-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Response correction</p><h2 id="response-edit-title" className="mt-2 text-2xl font-black uppercase">Edit ridealong</h2></div><button type="button" onClick={() => setDraft(null)} className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400" aria-label="Close"><X size={18}/></button></header><div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 sm:grid-cols-2"><label className="sm:col-span-2"><span className="text-xs font-black uppercase text-gray-500">Trainee</span><select value={draft.trainee_id} onChange={(event) => setDraft({ ...draft, trainee_id: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3">{data?.trainees.map((trainee) => <option key={trainee.id} value={trainee.id}>{trainee.name}</option>)}</select></label><label><span className="text-xs font-black uppercase text-gray-500">Phase</span><select value={draft.phase} onChange={(event) => setDraft({ ...draft, phase: Number(event.target.value) as 1 | 2 })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"><option value={1}>Phase 1</option><option value={2}>Phase 2</option></select></label><label><span className="text-xs font-black uppercase text-gray-500">Operation</span><select value={draft.operation_type} onChange={(event) => setDraft({ ...draft, operation_type: event.target.value as Report["operation_type"] })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"><option value="mainop">Mainop</option><option value="funop">Funop</option><option value="training">Training</option></select></label><label><span className="text-xs font-black uppercase text-gray-500">Activity</span><select value={draft.activity} onChange={(event) => setDraft({ ...draft, activity: event.target.value as Report["activity"] })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"><option value="ball-gunning">Ball Gunning</option><option value="flying">Flying</option></select></label><label><span className="text-xs font-black uppercase text-gray-500">Date</span><input type="date" value={draft.occurred_on} onChange={(event) => setDraft({ ...draft, occurred_on: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"/></label><label><span className="text-xs font-black uppercase text-gray-500">Zeus</span><input value={draft.zeus} onChange={(event) => setDraft({ ...draft, zeus: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"/></label><label><span className="text-xs font-black uppercase text-gray-500">Pilot supervisor</span><input value={draft.pilot_supervisor} onChange={(event) => setDraft({ ...draft, pilot_supervisor: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3"/></label></div><footer className="flex justify-end gap-2 border-t border-white/10 p-4"><button type="button" onClick={() => setDraft(null)} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="button" disabled={saving} onClick={() => void submit({ action: "update-report", id: draft.id, traineeId: draft.trainee_id, phase: draft.phase, operationType: draft.operation_type, zeus: draft.zeus, pilotSupervisor: draft.pilot_supervisor, activity: draft.activity, occurredOn: draft.occurred_on }, "Response updated and tracker totals recalculated.")} className="border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-50">{saving ? "Saving..." : "Save correction"}</button></footer></section></div>}
  </main>;
}
