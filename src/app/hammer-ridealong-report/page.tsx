"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CalendarDays, CheckCircle2, KeyRound, Plane, Search, Send } from "lucide-react";

type TraineeOption = { id: string; name: string };

const today = () => new Date().toISOString().slice(0, 10);

export default function HammerRidealongReportPage() {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState("");
  const [trainees, setTrainees] = useState<TraineeOption[]>([]);
  const [traineeSearch, setTraineeSearch] = useState("");
  const [traineeId, setTraineeId] = useState("");
  const [phase, setPhase] = useState<1 | 2>(1);
  const [operationType, setOperationType] = useState("mainop");
  const [zeus, setZeus] = useState("");
  const [pilotSupervisor, setPilotSupervisor] = useState("");
  const [activity, setActivity] = useState("flying");
  const [occurredOn, setOccurredOn] = useState(today());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadForm() {
    setLoading(true);
    try {
      const response = await fetch("/api/hammer-ridealongs?form=1", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401) {
        setUnlocked(false);
        return;
      }
      const body = await response.json() as { trainees?: TraineeOption[]; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load ridealong form");
      setTrainees(body.trainees || []);
      setUnlocked(true);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load ridealong form");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadForm(); }, []);

  const filteredTrainees = useMemo(() => {
    const query = traineeSearch.trim().toLowerCase();
    return trainees.filter((trainee) => !query || trainee.name.toLowerCase().includes(query));
  }, [traineeSearch, trainees]);

  async function unlock(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/hammer-ridealongs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unlock", password }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to unlock form");
      setPassword("");
      await loadForm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to unlock form");
    } finally {
      setSubmitting(false);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/hammer-ridealongs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", traineeId, phase, operationType, zeus, pilotSupervisor, activity, occurredOn }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to submit ridealong");
      const name = trainees.find((trainee) => trainee.id === traineeId)?.name || "the trainee";
      setSuccess(`Ridealong saved for ${name}.`);
      setTraineeId("");
      setTraineeSearch("");
      setZeus("");
      setPilotSupervisor("");
      setOccurredOn(today());
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to submit ridealong";
      setError(message);
      if (message.toLowerCase().includes("password")) setUnlocked(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6">
      <section className="mx-auto max-w-3xl border border-[#00ff66]/25 bg-black/80">
        <header className="border-b border-[#00ff66]/20 p-5 sm:p-8">
          <Link href="/hammer-ridealongs" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-gray-500 hover:text-[#00ff66]"><ArrowLeft size={15}/>Ridealong tracker</Link>
          <div className="mt-5 flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center border border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]"><Plane size={23}/></div>
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-[#00ff66]">Hammer Aviation</p><h1 className="mt-2 text-3xl font-black uppercase">Ridealong Report</h1><p className="mt-3 text-sm leading-6 text-[#8ba095]">Record a supervised Phase 1 or Phase 2 flight. Every field is required.</p></div>
          </div>
        </header>

        {loading && <p className="p-10 text-center text-xs font-bold uppercase tracking-[.14em] text-gray-500">Checking form access...</p>}

        {!loading && !unlocked && <form onSubmit={unlock} className="p-5 sm:p-8">
          <div className="border border-amber-300/25 bg-amber-300/[.04] p-5"><div className="flex items-center gap-3"><KeyRound className="text-amber-200"/><div><h2 className="font-black uppercase">Form access required</h2><p className="mt-1 text-sm text-gray-400">Enter the Hammer shared password to open this reporting session.</p></div></div><label className="mt-5 block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Password</span><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className="mt-2 h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-amber-300/60"/></label><button type="submit" disabled={submitting || !password} className="mt-4 flex h-11 w-full items-center justify-center gap-2 border border-amber-300 bg-amber-300 font-black uppercase text-black disabled:opacity-40"><KeyRound size={16}/>{submitting ? "Checking..." : "Unlock form"}</button></div>
          {error && <p className="mt-4 border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
        </form>}

        {!loading && unlocked && <form onSubmit={submit} className="divide-y divide-white/10">
          <fieldset className="p-5 sm:p-7"><legend className="text-sm font-black uppercase tracking-[.12em] text-[#00ff66]">1. Select trainee</legend><p className="mt-2 text-sm text-gray-500">Only names enrolled on the Hammer tracker are available.</p><label className="relative mt-4 block"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search trainee</span><input value={traineeSearch} onChange={(event) => setTraineeSearch(event.target.value)} placeholder="Search by name" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 outline-none focus:border-[#00ff66]/60"/></label><div className="mt-3 max-h-52 overflow-y-auto border border-white/10 bg-[#03100b]">{filteredTrainees.map((trainee) => <label key={trainee.id} className={`flex cursor-pointer items-center gap-3 border-b border-white/8 px-4 py-3 last:border-b-0 ${traineeId === trainee.id ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-gray-300 hover:bg-white/[.03]"}`}><input type="radio" name="trainee" value={trainee.id} checked={traineeId === trainee.id} onChange={() => setTraineeId(trainee.id)} required className="accent-[#00ff66]"/><span className="font-bold">{trainee.name}</span></label>)}{!filteredTrainees.length && <p className="p-4 text-sm text-gray-500">No enrolled trainee matches that search.</p>}</div></fieldset>

          <fieldset className="p-5 sm:p-7"><legend className="text-sm font-black uppercase tracking-[.12em] text-[#00ff66]">2. Training phase</legend><div className="mt-4 grid grid-cols-2 gap-2">{[1,2].map((value) => <label key={value} className={`cursor-pointer border p-4 text-center text-sm font-black uppercase ${phase === value ? "border-[#00ff66] bg-[#00ff66]/10 text-[#00ff66]" : "border-white/15 text-gray-400"}`}><input type="radio" className="sr-only" checked={phase === value} onChange={() => setPhase(value as 1 | 2)}/>Phase {value}</label>)}</div></fieldset>

          <fieldset className="p-5 sm:p-7"><legend className="text-sm font-black uppercase tracking-[.12em] text-[#00ff66]">3. Operation type</legend><div className="mt-4 grid gap-2 sm:grid-cols-3">{[["mainop","MainOp"],["funop","FunOp"],["training","Training"]].map(([value,label]) => <label key={value} className={`cursor-pointer border p-4 text-center text-sm font-black uppercase ${operationType === value ? "border-cyan-300 bg-cyan-300/[.08] text-cyan-200" : "border-white/15 text-gray-400"}`}><input type="radio" className="sr-only" checked={operationType === value} onChange={() => setOperationType(value)}/>{label}</label>)}</div></fieldset>

          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7"><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Zeus (rank and name) *</span><input value={zeus} onChange={(event) => setZeus(event.target.value)} required placeholder="e.g. CX-O Akhari" className="mt-2 h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/60"/></label><label><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Pilot supervisor (rank and name) *</span><input value={pilotSupervisor} onChange={(event) => setPilotSupervisor(event.target.value)} required placeholder="e.g. CX-S Hush" className="mt-2 h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/60"/></label></div>

          <fieldset className="p-5 sm:p-7"><legend className="text-sm font-black uppercase tracking-[.12em] text-[#00ff66]">4. Ridealong activity</legend><div className="mt-4 grid grid-cols-2 gap-2">{[["ball-gunning","Ball Gunning"],["flying","Flying"]].map(([value,label]) => <label key={value} className={`cursor-pointer border p-4 text-center text-sm font-black uppercase ${activity === value ? "border-amber-300 bg-amber-300/[.07] text-amber-200" : "border-white/15 text-gray-400"}`}><input type="radio" className="sr-only" checked={activity === value} onChange={() => setActivity(value)}/>{label}</label>)}</div></fieldset>

          <div className="p-5 sm:p-7"><label><span className="flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-gray-400"><CalendarDays size={15}/>Ridealong date *</span><input type="date" value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} required className="mt-2 h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/60"/></label></div>

          <footer className="p-5 sm:p-7">{error && <p className="mb-4 border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}{success && <p className="mb-4 flex items-center gap-2 border border-[#00ff66]/30 bg-[#00ff66]/10 p-3 text-sm text-[#b8ffcf]"><CheckCircle2 size={17}/>{success}</p>}<button type="submit" disabled={submitting || !traineeId || !zeus.trim() || !pilotSupervisor.trim() || !occurredOn} className="flex h-12 w-full items-center justify-center gap-2 border border-[#00ff66] bg-[#00ff66] font-black uppercase text-black disabled:opacity-40"><Send size={17}/>{submitting ? "Saving report..." : "Submit ridealong"}</button></footer>
        </form>}
      </section>
    </main>
  );
}
