"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, RotateCcw, Search, Trash2 } from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";

type Trainee = {
  id: string;
  name: string;
  started_course: string | null;
  ground_school: string;
  flight_school: string;
  sere: string;
  cxc_test: string;
  flight: string;
  joining_hammer: boolean;
  updated_at: string;
};

type ArchiveResponse = {
  trainees: Trainee[];
  reports: { id: string; trainee_id: string }[];
  permissions: { canEdit: boolean; canFull: boolean };
  error?: string;
};

function date(value: string | null) {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

function Status({ label, value }: { label: string; value: string }) {
  const color = value === "Complete" ? "text-[#00ff66]" : value === "Waived" ? "text-amber-300" : "text-red-300";
  return <div className="border-l border-white/10 px-3 first:border-l-0"><p className="text-[9px] font-black uppercase tracking-[.12em] text-gray-600">{label}</p><p className={`mt-1 text-xs font-black ${color}`}>{value || "Not Complete"}</p></div>;
}

export default function HammerRidealongArchivePage() {
  const [data, setData] = useState<ArchiveResponse | null>(null);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/hammer-ridealongs?archive=1", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
      const body = await response.json() as ArchiveResponse;
      if (!response.ok) throw new Error(body.error || "Unable to load archive");
      setData(body);
      setMessage("");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Unable to load archive");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const trainees = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data?.trainees || []).filter((trainee) => !query || [trainee.name, trainee.flight].some((value) => value.toLowerCase().includes(query)));
  }, [data?.trainees, search]);

  async function update(action: "set-active" | "delete-trainee", trainee: Trainee) {
    if (action === "delete-trainee" && !window.confirm(`Permanently remove ${trainee.name} and all ridealong reports? This cannot be undone.`)) return;
    const response = await fetch("/api/hammer-ridealongs", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify(action === "set-active" ? { action, id: trainee.id, active: true } : { action, id: trainee.id }),
    });
    const body = await response.json() as { error?: string };
    if (!response.ok) return setMessage(body.error || "Unable to update archive");
    setMessage(action === "set-active" ? `${trainee.name} restored to the active tracker.` : `${trainee.name} permanently removed.`);
    await load();
  }

  return <main className="min-h-screen bg-[#020806] px-3 py-8 text-white sm:px-6 lg:px-10">
    <section className="mx-auto max-w-6xl border border-amber-300/25 bg-black/75">
      <header className="border-b border-amber-300/20 p-5 sm:p-8"><div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-amber-300"><Archive size={15}/>Hammer Aviation</p><h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Ridealong Archive</h1><p className="mt-3 text-sm text-[#8ba095]">Completed and withdrawn trainee records retained for reference.</p></div><Link href="/hammer-ridealongs" className="flex items-center gap-2 self-start border border-white/15 px-4 py-3 text-xs font-black uppercase text-gray-300 hover:border-[#00ff66]/40 hover:text-[#00ff66]"><ArrowLeft size={15}/>Active tracker</Link></div></header>
      <div className="border-b border-white/10 p-4"><label className="relative block max-w-md"><Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search archive</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search archived trainees" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-amber-300/50"/></label></div>
      {message && <p className="border-b border-cyan-300/20 bg-cyan-300/[.05] p-4 text-sm text-cyan-100">{message}</p>}
      {loading ? <p className="p-12 text-center text-sm uppercase tracking-[.12em] text-gray-600">Loading archive...</p> : <div className="grid gap-3 p-3 sm:p-5">{trainees.map((trainee) => <article key={trainee.id} className="border border-white/10 bg-[#03100b] p-4"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="min-w-0"><p className="text-lg font-black">{trainee.name}</p><p className="mt-1 text-xs text-gray-500">{trainee.joining_hammer ? (trainee.flight || "Flight unassigned") : "Not joining Hammer"} · Archived {date(trainee.updated_at)}</p></div><div className="grid min-w-0 flex-1 grid-cols-2 gap-y-3 sm:grid-cols-4 lg:max-w-xl"><Status label="Ground" value={trainee.ground_school}/><Status label="Flight school" value={trainee.flight_school}/><Status label="SERE" value={trainee.sere}/><Status label="CX-C" value={trainee.cxc_test}/></div>{data?.permissions.canEdit && <div className="flex gap-2"><button type="button" onClick={() => void update("set-active", trainee)} className="flex items-center gap-2 border border-[#00ff66]/35 px-3 py-2 text-xs font-black uppercase text-[#00ff66]"><RotateCcw size={15}/>Restore</button>{data.permissions.canFull && <button type="button" title="Permanently remove" onClick={() => void update("delete-trainee", trainee)} className="grid h-9 w-9 place-items-center border border-red-300/30 text-red-200 hover:bg-red-300/10"><Trash2 size={15}/></button>}</div>}</div></article>)}{!trainees.length && <div className="p-12 text-center"><Archive className="mx-auto text-gray-700"/><p className="mt-4 font-black uppercase">Archive empty</p><p className="mt-2 text-sm text-gray-500">Archived trainee records will appear here.</p></div>}</div>}
    </section>
  </main>;
}
