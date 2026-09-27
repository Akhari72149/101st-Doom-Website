"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  CalendarRange,
  CheckCircle2,
  Clock3,
  Loader2,
  Search,
  UserSearch,
  Users,
  XCircle,
} from "lucide-react";

type AttendanceRecordRow = {
  id: string;
  type: string | null;
  status: string | null;
  attendance_month?: string | null;
  week_number?: number | null;
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

type AttendanceEntry = {
  id: string;
  month: string;
  week: number;
  type: string;
  status: string;
};

type AttendancePerson = {
  id: string;
  name: string;
  rank: string;
  slot: string;
  total: number;
  present: number;
  absent: number;
  excused: number;
  loa: number;
  attendancePct: number;
  entries: AttendanceEntry[];
};

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const statusLabels: Record<string, string> = {
  Y: "Present",
  N: "Absent",
  Excused: "Excused",
  LOA: "LOA",
};

function getDefaultPeriod() {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilSaturday = currentDay === 6 ? 0 : (6 - currentDay + 7) % 7;
  const target = new Date(today);
  target.setDate(today.getDate() + daysUntilSaturday);
  return { month: months[target.getMonth()], week: Math.ceil(target.getDate() / 7) };
}

function periodValue(month: string, week: number) {
  return months.indexOf(month) * 10 + week;
}

function monthsInRange(startMonth: string, startWeek: number, endMonth: string, endWeek: number) {
  const start = Math.min(periodValue(startMonth, startWeek), periodValue(endMonth, endWeek));
  const end = Math.max(periodValue(startMonth, startWeek), periodValue(endMonth, endWeek));
  return months.filter((month) => {
    const index = months.indexOf(month);
    return index * 10 + 5 >= start && index * 10 + 1 <= end;
  });
}

function inRange(month: string, week: number, startMonth: string, startWeek: number, endMonth: string, endWeek: number) {
  const value = periodValue(month, week);
  const start = Math.min(periodValue(startMonth, startWeek), periodValue(endMonth, endWeek));
  const end = Math.max(periodValue(startMonth, startWeek), periodValue(endMonth, endWeek));
  return value >= start && value <= end;
}

function statusStyles(status: string) {
  if (status === "Y") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (status === "N") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (status === "Excused") return "border-amber-300/30 bg-amber-300/10 text-amber-200";
  return "border-sky-300/30 bg-sky-300/10 text-sky-200";
}

export default function AttendancePersonReview({ heading = "Person attendance review" }: { heading?: string }) {
  const defaultPeriod = getDefaultPeriod();
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState<"All" | "Training" | "MainOp">("MainOp");
  const [startMonth, setStartMonth] = useState("January");
  const [startWeek, setStartWeek] = useState(1);
  const [endMonth, setEndMonth] = useState(defaultPeriod.month);
  const [endWeek, setEndWeek] = useState(defaultPeriod.week);
  const [people, setPeople] = useState<AttendancePerson[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");

  const selected = useMemo(
    () => people.find((person) => person.id === selectedId) || people[0] || null,
    [people, selectedId],
  );

  async function searchAttendance(event: FormEvent) {
    event.preventDefault();
    const term = query.trim().toLowerCase();
    if (!term) return;

    setLoading(true);
    setError("");
    setSearched(true);

    try {
      const params = new URLSearchParams({
        mode: "individual",
        months: monthsInRange(startMonth, startWeek, endMonth, endWeek).join(","),
        type: eventType,
      });
      const response = await fetch(`/api/attendance?${params}`, { cache: "no-store" });
      const payload = (await response.json().catch(() => null)) as { records?: AttendanceRecordRow[]; error?: string } | null;
      if (!response.ok || !payload?.records) throw new Error(payload?.error || "Attendance records could not be loaded.");

      const grouped = new Map<string, AttendancePerson>();
      for (const row of payload.records) {
        const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
        const rank = Array.isArray(person?.ranks) ? person.ranks[0] : person?.ranks;
        const searchable = `${person?.name || ""} ${rank?.name || ""} ${person?.slotted_position || ""}`.toLowerCase();
        if (!person?.id || !searchable.includes(term) || !row.attendance_month || !row.week_number) continue;
        if (!inRange(row.attendance_month, row.week_number, startMonth, startWeek, endMonth, endWeek)) continue;

        const current = grouped.get(person.id) || {
          id: person.id,
          name: person.name || "Unknown",
          rank: rank?.name || "Unknown",
          slot: person.slotted_position || "Unassigned",
          total: 0,
          present: 0,
          absent: 0,
          excused: 0,
          loa: 0,
          attendancePct: 0,
          entries: [],
        };
        current.total += 1;
        if (row.status === "Y") current.present += 1;
        if (row.status === "N") current.absent += 1;
        if (row.status === "Excused") current.excused += 1;
        if (row.status === "LOA") current.loa += 1;
        current.entries.push({
          id: row.id,
          month: row.attendance_month,
          week: row.week_number,
          type: row.type || "Unknown",
          status: row.status || "N",
        });
        grouped.set(person.id, current);
      }

      const nextPeople = Array.from(grouped.values())
        .map((person) => ({
          ...person,
          attendancePct: person.present + person.absent > 0
            ? (person.present / (person.present + person.absent)) * 100
            : 0,
          entries: person.entries.sort((a, b) => periodValue(b.month, b.week) - periodValue(a.month, a.week)),
        }))
        .sort((a, b) => {
          const exactA = a.name.toLowerCase() === term ? 1 : 0;
          const exactB = b.name.toLowerCase() === term ? 1 : 0;
          return exactB - exactA || a.name.localeCompare(b.name);
        });

      setPeople(nextPeople);
      setSelectedId(nextPeople[0]?.id || null);
    } catch (searchError) {
      setPeople([]);
      setSelectedId(null);
      setError(searchError instanceof Error ? searchError.message : "Attendance records could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border border-[#00ff66]/20 bg-black/65" aria-label={heading}>
      <header className="border-b border-[#00ff66]/15 p-5 lg:p-6">
        <div className="flex items-start gap-3">
          <UserSearch className="mt-0.5 h-5 w-5 text-[#00ff66]" />
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00ff66]/60">Attendance history</p>
            <h2 className="mt-1 text-xl font-black text-white">{heading}</h2>
            <p className="mt-2 text-sm leading-6 text-[#8eae99]">Search by name, rank, or position, then review accountable attendance and individual records.</p>
          </div>
        </div>
      </header>

      <form onSubmit={searchAttendance} className="grid gap-3 border-b border-[#00ff66]/15 p-5 md:grid-cols-2 xl:grid-cols-[1.5fr_0.8fr_1fr_1fr_auto]">
        <label>
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#789383]">Find personnel</span>
          <span className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/50" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, rank or position" className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#00ff66]/70" />
          </span>
        </label>
        <label>
          <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.15em] text-[#789383]">Event</span>
          <select value={eventType} onChange={(event) => setEventType(event.target.value as typeof eventType)} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">
            <option value="MainOp">Main Operations</option>
            <option value="Training">Training</option>
            <option value="All">All Events</option>
          </select>
        </label>
        <PeriodControl label="From" month={startMonth} week={startWeek} onMonth={setStartMonth} onWeek={setStartWeek} />
        <PeriodControl label="To" month={endMonth} week={endWeek} onMonth={setEndMonth} onWeek={setEndWeek} />
        <button type="submit" disabled={!query.trim() || loading} className="mt-auto inline-flex h-11 items-center justify-center gap-2 border border-[#00ff66]/40 px-5 text-xs font-black uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/10 disabled:cursor-not-allowed disabled:opacity-40">
          {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
          Review
        </button>
      </form>

      {error && <div className="border-b border-red-400/25 bg-red-500/10 px-5 py-4 text-sm text-red-200">{error}</div>}

      {!searched ? (
        <div className="px-6 py-16 text-center">
          <UserSearch className="mx-auto h-8 w-8 text-[#00ff66]/45" />
          <p className="mt-4 font-bold text-white">Search for a member to begin</p>
          <p className="mt-2 text-sm text-[#789383]">The default review covers Main Operations from January to the current week.</p>
        </div>
      ) : !loading && people.length === 0 && !error ? (
        <div className="px-6 py-16 text-center"><p className="font-bold text-white">No matching attendance records</p><p className="mt-2 text-sm text-[#789383]">Check the name or expand the selected period.</p></div>
      ) : selected ? (
        <div className="grid min-h-[390px] lg:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="border-b border-[#00ff66]/15 lg:border-b-0 lg:border-r">
            <div className="border-b border-[#00ff66]/10 px-4 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-[#789383]">Matches · {people.length}</div>
            <div className="max-h-[420px] overflow-y-auto">
              {people.map((person) => (
                <button key={person.id} type="button" onClick={() => setSelectedId(person.id)} className={`w-full border-b border-[#00ff66]/10 px-4 py-4 text-left transition ${selected.id === person.id ? "bg-[#00ff66]/10" : "hover:bg-[#00ff66]/[0.04]"}`}>
                  <div className="font-bold text-white">{person.name}</div>
                  <div className="mt-1 text-xs text-[#789383]">{person.rank} · {person.slot}</div>
                </button>
              ))}
            </div>
          </aside>

          <div className="min-w-0 p-5 lg:p-6">
            <div className="flex flex-col gap-4 border-b border-[#00ff66]/15 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-[#00ff66]/60">Selected personnel</p><h3 className="mt-1 text-2xl font-black text-white">{selected.name}</h3><p className="mt-1 text-sm text-[#8eae99]">{selected.rank} · {selected.slot}</p></div>
              <div className="border border-emerald-400/25 bg-emerald-400/[0.07] px-4 py-3 text-right"><div className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-300/70">Accountable attendance</div><div className="mt-1 text-2xl font-black text-emerald-300">{selected.attendancePct.toFixed(1)}%</div></div>
            </div>

            <div className="mt-5 grid grid-cols-2 border border-[#00ff66]/15 sm:grid-cols-5">
              {[
                { label: "Records", value: selected.total, icon: <Users size={14} />, tone: "text-white" },
                { label: "Present", value: selected.present, icon: <CheckCircle2 size={14} />, tone: "text-emerald-300" },
                { label: "Absent", value: selected.absent, icon: <XCircle size={14} />, tone: "text-red-300" },
                { label: "Excused", value: selected.excused, icon: <Clock3 size={14} />, tone: "text-amber-200" },
                { label: "LOA", value: selected.loa, icon: <CalendarRange size={14} />, tone: "text-sky-200" },
              ].map((item) => <div key={item.label} className="border-b border-r border-[#00ff66]/10 p-3 last:border-r-0 sm:border-b-0"><div className={`flex items-center gap-2 text-[10px] font-bold uppercase ${item.tone}`}>{item.icon}{item.label}</div><div className="mt-2 text-xl font-black text-white">{item.value}</div></div>)}
            </div>

            <div className="mt-5 overflow-hidden border border-[#00ff66]/15">
              <div className="hidden grid-cols-[1fr_0.7fr_0.8fr] bg-[#07100b] px-4 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[#789383] sm:grid"><span>Period</span><span>Event</span><span>Status</span></div>
              <div className="max-h-52 overflow-y-auto">
                {selected.entries.map((entry) => <div key={entry.id} className="flex items-start justify-between gap-3 border-t border-[#00ff66]/10 px-4 py-3 text-sm sm:grid sm:grid-cols-[1fr_0.7fr_0.8fr] sm:items-center"><span className="min-w-0 text-white">{entry.month} · Week {entry.week}<span className="mt-1 block text-xs text-[#8eae99] sm:hidden">{entry.type === "MainOp" ? "Main Op" : entry.type}</span></span><span className="hidden text-[#8eae99] sm:block">{entry.type === "MainOp" ? "Main Op" : entry.type}</span><span className={`w-fit shrink-0 border px-2 py-1 text-[10px] font-bold uppercase ${statusStyles(entry.status)}`}>{statusLabels[entry.status] || entry.status}</span></div>)}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function PeriodControl({ label, month, week, onMonth, onWeek }: { label: string; month: string; week: number; onMonth: (value: string) => void; onWeek: (value: number) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-[#789383]">{label}</legend>
      <div className="grid grid-cols-[1fr_78px]">
        <select value={month} onChange={(event) => onMonth(event.target.value)} aria-label={`${label} month`} className="h-11 min-w-0 border border-r-0 border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">{months.map((item) => <option key={item}>{item}</option>)}</select>
        <select value={week} onChange={(event) => onWeek(Number(event.target.value))} aria-label={`${label} week`} className="h-11 border border-[#00ff66]/25 bg-[#06100a] px-2 text-sm text-white outline-none focus:border-[#00ff66]/70">{[1, 2, 3, 4, 5].map((item) => <option key={item} value={item}>W{item}</option>)}</select>
      </div>
    </fieldset>
  );
}
