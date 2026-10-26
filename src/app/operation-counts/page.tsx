"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Flag, Plus, Search, ShieldCheck, Target, Users } from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";
import { OperationCountFormModal } from "@/components/OperationCountFormModal";

type Progress = {
  id: string;
  name: string;
  birth_number: string | null;
  rank_stage: "CR" | "CR-C";
  mainOps: number;
  funOps: number;
  courses: number;
  nonMainCredits: number;
  creditedTotal: number;
  ready: boolean;
};

export default function OperationCountsPage() {
  const [personnel, setPersonnel] = useState<Progress[]>([]);
  const [canViewResponses, setCanViewResponses] = useState(false);
  const [search, setSearch] = useState("");
  const [rank, setRank] = useState<"all" | "CR" | "CR-C">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/operation-counts", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
      const body = await response.json() as { personnel?: Progress[]; canViewResponses?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load operation counts");
      setPersonnel(body.personnel || []);
      setCanViewResponses(Boolean(body.canViewResponses));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load operation counts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return personnel.filter((person) => {
      const matchesRank = rank === "all" || person.rank_stage === rank;
      const matchesSearch = !query || `${person.name} ${person.birth_number || ""}`.toLowerCase().includes(query);
      return matchesRank && matchesSearch;
    });
  }, [personnel, rank, search]);

  const ready = personnel.filter((person) => person.ready).length;
  const needMain = personnel.filter((person) => !person.ready && person.mainOps === 0 && person.creditedTotal >= 3).length;

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="border border-[#00ff66]/25 bg-black/65">
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-9">
            <div>
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#00ff66]"><Target size={16}/>Recruit progression</p>
              <h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Operation Counts</h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-[#8ba095]">CR and CR-C personnel need four credited operations, including at least one Main Operation. Up to three Fun Ops or eligible CR-C course credits can contribute.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => { setSuccess(""); setShowForm(true); }} className="flex items-center gap-2 border border-[#00ff66] bg-[#00ff66] px-4 py-3 text-xs font-black uppercase text-black hover:bg-[#8dffb7]"><Plus size={16}/>Submit operation</button>
              {canViewResponses && <Link href="/operation-counts/responses" className="flex items-center gap-2 border border-cyan-300/35 px-4 py-3 text-xs font-black uppercase text-cyan-200 hover:bg-cyan-300/[.08]"><ClipboardList size={16}/>Responses</Link>}
            </div>
          </div>
          <div className="grid border-t border-[#00ff66]/15 sm:grid-cols-3">
            <Stat label="Personnel tracked" value={personnel.length} icon={<Users size={17}/>}/>
            <Stat label="Ready for progression" value={ready} icon={<CheckCircle2 size={17}/>}/>
            <Stat label="Main Op still required" value={needMain} icon={<Flag size={17}/>}/>
          </div>
        </header>

        <section className="mt-5 grid gap-3 border border-white/10 bg-black/45 p-4 lg:grid-cols-[1fr_auto]">
          <label className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search personnel</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or service number" className="h-12 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60"/></label>
          <div className="grid grid-cols-3 gap-1" aria-label="Filter by rank">{(["all","CR","CR-C"] as const).map((value) => <button key={value} type="button" onClick={() => setRank(value)} className={`min-w-20 border px-4 py-3 text-xs font-black uppercase ${rank === value ? "border-[#00ff66] bg-[#00ff66]/10 text-[#00ff66]" : "border-white/10 text-gray-500 hover:text-white"}`}>{value === "all" ? "All" : value}</button>)}</div>
        </section>

        {success && <div className="mt-5 flex items-center gap-3 border border-[#00ff66]/30 bg-[#00ff66]/10 p-4 text-[#b8ffcf]"><CheckCircle2 size={19}/><p className="text-sm">{success}</p></div>}

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {loading && <p className="col-span-full border border-white/10 p-12 text-center text-xs font-black uppercase tracking-[.14em] text-gray-600">Loading progression...</p>}
          {error && <p className="col-span-full border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</p>}
          {!loading && !error && filtered.map((person) => <ProgressCard key={person.id} person={person}/>)}
          {!loading && !error && !filtered.length && <p className="col-span-full border border-white/10 p-12 text-center text-sm text-gray-500">No CR or CR-C personnel match this search.</p>}
        </div>
      </div>
      {showForm && (
        <OperationCountFormModal
          personnel={personnel}
          onClose={() => setShowForm(false)}
          onSaved={async (name) => {
            setShowForm(false);
            setSuccess(`Operation count submitted for ${name}.`);
            await load();
          }}
        />
      )}
    </main>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return <div className="flex items-center gap-3 border-b border-[#00ff66]/15 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="text-[#00ff66]">{icon}</span><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71887c]">{label}</p></div></div>;
}

function ProgressCard({ person }: { person: Progress }) {
  const displayedCredits = Math.min(4, person.creditedTotal);
  const target = person.rank_stage === "CR" ? "CR-C" : "CT";
  const status = person.ready ? `Ready for ${target}` : person.mainOps === 0 && person.creditedTotal >= 3 ? "Main Operation required" : `${Math.max(0, 4 - person.creditedTotal)} credit${Math.max(0, 4 - person.creditedTotal) === 1 ? "" : "s"} remaining`;
  return <article className={`border bg-black/55 ${person.ready ? "border-[#00ff66]/45" : "border-white/10"}`}>
    <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div className="min-w-0"><div className="flex items-center gap-2"><span className="border border-cyan-300/25 bg-cyan-300/[.06] px-2 py-1 text-[10px] font-black text-cyan-200">{person.rank_stage}</span><h2 className="truncate text-xl font-black">{person.name}</h2></div><p className="mt-2 font-mono text-xs text-gray-600">{person.birth_number || "No service number"}</p></div>{person.ready && <ShieldCheck className="shrink-0 text-[#00ff66]"/>}</div>
    <div className="p-5">
      <div className="grid grid-cols-4 gap-2" aria-label={`${displayedCredits} of 4 required credits`}>{[0,1,2,3].map((slot) => <div key={slot} className={`h-2 ${slot < displayedCredits ? "bg-[#00ff66] shadow-[0_0_10px_rgba(0,255,102,.35)]" : "bg-white/10"}`}/>)}</div>
      <div className="mt-5 grid grid-cols-3 gap-2 text-center"><Count label="Main Ops" value={person.mainOps} accent={person.mainOps > 0}/><Count label="Fun Ops" value={person.funOps}/><Count label="CR-C courses" value={person.courses}/></div>
      <div className={`mt-4 flex items-center justify-between gap-3 border p-3 ${person.ready ? "border-[#00ff66]/30 bg-[#00ff66]/[.06]" : person.mainOps === 0 && person.creditedTotal >= 3 ? "border-amber-300/25 bg-amber-300/[.05]" : "border-white/10"}`}><div><p className={`text-xs font-black uppercase ${person.ready ? "text-[#00ff66]" : person.mainOps === 0 && person.creditedTotal >= 3 ? "text-amber-200" : "text-gray-300"}`}>{status}</p><p className="mt-1 text-[10px] text-gray-600">{person.creditedTotal} credited · non-Main credits {person.nonMainCredits}/3</p></div><span className="text-xs font-black text-gray-500">{target}</span></div>
    </div>
  </article>;
}

function Count({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return <div className={`border p-3 ${accent ? "border-[#00ff66]/30 bg-[#00ff66]/[.05]" : "border-white/10"}`}><p className={`text-xl font-black ${accent ? "text-[#00ff66]" : "text-white"}`}>{value}</p><p className="mt-1 text-[9px] font-bold uppercase text-gray-600">{label}</p></div>;
}
