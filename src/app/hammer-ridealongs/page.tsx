"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Eye,
  FilePlus2,
  Pencil,
  Plane,
  RotateCcw,
  Search,
  Send,
  SlidersHorizontal,
  Trash2,
  UserRoundPlus,
  X,
} from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";

type Trainee = {
  id: string;
  personnel_id: string | null;
  name: string;
  started_course: string | null;
  ground_school: string;
  flight_school: string;
  sere: string;
  cxc_test: string;
  flight: string;
  joining_hammer: boolean;
  phase1_adjustment: number;
  phase2_adjustment: number;
  notes: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type Ridealong = {
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

type TrackerResponse = {
  trainees: Trainee[];
  reports: Ridealong[];
  personnel: PersonnelOption[];
  permissions: { canEdit: boolean; canFull: boolean };
  error?: string;
};

type TraineeDraft = {
  id: string;
  personnelId: string;
  name: string;
  startedCourse: string;
  groundSchool: string;
  flightSchool: string;
  sere: string;
  cxcTest: string;
  flight: string;
  joiningHammer: boolean;
  notes: string;
};

type PersonnelOption = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_name: string | null;
};

const blankDraft: TraineeDraft = {
  id: "",
  personnelId: "",
  name: "",
  startedCourse: "",
  groundSchool: "Not Complete",
  flightSchool: "Not Complete",
  sere: "Waived",
  cxcTest: "Not Complete",
  flight: "",
  joiningHammer: false,
  notes: "",
};

const statusOptions = ["Not Complete", "Complete", "Waived"] as const;
const flightOptions = ["Hammer 1", "Hammer 2", "Hammer 3", "Hammer 4"] as const;

function milestoneValue(value: string) {
  return statusOptions.includes(value as (typeof statusOptions)[number]) ? value : "Not Complete";
}

function milestoneDone(value: string) {
  return value === "Complete" || value === "Waived";
}

function displayDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function phaseReports(reports: Ridealong[], traineeId: string, phase: 1 | 2) {
  return reports.filter((report) => report.trainee_id === traineeId && report.phase === phase);
}

function phaseTotal(trainee: Trainee, reports: Ridealong[], phase: 1 | 2) {
  const submitted = phaseReports(reports, trainee.id, phase).length;
  const adjustment = phase === 1 ? trainee.phase1_adjustment : trainee.phase2_adjustment;
  return Math.max(0, submitted + adjustment);
}

function Milestone({ label, value }: { label: string; value: string | null }) {
  const statusClass = value === "Complete" ? "text-[#00ff66]" : value === "Waived" ? "text-amber-300" : value === "Not Complete" ? "text-red-300" : value ? "text-[#dcebe3]" : "text-[#536158]";
  return (
    <div className="min-w-0 border-l border-white/10 px-3 py-3 first:border-l-0">
      <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#63766c]">{label}</p>
      <p className={`mt-2 truncate text-xs font-bold ${statusClass}`} title={value || "Not recorded"}>
        {value || "Pending"}
      </p>
    </div>
  );
}

function traineeComplete(trainee: Trainee, reports: Ridealong[]) {
  return phaseTotal(trainee, reports, 1) >= 2
    && phaseTotal(trainee, reports, 2) >= 6
    && milestoneDone(trainee.ground_school)
    && milestoneDone(trainee.flight_school)
    && milestoneDone(trainee.sere)
    && milestoneDone(trainee.cxc_test);
}

function PhaseProgress({ current, target }: { current: number; target: number }) {
  const complete = current >= target;
  return (
    <div className="border-l border-white/10 px-3 py-3">
      <p className="text-[9px] font-black uppercase tracking-[.12em] text-[#63766c]">Ridealongs</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1">
          {Array.from({ length: target }, (_, index) => (
            <span key={index} className={`h-2 w-5 border ${index < current ? "border-[#00ff66] bg-[#00ff66]" : "border-white/20 bg-white/[.03]"}`} />
          ))}
        </div>
        <span className={`text-xs font-black ${complete ? "text-[#00ff66]" : "text-gray-400"}`}>{current}/{target}</span>
      </div>
    </div>
  );
}

export default function HammerRidealongTrackerPage() {
  const [data, setData] = useState<TrackerResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [selected, setSelected] = useState<Trainee | null>(null);
  const [draft, setDraft] = useState<TraineeDraft | null>(null);
  const [countDraft, setCountDraft] = useState<{ id: string; name: string; phase1Total: number; phase2Total: number; submitted1: number; submitted2: number } | null>(null);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (archived = showArchived) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/hammer-ridealongs${archived ? "?archived=1" : ""}`, {
        cache: "no-store",
        credentials: "same-origin",
        headers: await getAppAuthHeaders(),
      });
      const body = await response.json() as TrackerResponse;
      if (!response.ok) throw new Error(body.error || "Unable to load tracker");
      setData(body);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load tracker");
    } finally {
      setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!selected && !draft && !countDraft) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [countDraft, draft, selected]);

  const visibleTrainees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.trainees || []).filter((trainee) => !query || [trainee.name, trainee.flight, trainee.ground_school]
      .some((value) => value.toLowerCase().includes(query)));
  }, [data?.trainees, search]);

  const stats = useMemo(() => {
    const active = (data?.trainees || []).filter((trainee) => trainee.active);
    const completed = active.filter((trainee) => traineeComplete(trainee, data?.reports || [])).length;
    return { active: active.length, completed, reports: data?.reports.length || 0 };
  }, [data]);

  const selectedPersonnel = useMemo(() => data?.personnel.find((person) => person.id === draft?.personnelId) || null, [data?.personnel, draft?.personnelId]);
  const personnelResults = useMemo(() => {
    const query = personnelSearch.trim().toLowerCase();
    if (!query || draft?.personnelId) return [];
    return (data?.personnel || []).filter((person) => [person.name, person.birth_number || "", person.rank_name || ""]
      .some((value) => value.toLowerCase().includes(query))).slice(0, 12);
  }, [data?.personnel, draft?.personnelId, personnelSearch]);

  function editTrainee(trainee: Trainee) {
    setSelected(null);
    setDraft({
      id: trainee.id,
      personnelId: trainee.personnel_id || "",
      name: trainee.name,
      startedCourse: trainee.started_course?.slice(0, 10) || "",
      groundSchool: milestoneValue(trainee.ground_school),
      flightSchool: milestoneValue(trainee.flight_school),
      sere: trainee.joining_hammer ? milestoneValue(trainee.sere) : "Waived",
      cxcTest: milestoneValue(trainee.cxc_test),
      flight: flightOptions.includes(trainee.flight as (typeof flightOptions)[number]) ? trainee.flight : "",
      joiningHammer: trainee.joining_hammer,
      notes: trainee.notes,
    });
    setPersonnelSearch(trainee.name);
  }

  async function action(payload: Record<string, unknown>, success: string) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/hammer-ridealongs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Update failed");
      setMessage(success);
      setDraft(null);
      setCountDraft(null);
      setSelected(null);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!draft?.personnelId) return setMessage("Select an active personnel profile.");
    await action({
      action: draft.id ? "update-trainee" : "create-trainee",
      ...draft,
    }, draft.id ? "Trainee profile updated." : "Trainee added to the tracker.");
  }

  function adjustCounts(trainee: Trainee) {
    const reports = data?.reports || [];
    setSelected(null);
    setCountDraft({
      id: trainee.id,
      name: trainee.name,
      phase1Total: phaseTotal(trainee, reports, 1),
      phase2Total: phaseTotal(trainee, reports, 2),
      submitted1: phaseReports(reports, trainee.id, 1).length,
      submitted2: phaseReports(reports, trainee.id, 2).length,
    });
  }

  const selectedReports = selected ? (data?.reports || []).filter((report) => report.trainee_id === selected.id) : [];
  const selectedComplete = selected ? traineeComplete(selected, data?.reports || []) : false;

  return (
    <main className="min-h-screen bg-[#020806] px-3 py-8 text-white sm:px-6 lg:px-10">
      <section className="mx-auto max-w-[1700px] border border-[#00ff66]/25 bg-black/75">
        <header className="border-b border-[#00ff66]/20 p-5 sm:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.2em] text-[#00ff66]"><Plane size={15} />Hammer Aviation</p>
              <h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Ridealong Tracker</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8ba095]">Public progression record for Hammer trainees completing ground school, supervised flight phases, SERE, and the CX-C test.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/hammer-ridealong-report" className="flex items-center gap-2 border border-cyan-300/40 bg-cyan-300/[.07] px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-cyan-200 hover:bg-cyan-300/[.12]"><Send size={16}/>Submit Ridealong</Link>
              <Link href="/hammer-ridealongs/responses" className="flex items-center gap-2 border border-cyan-300/25 px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-cyan-100 hover:bg-cyan-300/[.07]"><ClipboardList size={16}/>Responses</Link>
              <Link href="/hammer-ridealongs/archive" className="flex items-center gap-2 border border-amber-300/35 bg-amber-300/[.05] px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-amber-200 hover:bg-amber-300/[.1]"><Archive size={16}/>Archive</Link>
              {data?.permissions.canEdit && <button type="button" onClick={() => { setMessage(""); setPersonnelSearch(""); setDraft({ ...blankDraft }); }} className="flex items-center gap-2 border border-[#00ff66]/50 bg-[#00ff66]/10 px-4 py-3 text-xs font-black uppercase tracking-[.12em] text-[#00ff66] hover:bg-[#00ff66]/15"><UserRoundPlus size={16}/>Add Trainee</button>}
            </div>
          </div>
          <div className="mt-6 grid gap-px bg-[#00ff66]/15 sm:grid-cols-3">
            <div className="bg-[#03100b] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-gray-500">Active trainees</p><p className="mt-2 text-2xl font-black text-[#00ff66]">{stats.active}</p></div>
            <div className="bg-[#03100b] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-gray-500">Ridealongs logged</p><p className="mt-2 text-2xl font-black text-cyan-200">{stats.reports}</p></div>
            <div className="bg-[#03100b] p-4"><p className="text-[9px] font-black uppercase tracking-[.16em] text-gray-500">Requirements complete</p><p className="mt-2 text-2xl font-black text-amber-200">{stats.completed}</p></div>
          </div>
        </header>

        <div className="flex flex-col gap-3 border-b border-[#00ff66]/15 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search trainees</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trainee, flight, or instructor" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/55"/></label>
          {data?.permissions.canEdit && <label className="flex cursor-pointer items-center gap-3 text-xs font-bold uppercase tracking-[.1em] text-gray-400"><input type="checkbox" checked={showArchived} onChange={(event) => { setShowArchived(event.target.checked); }} className="h-4 w-4 accent-[#00ff66]"/>Show archived</label>}
        </div>

        {error && <p className="border-b border-red-300/25 bg-red-300/10 p-4 text-red-100">{error}</p>}
        {message && <p className="border-b border-cyan-300/25 bg-cyan-300/[.06] p-4 text-cyan-100">{message}</p>}
        {loading && <div className="p-12 text-center text-sm uppercase tracking-[.14em] text-gray-500">Loading Hammer progression...</div>}

        {!loading && <div className="hidden overflow-x-auto lg:block">
          <div className="min-w-[1450px]">
            <div className="grid grid-cols-[220px_130px_150px_190px_150px_260px_120px_120px_140px_100px] border-b border-[#00ff66]/20 bg-[#04110c] text-[9px] font-black uppercase tracking-[.12em] text-[#74877c]">
              {['Trainee','Course start','Ground school','Phase 1','Flight school','Phase 2','SERE','CX-C test','Flight',''].map((label) => <div key={label} className="border-l border-white/10 px-3 py-3 first:border-l-0">{label}</div>)}
            </div>
            {visibleTrainees.map((trainee) => {
              const reports = data?.reports || [];
              const phase1 = phaseTotal(trainee, reports, 1);
              const phase2 = phaseTotal(trainee, reports, 2);
              return <article key={trainee.id} className={`grid grid-cols-[220px_130px_150px_190px_150px_260px_120px_120px_140px_100px] border-b border-white/8 transition hover:bg-white/[.025] ${trainee.active ? "" : "opacity-50"}`}>
                <button type="button" onClick={() => setSelected(trainee)} className="px-3 py-4 text-left"><p className="font-black text-white">{trainee.name}</p><p className="mt-1 text-[9px] uppercase tracking-[.12em] text-[#00ff66]">{trainee.active ? "Active" : "Archived"}</p></button>
                <Milestone label="Started" value={trainee.started_course ? displayDate(trainee.started_course) : null}/>
                <Milestone label="Instructor" value={trainee.ground_school}/>
                <PhaseProgress current={phase1} target={2}/>
                <Milestone label="Instructor" value={trainee.flight_school}/>
                <PhaseProgress current={phase2} target={6}/>
                <Milestone label="Status" value={trainee.sere}/>
                <Milestone label="Status" value={trainee.cxc_test}/>
                <Milestone label="Assignment" value={trainee.joining_hammer ? trainee.flight : "Not joining"}/>
                <div className="flex items-center justify-center gap-1 border-l border-white/10 px-2">
                  <button type="button" onClick={() => setSelected(trainee)} title="View details" className="grid h-9 w-9 place-items-center border border-white/10 text-gray-400 hover:border-cyan-300/40 hover:text-cyan-200"><Eye size={15}/></button>
                  {data?.permissions.canEdit && <button type="button" onClick={() => editTrainee(trainee)} title="Edit trainee" className="grid h-9 w-9 place-items-center border border-white/10 text-gray-400 hover:border-[#00ff66]/40 hover:text-[#00ff66]"><Pencil size={15}/></button>}
                </div>
              </article>;
            })}
          </div>
        </div>}

        {!loading && <div className="grid gap-3 p-3 lg:hidden">
          {visibleTrainees.map((trainee) => {
            const phase1 = phaseTotal(trainee, data?.reports || [], 1);
            const phase2 = phaseTotal(trainee, data?.reports || [], 2);
            return <button type="button" key={trainee.id} onClick={() => setSelected(trainee)} className={`border border-white/10 bg-[#03100b] p-4 text-left ${trainee.active ? "" : "opacity-50"}`}>
              <div className="flex items-start justify-between gap-3"><div><p className="font-black text-white">{trainee.name}</p><p className="mt-1 text-xs text-gray-500">{trainee.joining_hammer ? (trainee.flight || "Flight unassigned") : "Not joining Hammer"}</p></div><span className="border border-[#00ff66]/25 px-2 py-1 text-[9px] font-black uppercase text-[#00ff66]">{trainee.active ? "Active" : "Archived"}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><p className="text-gray-600">Phase 1</p><p className="mt-1 font-black text-cyan-200">{phase1}/2</p></div><div><p className="text-gray-600">Phase 2</p><p className="mt-1 font-black text-cyan-200">{phase2}/6</p></div><div><p className="text-gray-600">Course start</p><p className="mt-1 text-gray-300">{displayDate(trainee.started_course)}</p></div><div><p className="text-gray-600">CX-C test</p><p className="mt-1 text-gray-300">{trainee.cxc_test || "Pending"}</p></div></div>
            </button>;
          })}
        </div>}
        {!loading && !visibleTrainees.length && <div className="p-12 text-center"><ClipboardList className="mx-auto text-gray-700"/><p className="mt-4 font-black uppercase">No trainees found</p><p className="mt-2 text-sm text-gray-500">Add a trainee or adjust the current search.</p></div>}
      </section>

      {selected && <div className="fixed inset-0 z-[100] flex bg-black/90 p-0 sm:p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="trainee-detail-title" className="mx-auto flex h-full w-full max-w-4xl flex-col border border-[#00ff66]/30 bg-[#020806] sm:h-[92vh]">
          <header className="flex items-start justify-between gap-4 border-b border-[#00ff66]/20 p-5"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#00ff66]">Hammer trainee record</p><h2 id="trainee-detail-title" className="mt-2 text-2xl font-black">{selected.name}</h2><p className="mt-2 text-sm text-gray-500">{selected.joining_hammer ? (selected.flight || "Flight not assigned") : "Not joining Hammer"}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="Close trainee details" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400 hover:text-white"><X size={18}/></button></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            {selectedComplete && selected.active && <div className="mb-4 flex items-center gap-3 border border-[#00ff66]/30 bg-[#00ff66]/[.06] p-4"><CheckCircle2 className="shrink-0 text-[#00ff66]"/><div><p className="font-black uppercase text-[#00ff66]">Progression complete</p><p className="mt-1 text-xs text-[#8aa396]">All required milestones and ridealongs are complete. This record is ready to archive.</p></div></div>}
            <div className="grid gap-px bg-[#00ff66]/10 sm:grid-cols-2 lg:grid-cols-4">{[
              ["Course start", displayDate(selected.started_course)], ["Ground school", selected.ground_school || "Pending"], ["Flight school", selected.flight_school || "Pending"], ["SERE", selected.sere || "Pending"], ["CX-C test", selected.cxc_test || "Pending"], ["Joining Hammer", selected.joining_hammer ? "Yes" : "No"], ["Flight", selected.joining_hammer ? (selected.flight || "Unassigned") : "Not applicable"],
            ].map(([label,value]) => <div key={label} className="bg-[#03100b] p-4"><p className="text-[9px] font-black uppercase tracking-[.12em] text-gray-600">{label}</p><p className={`mt-2 text-sm font-bold ${value === "Complete" ? "text-[#00ff66]" : value === "Waived" ? "text-amber-300" : value === "Not Complete" ? "text-red-300" : "text-gray-200"}`}>{value}</p></div>)}</div>
            {selected.notes && <div className="mt-4 border border-amber-300/20 bg-amber-300/[.04] p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-amber-200">Admin notes</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-300">{selected.notes}</p></div>}
            {(selected.phase1_adjustment !== 0 || selected.phase2_adjustment !== 0) && <div className="mt-4 border border-cyan-300/20 bg-cyan-300/[.04] p-4"><p className="text-[9px] font-black uppercase tracking-[.14em] text-cyan-200">Manual count adjustment</p><p className="mt-2 text-sm text-gray-300">Phase 1 {selected.phase1_adjustment >= 0 ? "+" : ""}{selected.phase1_adjustment} · Phase 2 {selected.phase2_adjustment >= 0 ? "+" : ""}{selected.phase2_adjustment}</p></div>}
            <div className="mt-6"><h3 className="text-sm font-black uppercase tracking-[.14em] text-[#00ff66]">Ridealong history</h3><div className="mt-3 grid gap-3">
              {selectedReports.map((report, index) => <article key={report.id} className="border border-white/10 bg-[#03100b] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-black text-white">Phase {report.phase} Ridealong {index + 1}</p><p className="mt-1 text-xs uppercase tracking-[.1em] text-cyan-200">{report.activity.replace("-", " ")} · {report.operation_type}</p></div><div className="flex items-center gap-2"><span className="text-sm text-gray-400">{displayDate(report.occurred_on)}</span>{data?.permissions.canEdit && <button type="button" onClick={() => void action({ action: "delete-report", id: report.id }, "Ridealong report removed.")} disabled={saving} title="Remove incorrect report" className="grid h-8 w-8 place-items-center border border-red-300/25 text-red-200 hover:bg-red-300/10"><Trash2 size={14}/></button>}</div></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-gray-600">Pilot supervisor</dt><dd className="mt-1 text-gray-200">{report.pilot_supervisor}</dd></div><div><dt className="text-gray-600">Zeus</dt><dd className="mt-1 text-gray-200">{report.zeus}</dd></div></dl></article>)}
              {!selectedReports.length && <p className="border border-white/10 p-5 text-sm text-gray-500">No ridealongs have been submitted for this trainee.</p>}
            </div></div>
          </div>
          {data?.permissions.canEdit && <footer className="flex flex-wrap justify-between gap-2 border-t border-white/10 p-4"><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void action({ action: "set-active", id: selected.id, active: !selected.active }, selected.active ? "Trainee archived." : "Trainee restored.")} disabled={saving} className={`flex items-center gap-2 border px-3 py-2 text-xs font-black uppercase ${selectedComplete && selected.active ? "border-[#00ff66]/50 bg-[#00ff66]/10 text-[#00ff66]" : "border-amber-300/30 text-amber-200"}`}>{selected.active ? <Archive size={15}/> : <RotateCcw size={15}/>} {selected.active && selectedComplete ? "Archive completed trainee" : selected.active ? "Archive" : "Restore"}</button>{data.permissions.canFull && <button type="button" onClick={() => { if (window.confirm(`Permanently remove ${selected.name} and all of their ridealong reports? This cannot be undone.`)) void action({ action: "delete-trainee", id: selected.id }, "Trainee permanently removed."); }} disabled={saving} className="flex items-center gap-2 border border-red-300/30 px-3 py-2 text-xs font-black uppercase text-red-200 hover:bg-red-300/10"><Trash2 size={15}/>Remove permanently</button>}</div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => adjustCounts(selected)} className="flex items-center gap-2 border border-cyan-300/35 px-4 py-2 text-xs font-black uppercase text-cyan-200"><SlidersHorizontal size={15}/>Adjust ridealong totals</button><button type="button" onClick={() => editTrainee(selected)} className="flex items-center gap-2 border border-[#00ff66]/40 px-4 py-2 text-xs font-black uppercase text-[#00ff66]"><Pencil size={15}/>Edit milestones</button></div></footer>}
        </section>
      </div>}

      {draft && <div className="fixed inset-0 z-[110] flex bg-black/90 p-0 sm:p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="trainee-edit-title" className="mx-auto flex h-full w-full max-w-3xl flex-col border border-[#00ff66]/30 bg-[#020806] sm:h-auto sm:max-h-[92vh]">
          <header className="flex items-start justify-between gap-4 border-b border-[#00ff66]/20 p-5"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#00ff66]">Tracker administration</p><h2 id="trainee-edit-title" className="mt-2 text-2xl font-black uppercase">{draft.id ? "Edit trainee" : "Add trainee"}</h2></div><button type="button" onClick={() => setDraft(null)} aria-label="Close editor" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400"><X size={18}/></button></header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5"><div className="grid gap-4 sm:grid-cols-2">
            <div className="relative sm:col-span-2">
              <span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Trainee profile *</span>
              {selectedPersonnel ? <div className="mt-2 flex min-h-12 items-center justify-between gap-3 border border-[#00ff66]/35 bg-[#00ff66]/[.06] px-3">
                <span className="min-w-0"><strong className="block truncate text-sm">{selectedPersonnel.name}</strong><span className="block truncate text-xs text-[#779184]">{[selectedPersonnel.rank_name, selectedPersonnel.birth_number].filter(Boolean).join(" · ") || "Active personnel profile"}</span></span>
                <button type="button" onClick={() => { setDraft({ ...draft, personnelId: "", name: "" }); setPersonnelSearch(""); }} className="shrink-0 border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-gray-300 hover:border-[#00ff66]/30">Change</button>
              </div> : <>
                <div className="relative mt-2"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><input value={personnelSearch} onChange={(event) => { setPersonnelSearch(event.target.value); setDraft({ ...draft, personnelId: "", name: "" }); }} placeholder="Search active personnel by name, rank, or service number" autoComplete="off" className="h-12 w-full border border-white/15 bg-black pl-10 pr-3 outline-none focus:border-[#00ff66]/60"/></div>
                {personnelSearch.trim() && <div className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto border border-[#00ff66]/25 bg-[#020806] shadow-[0_18px_45px_rgba(0,0,0,.85)]">{personnelResults.length ? personnelResults.map((person) => <button type="button" key={person.id} onClick={() => { setDraft({ ...draft, personnelId: person.id, name: person.name }); setPersonnelSearch(person.name); }} className="flex w-full items-center justify-between gap-3 border-b border-white/10 p-3 text-left last:border-b-0 hover:bg-[#00ff66]/[.07]"><span><strong className="block text-sm">{person.name}</strong><span className="mt-1 block text-xs text-gray-600">{person.rank_name || "Rank not set"}</span></span><span className="font-mono text-xs text-[#71877a]">{person.birth_number || "No number"}</span></button>) : <p className="p-4 text-sm text-[#78887e]">No matching active personnel.</p>}</div>}
              </>}
            </div>
            <label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Started course</span><input type="date" value={draft.startedCourse} onChange={(event) => setDraft({ ...draft, startedCourse: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/60"/></label>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 border border-white/15 bg-black px-3 py-2"><input type="checkbox" checked={draft.joiningHammer} onChange={(event) => setDraft({ ...draft, joiningHammer: event.target.checked, flight: event.target.checked ? draft.flight : "", sere: event.target.checked ? "Not Complete" : "Waived" })} className="h-4 w-4 accent-[#00ff66]"/><span><span className="block text-xs font-black uppercase tracking-[.12em] text-gray-300">Joining Hammer</span><span className="mt-1 block text-[10px] text-gray-600">Enables an optional flight assignment.</span></span></label>
            {draft.joiningHammer && <label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Flight assignment <span className="font-normal normal-case text-gray-600">(optional)</span></span><select value={draft.flight} onChange={(event) => setDraft({ ...draft, flight: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/60"><option value="">Unassigned</option>{flightOptions.map((flight) => <option key={flight} value={flight}>{flight}</option>)}</select></label>}
            {([['Ground school','groundSchool'],['Flight school','flightSchool'],['SERE','sere'],['CX-C test','cxcTest']] as const).map(([label,key]) => <label key={key}><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">{label}</span><select value={key === "sere" && !draft.joiningHammer ? "Waived" : draft[key]} onChange={(event) => setDraft({ ...draft, [key]: event.target.value })} disabled={key === "sere" && !draft.joiningHammer} className={`mt-2 h-11 w-full border bg-black px-3 outline-none ${draft[key] === "Complete" ? "border-[#00ff66]/45 text-[#00ff66]" : draft[key] === "Waived" ? "border-amber-300/40 text-amber-300" : "border-red-300/35 text-red-300"}`}>{statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}</select></label>)}
            <label className="sm:col-span-2"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Internal notes</span><textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} rows={4} className="mt-2 w-full resize-y border border-white/15 bg-black p-3 outline-none focus:border-[#00ff66]/60"/></label>
          </div></div>
          <footer className="flex justify-end gap-2 border-t border-white/10 p-4"><button type="button" onClick={() => setDraft(null)} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="button" onClick={() => void saveDraft()} disabled={saving} className="flex items-center gap-2 border border-[#00ff66] bg-[#00ff66] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-50">{draft.id ? <CheckCircle2 size={16}/> : <FilePlus2 size={16}/>} {saving ? "Saving..." : draft.id ? "Save changes" : "Add trainee"}</button></footer>
        </section>
      </div>}

      {countDraft && <div className="fixed inset-0 z-[115] flex bg-black/90 p-0 sm:p-4" role="presentation">
        <section role="dialog" aria-modal="true" aria-labelledby="ridealong-count-title" className="mx-auto h-full w-full max-w-xl border border-cyan-300/30 bg-[#020806] sm:h-auto sm:self-center">
          <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-xs font-black uppercase tracking-[.16em] text-cyan-200">Manual correction</p><h2 id="ridealong-count-title" className="mt-2 text-2xl font-black uppercase">Ridealong totals</h2><p className="mt-2 text-sm text-gray-500">{countDraft.name}</p></div><button type="button" onClick={() => setCountDraft(null)} aria-label="Close count editor" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400"><X size={18}/></button></header>
          <div className="p-5"><p className="border border-amber-300/20 bg-amber-300/[.04] p-3 text-xs leading-5 text-amber-100">Use this only to correct totals when a form was missed or entered incorrectly. The submitted response records remain unchanged, and this correction is written to the audit log.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Phase 1 completed</span><input type="number" min={0} max={99} value={countDraft.phase1Total} onChange={(event) => setCountDraft({ ...countDraft, phase1Total: Math.max(0, Math.min(99, Number(event.target.value))) })} className="mt-2 h-12 w-full border border-white/15 bg-black px-3 text-xl font-black text-cyan-200 outline-none focus:border-cyan-300/50"/><span className="mt-2 block text-xs text-gray-600">{countDraft.submitted1} submitted form{countDraft.submitted1 === 1 ? "" : "s"}</span></label>
            <label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Phase 2 completed</span><input type="number" min={0} max={99} value={countDraft.phase2Total} onChange={(event) => setCountDraft({ ...countDraft, phase2Total: Math.max(0, Math.min(99, Number(event.target.value))) })} className="mt-2 h-12 w-full border border-white/15 bg-black px-3 text-xl font-black text-cyan-200 outline-none focus:border-cyan-300/50"/><span className="mt-2 block text-xs text-gray-600">{countDraft.submitted2} submitted form{countDraft.submitted2 === 1 ? "" : "s"}</span></label>
          </div></div>
          <footer className="flex justify-end gap-2 border-t border-white/10 p-4"><button type="button" onClick={() => setCountDraft(null)} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="button" disabled={saving} onClick={() => void action({ action: "set-ridealong-counts", id: countDraft.id, phase1Total: countDraft.phase1Total, phase2Total: countDraft.phase2Total }, "Ridealong totals updated and recorded in the audit log.")} className="flex items-center gap-2 border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-50"><SlidersHorizontal size={16}/>{saving ? "Saving..." : "Save audited correction"}</button></footer>
        </section>
      </div>}
    </main>
  );
}
