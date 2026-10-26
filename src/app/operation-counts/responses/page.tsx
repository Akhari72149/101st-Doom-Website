"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Plus, Search, Send, Shield, ShieldAlert, Swords, X } from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";

type Submission = {
  id: string;
  personnel_id: string;
  personnel_name: string;
  birth_number: string | null;
  rank_stage: "CR" | "CR-C";
  attendance_type: "mainop" | "funop" | "rto-course" | "cls-course";
  host_name: string;
  occurred_on: string;
  created_at: string;
};

type PersonnelOption = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_stage: "CR" | "CR-C";
  mainOps: number;
  nonMainCredits: number;
  creditedTotal: number;
};

const labels: Record<Submission["attendance_type"], string> = {
  mainop: "Main Operation",
  funop: "Fun Operation",
  "rto-course": "RTO Qualification",
  "cls-course": "CLS Qualification",
};

const attendanceTypes = [
  { value: "mainop", label: "Main Operation", detail: "Required at least once", icon: Swords },
  { value: "funop", label: "Fun Operation", detail: "Up to three non-Main credits", icon: Shield },
  { value: "rto-course", label: "RTO Qualification", detail: "CR-C only", icon: GraduationCap },
  { value: "cls-course", label: "CLS Qualification", detail: "CR-C only", icon: GraduationCap },
] as const;

function localToday() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

export default function OperationCountResponsesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelOption[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [rank, setRank] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [personnelSearch, setPersonnelSearch] = useState("");
  const [personnelId, setPersonnelId] = useState("");
  const [attendanceType, setAttendanceType] = useState("mainop");
  const [hostName, setHostName] = useState("");
  const [occurredOn, setOccurredOn] = useState(localToday());
  const [submitting, setSubmitting] = useState(false);

  async function loadResponses(active = true) {
      try {
        const response = await fetch("/api/operation-counts?responses=1", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
        const body = await response.json() as { submissions?: Submission[]; personnel?: PersonnelOption[]; canEdit?: boolean; error?: string };
        if (!response.ok) throw new Error(body.error || "Unable to load submitted forms");
        if (active) {
          setSubmissions(body.submissions || []);
          setPersonnel(body.personnel || []);
          setCanEdit(Boolean(body.canEdit));
        }
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load submitted forms");
      } finally {
        if (active) setLoading(false);
      }
  }

  useEffect(() => {
    let active = true;
    void loadResponses(active);
    return () => { active = false; };
  }, []);

  const selectedPerson = personnel.find((person) => person.id === personnelId) || null;
  const filteredPersonnel = useMemo(() => {
    const query = personnelSearch.trim().toLowerCase();
    return personnel.filter((person) => !query || `${person.name} ${person.birth_number || ""}`.toLowerCase().includes(query));
  }, [personnel, personnelSearch]);

  useEffect(() => {
    if (!selectedPerson) return;
    const isCourse = attendanceType === "rto-course" || attendanceType === "cls-course";
    if ((selectedPerson.rank_stage === "CR" && isCourse) || (selectedPerson.nonMainCredits >= 3 && attendanceType !== "mainop")) setAttendanceType("mainop");
  }, [attendanceType, selectedPerson]);

  function resetCreate() {
    setPersonnelId("");
    setPersonnelSearch("");
    setAttendanceType("mainop");
    setHostName("");
    setOccurredOn(localToday());
    setFormError("");
    setShowCreate(false);
  }

  async function submitCount(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setFormError("");
    setSuccess("");
    try {
      const response = await fetch("/api/operation-counts", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ personnelId, attendanceType, hostName, occurredOn }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to save operation count");
      const name = selectedPerson?.name || "the selected member";
      resetCreate();
      setSuccess(`Operation count saved for ${name}.`);
      await loadResponses();
    } catch (caught) {
      setFormError(caught instanceof Error ? caught.message : "Unable to save operation count");
    } finally {
      setSubmitting(false);
    }
  }

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return submissions.filter((entry) => {
      if (type !== "all" && entry.attendance_type !== type) return false;
      if (rank !== "all" && entry.rank_stage !== rank) return false;
      if (fromDate && entry.occurred_on < fromDate) return false;
      if (toDate && entry.occurred_on > toDate) return false;
      return !query || `${entry.personnel_name} ${entry.birth_number || ""} ${entry.host_name}`.toLowerCase().includes(query);
    });
  }, [fromDate, rank, search, submissions, toDate, type]);

  return <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6 lg:px-10">
    <section className="mx-auto max-w-7xl border border-cyan-300/25 bg-black/70">
      <header className="border-b border-cyan-300/20 p-5 sm:p-8"><Link href="/operation-counts" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-gray-500 hover:text-[#00ff66]"><ArrowLeft size={15}/>Operation tracker</Link><div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div className="flex items-start gap-4"><div className="grid h-12 w-12 shrink-0 place-items-center border border-cyan-300/35 bg-cyan-300/[.08] text-cyan-200"><ClipboardList size={22}/></div><div><p className="text-xs font-black uppercase tracking-[.18em] text-cyan-200">Permission-controlled register</p><h1 className="mt-2 text-3xl font-black uppercase sm:text-5xl">Submitted Forms</h1><p className="mt-3 text-sm text-[#8ba095]">All CR and CR-C operation-count submissions, including the rank held when each form was filed.</p></div></div>{canEdit && <button type="button" onClick={() => { setFormError(""); setSuccess(""); setShowCreate(true); }} className="flex shrink-0 items-center justify-center gap-2 border border-[#00ff66] bg-[#00ff66] px-4 py-3 text-xs font-black uppercase text-black"><Plus size={16}/>Add operation</button>}</div></header>

      <div className="grid gap-2 border-b border-white/10 p-4 lg:grid-cols-[minmax(240px,1fr)_180px_120px_150px_150px]"><label className="relative"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search forms</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search member, number or host" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-cyan-300/50"/></label><select value={type} onChange={(event) => setType(event.target.value)} className="h-11 border border-white/15 bg-black px-3 text-sm"><option value="all">All attendance types</option>{Object.entries(labels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><select value={rank} onChange={(event) => setRank(event.target.value)} className="h-11 border border-white/15 bg-black px-3 text-sm"><option value="all">All ranks</option><option value="CR">CR</option><option value="CR-C">CR-C</option></select><label><span className="sr-only">From date</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} title="From date" className="h-11 w-full border border-white/15 bg-black px-3 text-sm"/></label><label><span className="sr-only">To date</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} title="To date" className="h-11 w-full border border-white/15 bg-black px-3 text-sm"/></label></div>

      {loading && <p className="p-12 text-center text-xs font-black uppercase tracking-[.14em] text-gray-600">Loading submitted forms...</p>}
      {error && <div className="m-5 flex items-start gap-3 border border-red-300/25 bg-red-300/10 p-4 text-red-100"><ShieldAlert className="shrink-0" size={20}/><div><p className="font-black uppercase">Access unavailable</p><p className="mt-1 text-sm">{error}</p></div></div>}
      {success && <div className="m-5 flex items-center gap-3 border border-[#00ff66]/30 bg-[#00ff66]/10 p-4 text-[#b8ffcf]"><CheckCircle2 size={19}/><p className="text-sm">{success}</p></div>}
      {!loading && !error && <div><div className="flex items-center justify-between gap-4 border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[.12em] text-gray-600"><span>{filtered.length} form{filtered.length === 1 ? "" : "s"}</span><span>{submissions.length} total</span></div><div className="divide-y divide-white/8">{filtered.map((entry) => <article key={entry.id} className="grid gap-4 p-4 hover:bg-white/[.02] sm:p-5 lg:grid-cols-[minmax(220px,1.1fr)_180px_minmax(180px,1fr)_150px]"><div className="min-w-0"><div className="flex items-center gap-2"><span className="border border-cyan-300/25 px-2 py-1 text-[9px] font-black text-cyan-200">{entry.rank_stage}</span><p className="truncate font-black">{entry.personnel_name}</p></div><p className="mt-2 font-mono text-[10px] text-gray-600">{entry.birth_number || "No service number"}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-gray-600">Attendance</p><p className={`mt-2 text-sm font-bold ${entry.attendance_type === "mainop" ? "text-[#00ff66]" : "text-white"}`}>{labels[entry.attendance_type]}</p></div><div><p className="text-[9px] font-black uppercase tracking-[.1em] text-gray-600">Zeus / host</p><p className="mt-2 text-sm text-gray-300">{entry.host_name}</p></div><div><p className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[.1em] text-gray-600"><CalendarDays size={12}/>Operation date</p><p className="mt-2 text-sm font-bold">{formatDate(entry.occurred_on)}</p><p className="mt-1 text-[9px] text-gray-700">Filed {formatDateTime(entry.created_at)}</p></div></article>)}{!filtered.length && <p className="p-12 text-center text-sm text-gray-500">No submitted forms match these filters.</p>}</div></div>}
    </section>
    {showCreate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm"><form onSubmit={submitCount} className="max-h-[94vh] w-full max-w-3xl overflow-y-auto border border-[#00ff66]/35 bg-[#020806]"><header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#020806] p-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#00ff66]">Progression entry</p><h2 className="mt-2 text-2xl font-black uppercase">Add operation count</h2></div><button type="button" onClick={resetCreate} aria-label="Close operation entry" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-400"><X size={18}/></button></header><div className="space-y-5 p-5"><fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Personnel</legend><label className="relative mt-3 block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search personnel</span><input value={personnelSearch} onChange={(event) => setPersonnelSearch(event.target.value)} placeholder="Search name or service number" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><div className="mt-2 max-h-44 overflow-y-auto border border-white/10">{filteredPersonnel.map((person) => <label key={person.id} className={`flex cursor-pointer items-center justify-between gap-3 border-b border-white/8 px-3 py-2.5 last:border-b-0 ${personnelId === person.id ? "bg-[#00ff66]/10" : "hover:bg-white/[.03]"}`}><span className="flex items-center gap-3"><input type="radio" name="personnel" checked={personnelId === person.id} onChange={() => setPersonnelId(person.id)} required className="accent-[#00ff66]"/><span><strong className="block text-sm">{person.name}</strong><span className="text-[10px] text-gray-600">{person.birth_number || "No service number"}</span></span></span><span className="border border-cyan-300/25 px-2 py-1 text-[9px] font-black text-cyan-200">{person.rank_stage}</span></label>)}</div>{selectedPerson && <p className="mt-2 border border-cyan-300/20 bg-cyan-300/[.04] p-3 text-xs text-gray-400"><strong className="text-cyan-200">Current:</strong> {selectedPerson.creditedTotal} credited, {selectedPerson.mainOps} Main Op{selectedPerson.rank_stage === "CR-C" ? " · CR counts included" : ""}</p>}</fieldset><fieldset><legend className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Attendance type</legend><div className="mt-3 grid gap-2 sm:grid-cols-2">{attendanceTypes.map((type) => {const courseDisabled=selectedPerson?.rank_stage === "CR" && (type.value === "rto-course" || type.value === "cls-course");const capDisabled=Boolean(selectedPerson && selectedPerson.nonMainCredits >= 3 && type.value !== "mainop");const disabled=!selectedPerson || courseDisabled || capDisabled;const Icon=type.icon;return <label key={type.value} className={`flex items-center gap-3 border p-3 ${disabled ? "cursor-not-allowed border-white/5 opacity-35" : attendanceType === type.value ? "cursor-pointer border-cyan-300 bg-cyan-300/[.08]" : "cursor-pointer border-white/15"}`}><input type="radio" className="sr-only" checked={attendanceType === type.value} onChange={() => setAttendanceType(type.value)} disabled={disabled}/><Icon size={18}/><span><strong className="block text-sm">{type.label}</strong><span className="text-[9px] text-gray-600">{capDisabled ? "Non-Main cap reached" : type.detail}</span></span></label>;})}</div></fieldset><div className="grid gap-4 sm:grid-cols-2"><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Zeus / operation host</span><input value={hostName} onChange={(event) => setHostName(event.target.value)} required maxLength={120} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Operation date</span><input type="date" value={occurredOn} max={localToday()} onChange={(event) => setOccurredOn(event.target.value)} required className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label></div>{formError && <p className="border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{formError}</p>}</div><footer className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-[#020806] p-4"><button type="button" onClick={resetCreate} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="submit" disabled={submitting || !personnelId || !hostName.trim()} className="flex items-center gap-2 border border-[#00ff66] bg-[#00ff66] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-40"><Send size={16}/>{submitting ? "Saving..." : "Save operation"}</button></footer></form></div>}
  </main>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}
