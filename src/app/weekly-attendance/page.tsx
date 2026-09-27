"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Search,
  UserSearch,
  Users,
  XCircle,
} from "lucide-react";
import AttendancePersonReview from "@/components/attendance/AttendancePersonReview";
import { structure } from "@/data/structure";

type ViewerMember = {
  id: string;
  recordId: string;
  name: string;
  rank: string;
  slot: string;
  status: string;
  type: string;
};

type AttendanceRecordRow = {
  id: string;
  type: string | null;
  status: string | null;
  personnel:
    | {
        id: string | null;
        name: string | null;
        slotted_position: string | null;
        ranks: { name: string | null } | { name: string | null }[] | null;
      }
    | {
        id: string | null;
        name: string | null;
        slotted_position: string | null;
        ranks: { name: string | null } | { name: string | null }[] | null;
      }[]
    | null;
};

type StructureRole = { role: string; slotId: string };
type StructureChild = { type: "sub-header"; title: string; roles?: StructureRole[] };
type StructureSection = { type: "header"; title: string; children?: StructureChild[] };

const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const tabs = ["Company Command", "Tomahawk 1", "Claymore 2", "Broadsword 3", "Dagger"];

const platoons: Record<string, string[]> = {
  "Company Command": ["Company"],
  "Tomahawk 1": ["Tomahawk Platoon", "1-1", "1-2", "1-3", "Scimitar HQ", "Scimitar", "Anvil", "Hammer 1"],
  "Claymore 2": ["Claymore Platoon", "2-1", "2-2", "2-3", "Hammer 2"],
  "Broadsword 3": ["Broadsword Platoon", "3-1", "3-2", "3-3", "Halberd", "Hammer 3"],
  Dagger: ["Dagger Platoon", "1-1", "1-2", "1-3", "Hammer 4"],
};

const statusLabels: Record<string, string> = {
  Y: "Present",
  N: "Absent",
  Excused: "Excused",
  LOA: "LOA",
};

function normaliseValue(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripDuplicateSuffix(slot: string | null | undefined) {
  return (slot || "").replace(/__\d+$/i, "");
}

function buildStructureSlotOrder() {
  const order: Record<string, number> = {};
  let index = 0;
  for (const section of structure as StructureSection[]) {
    for (const child of section.children || []) {
      for (const role of child.roles || []) {
        index += 1;
        order[normaliseValue(role.slotId)] = index;
      }
    }
  }
  return order;
}

const structureSlotOrder = buildStructureSlotOrder();

function defaultPeriod() {
  const today = new Date();
  const daysUntilSaturday = today.getDay() === 6 ? 0 : (6 - today.getDay() + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysUntilSaturday);
  return { month: months[target.getMonth()], week: Math.ceil(target.getDate() / 7) };
}

function squadKey(selectedSquad: string | null) {
  const squad = normaliseValue(selectedSquad);
  if (squad === "company") return "company";
  if (squad.endsWith(" platoon")) return "platoon";
  return squad;
}

function slotSquad(slotValue: string | null | undefined) {
  const slot = normaliseValue(stripDuplicateSuffix(slotValue));
  const rawSlot = normaliseValue(slotValue);
  if (!slot) return "";
  const hammer = slot.match(/^hammer-(\d)[a-z]?$/i);
  if (hammer) return `hammer ${hammer[1]}`;
  if (slot.includes("halberd")) return "halberd";
  if (slot.includes("tomahawk1-scimitar")) return "scimitar hq";
  if (slot.includes("scimitar1")) return "scimitar";
  if (slot.includes("logi1")) return "anvil";
  const tomahawk = slot.match(/^tomahawk\d+-(\d)-(\d)[ab]?/i);
  if (tomahawk) return `${tomahawk[1]}-${tomahawk[2]}`;
  const dagger = slot.match(/^dagger\d+-(\d)-(\d+)[ab]?/i);
  if (dagger) return `${dagger[1]}-${dagger[2]}`;
  const broadsword = slot.match(/^broadsword\d-(\d)-\d+[ab]?/i);
  if (broadsword) return `3-${broadsword[1]}`;
  const claymore = slot.match(/^claymore\d-(\d)-\d+[ab]?/i);
  if (claymore) return `2-${claymore[1]}`;
  const generic = slot.match(/\b(\d-\d)\b/);
  if (generic) return generic[1];
  if (rawSlot.includes("company")) return "company";
  if (rawSlot.includes("platoon")) return "platoon";
  return "";
}

function slotPlatoon(slotValue: string | null | undefined) {
  const slot = normaliseValue(stripDuplicateSuffix(slotValue));
  if (slot.startsWith("tomahawk1") || slot.startsWith("scimitar1") || slot.startsWith("logi1") || slot.startsWith("hammer-1")) return "tomahawk 1";
  if (slot.startsWith("claymore2") || slot.startsWith("hammer-2")) return "claymore 2";
  if (slot.startsWith("broadsword3") || slot.startsWith("halberd") || slot.startsWith("hammer-3")) return "broadsword 3";
  if (slot.startsWith("dagger") || slot.startsWith("hammer-4")) return "dagger";
  if (slot.startsWith("company")) return "company command";
  return "";
}

function matchesFormation(slot: string | null | undefined, platoon: string | null, squad: string | null) {
  if (slotPlatoon(slot) !== normaliseValue(platoon)) return false;
  const selected = squadKey(squad);
  const actual = slotSquad(slot);
  if (selected === "company") return actual === "company";
  if (selected === "platoon") return !actual || actual === "platoon";
  return actual === selected;
}

function statusStyles(status: string) {
  if (status === "Y") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "N") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (status === "Excused") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-sky-300/30 bg-sky-300/10 text-sky-200";
}

export default function WeeklyAttendancePage() {
  const initialPeriod = defaultPeriod();
  const [viewMode, setViewMode] = useState<"formation" | "person">("formation");
  const [records, setRecords] = useState<ViewerMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("Tomahawk 1");
  const [activeSquad, setActiveSquad] = useState("Tomahawk Platoon");
  const [selectedMonth, setSelectedMonth] = useState(initialPeriod.month);
  const [selectedWeek, setSelectedWeek] = useState(initialPeriod.week);
  const [selectedType, setSelectedType] = useState("MainOp");
  const [search, setSearch] = useState("");

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ mode: "roster", month: selectedMonth, week: String(selectedWeek), type: selectedType });
      const response = await fetch(`/api/attendance?${params}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { records?: AttendanceRecordRow[]; error?: string } | null;
      if (!response.ok || !payload?.records) throw new Error(payload?.error || "Attendance records could not be loaded.");

      const formatted = payload.records
        .filter((row) => {
          const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
          return matchesFormation(person?.slotted_position, activeTab, activeSquad);
        })
        .map((row) => {
          const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
          const rank = Array.isArray(person?.ranks) ? person.ranks[0] : person?.ranks;
          return {
            id: person?.id || "",
            recordId: row.id,
            name: person?.name || "Unknown",
            rank: rank?.name || "Unknown",
            slot: person?.slotted_position || "Unassigned",
            status: row.status || "N",
            type: row.type || "Unknown",
          };
        })
        .filter((member) => member.id && member.recordId)
        .sort((a, b) => (structureSlotOrder[normaliseValue(a.slot)] ?? 999999) - (structureSlotOrder[normaliseValue(b.slot)] ?? 999999) || a.name.localeCompare(b.name));
      setRecords(formatted);
    } catch (loadError) {
      setRecords([]);
      setError(loadError instanceof Error ? loadError.message : "Attendance records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [activeSquad, activeTab, selectedMonth, selectedType, selectedWeek]);

  useEffect(() => { void fetchRecords(); }, [fetchRecords]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return records;
    return records.filter((member) => `${member.name} ${member.rank} ${member.slot} ${statusLabels[member.status] || member.status}`.toLowerCase().includes(term));
  }, [records, search]);

  const stats = useMemo(() => ({
    total: records.length,
    present: records.filter((member) => member.status === "Y").length,
    absent: records.filter((member) => member.status === "N").length,
    excused: records.filter((member) => member.status === "Excused").length,
    loa: records.filter((member) => member.status === "LOA").length,
  }), [records]);

  const currentSquads = platoons[activeTab] || [];

  return (
    <motion.main className="relative min-h-screen overflow-hidden bg-[#020806] font-orbitron text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,102,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />
      <div className="relative mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">
        <header className="border border-[#00ff66]/20 bg-black/65">
          <div className="flex flex-col gap-5 border-b border-[#00ff66]/15 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-7">
            <div><p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00ff66]/60">Personnel records</p><h1 className="mt-2 text-2xl font-black uppercase tracking-[0.1em] text-white sm:text-3xl">Weekly Attendance</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#9ab9a4]">Review a formation for one event, or search a member&apos;s attendance history.</p></div>
            <div className="grid grid-cols-2 border border-[#00ff66]/25">
              <button type="button" onClick={() => setViewMode("formation")} className={`inline-flex min-h-11 items-center justify-center gap-2 px-4 text-xs font-black uppercase tracking-[0.1em] transition ${viewMode === "formation" ? "bg-[#00ff66] text-black" : "text-[#8eae99] hover:bg-[#00ff66]/10 hover:text-white"}`}><Users size={16} /> Formation roster</button>
              <button type="button" onClick={() => setViewMode("person")} className={`inline-flex min-h-11 items-center justify-center gap-2 border-l border-[#00ff66]/20 px-4 text-xs font-black uppercase tracking-[0.1em] transition ${viewMode === "person" ? "bg-[#00ff66] text-black" : "text-[#8eae99] hover:bg-[#00ff66]/10 hover:text-white"}`}><UserSearch size={16} /> Person review</button>
            </div>
          </div>

          {viewMode === "formation" && (
            <section className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_0.9fr_1.5fr_auto]" aria-label="Attendance controls">
              <Control label="Month"><select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">{months.map((month) => <option key={month}>{month}</option>)}</select></Control>
              <Control label="Week"><select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">{[1, 2, 3, 4, 5].map((week) => <option key={week} value={week}>Week {week}</option>)}</select></Control>
              <Control label="Event"><select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70"><option value="MainOp">Main Operation</option><option value="Training">Training</option></select></Control>
              <Control label="Find personnel"><span className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/50" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, rank, position or status" className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#00ff66]/70" /></span></Control>
              <button type="button" onClick={() => void fetchRecords()} disabled={loading} title="Refresh attendance" className="mt-auto grid h-11 w-11 place-items-center border border-[#00ff66]/30 text-[#00ff66] transition hover:bg-[#00ff66]/10 disabled:opacity-50"><RefreshCw className={loading ? "animate-spin" : ""} size={17} /></button>
            </section>
          )}
        </header>

        {viewMode === "person" ? (
          <div className="mt-5"><AttendancePersonReview /></div>
        ) : (
          <>
            <section className="mt-5 border border-[#00ff66]/20 bg-black/65" aria-label="Formation selection">
              <div className="grid grid-cols-2 border-b border-[#00ff66]/10 sm:grid-cols-3 lg:grid-cols-5">
                {tabs.map((tab) => <button key={tab} type="button" onClick={() => { setActiveTab(tab); setActiveSquad(platoons[tab]?.[0] || ""); }} className={`min-h-12 border-r border-[#00ff66]/10 px-3 text-xs font-bold uppercase tracking-[0.08em] transition last:border-r-0 ${activeTab === tab ? "bg-[#00ff66] text-black" : "text-[#9bc4a8] hover:bg-[#00ff66]/10 hover:text-white"}`}>{tab}</button>)}
              </div>
              <div className="flex flex-wrap gap-2 p-4">
                {currentSquads.map((squad) => <button key={squad} type="button" onClick={() => setActiveSquad(squad)} className={`min-h-9 border px-3 text-xs font-bold uppercase tracking-[0.08em] transition ${activeSquad === squad ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]" : "border-[#00ff66]/20 text-[#7f9f8f] hover:border-[#00ff66]/50 hover:text-white"}`}>{squad}</button>)}
              </div>
            </section>

            <section className="mt-5 grid grid-cols-2 border border-[#00ff66]/20 bg-black/65 sm:grid-cols-3 lg:grid-cols-5" aria-label="Attendance totals">
              {[
                { label: "Roster", value: stats.total, tone: "text-white", icon: <Users size={15} /> },
                { label: "Present", value: stats.present, tone: "text-emerald-300", icon: <CheckCircle2 size={15} /> },
                { label: "Absent", value: stats.absent, tone: "text-red-300", icon: <XCircle size={15} /> },
                { label: "Excused", value: stats.excused, tone: "text-amber-200", icon: <Clock3 size={15} /> },
                { label: "LOA", value: stats.loa, tone: "text-sky-200", icon: <CalendarDays size={15} /> },
              ].map((item) => <div key={item.label} className="border-b border-r border-[#00ff66]/10 p-4 last:border-r-0 sm:border-b-0"><div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${item.tone}`}>{item.icon}{item.label}</div><div className="mt-2 text-2xl font-black text-white">{item.value}</div></div>)}
            </section>

            {error && <div className="mt-5 border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}

            <section className="mt-5 border border-[#00ff66]/20 bg-black/65">
              <header className="border-b border-[#00ff66]/15 p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00ff66]/60">{selectedMonth} · Week {selectedWeek} · {selectedType === "MainOp" ? "Main Operation" : "Training"}</p><h2 className="mt-2 text-xl font-black text-white">{activeSquad}</h2><p className="mt-1 text-sm text-[#7f9f8f]">{filtered.length} of {records.length} personnel shown.</p></header>
              {loading ? (
                <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#7f9f8f]"><Loader2 className="animate-spin text-[#00ff66]" size={20} /> Loading attendance roster...</div>
              ) : filtered.length === 0 ? (
                <div className="px-6 py-20 text-center"><p className="font-bold text-white">No personnel found</p><p className="mt-2 text-sm text-[#7f9f8f]">Change the formation, period, or search filter.</p></div>
              ) : (
                <>
                  <div className="hidden overflow-x-auto md:block">
                    <table className="w-full min-w-[760px]"><thead className="bg-[#07100b] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f927b]"><tr><th className="px-5 py-3">Personnel</th><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Position</th><th className="px-5 py-3">Status</th></tr></thead><tbody>{filtered.map((member) => <tr key={member.recordId} className="border-t border-[#00ff66]/10 transition hover:bg-[#00ff66]/[0.025]"><td className="px-5 py-4 font-bold text-white">{member.name}</td><td className="px-5 py-4 text-sm text-[#9ab9a4]">{member.rank}</td><td className="px-5 py-4 text-sm text-[#9ab9a4]">{member.slot}</td><td className="px-5 py-4"><span className={`border px-3 py-1 text-[10px] font-bold uppercase ${statusStyles(member.status)}`}>{statusLabels[member.status] || member.status}</span></td></tr>)}</tbody></table>
                  </div>
                  <div className="divide-y divide-[#00ff66]/10 md:hidden">{filtered.map((member) => <article key={member.recordId} className="p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold text-white">{member.name}</h3><p className="mt-1 text-xs text-[#7f9f8f]">{member.rank} · {member.slot}</p></div><span className={`border px-2 py-1 text-[10px] font-bold uppercase ${statusStyles(member.status)}`}>{statusLabels[member.status] || member.status}</span></div></article>)}</div>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </motion.main>
  );
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">{label}</span>{children}</label>;
}
