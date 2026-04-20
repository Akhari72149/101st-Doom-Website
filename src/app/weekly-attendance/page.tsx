"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import {
  ChevronDown,
  ChevronRight,
  Search,
  Users,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  PlaneTakeoff,
  BarChart3,
  CalendarRange,
  UserSearch,
} from "lucide-react";

type ViewerMember = {
  id: string;
  recordId: string;
  name: string;
  rank: string;
  slot: string;
  status: string;
  type: string;
};

type IndividualAttendanceMember = {
  id: string;
  name: string;
  rank: string;
  slot: string;
  total: number;
  yes: number;
  no: number;
  excused: number;
  loa: number;
  attendancePct: number;
  nonAttendancePct: number;
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

type StructureRole = {
  role: string;
  slotId: string;
};

type StructureChild = {
  type: "sub-header";
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  type: "header";
  title: string;
  children?: StructureChild[];
};

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

function getDefaultAttendancePeriod() {
  const today = new Date();
  const currentDay = today.getDay();
  const daysUntilSaturday = currentDay === 6 ? 0 : (6 - currentDay + 7) % 7;

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysUntilSaturday);

  return {
    month: months[targetDate.getMonth()],
    week: Math.ceil(targetDate.getDate() / 7),
  };
}

function getStatusPillStyles(status: string) {
  if (status === "Y") {
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  }

  if (status === "N") {
    return "border-red-500/40 bg-red-500/15 text-red-300";
  }

  if (status === "Excused") {
    return "border-amber-500/40 bg-amber-500/15 text-amber-300";
  }

  if (status === "LOA") {
    return "border-sky-500/40 bg-sky-500/15 text-sky-300";
  }

  return "border-[#00ff66]/20 bg-[#08110c] text-[#b7f5cb]";
}

function normaliseValue(value: string | null | undefined) {
  return (value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function stripDuplicateSuffix(slot: string | null | undefined) {
  return (slot || "").replace(/__\d+$/i, "");
}

function getSelectedSquadKey(selectedSquad: string | null) {
  const squad = normaliseValue(selectedSquad);

  if (!squad) return "";

  if (squad === "company") return "company";
  if (squad.endsWith(" platoon")) return "platoon";

  return squad;
}

function extractSquadKeyFromSlot(slotValue: string | null | undefined) {
  const slot = normaliseValue(stripDuplicateSuffix(slotValue));
  const rawSlot = normaliseValue(slotValue);

  if (!slot) return "";

  const hammerMatch = slot.match(/^hammer-(\d)[a-z]?$/i);
  if (hammerMatch) {
    return `hammer ${hammerMatch[1]}`;
  }

  if (slot.includes("halberd")) return "halberd";
  if (slot.includes("tomahawk1-scimitar")) return "scimitar hq";
  if (slot.includes("scimitar1")) return "scimitar";
  if (slot.includes("logi1")) return "anvil";

  const tomahawkMatch = slot.match(/^tomahawk\d+-(\d)-(\d)[ab]?/i);
  if (tomahawkMatch) {
    return `${tomahawkMatch[1]}-${tomahawkMatch[2]}`.toLowerCase();
  }

  const daggerMatch = slot.match(/^dagger(\d)-(\d)-\d+[ab]?/i);
  if (daggerMatch) {
    return `${daggerMatch[1]}-${daggerMatch[2]}`.toLowerCase();
  }

  const broadswordMatch = slot.match(/^broadsword\d-(\d)-\d+[ab]?/i);
  if (broadswordMatch) {
    return `3-${broadswordMatch[1]}`.toLowerCase();
  }

  const claymoreMatch = slot.match(/^claymore\d-(\d)-\d+[ab]?/i);
  if (claymoreMatch) {
    return `2-${claymoreMatch[1]}`.toLowerCase();
  }

  const genericMatch = slot.match(/\b(\d-\d)\b/);
  if (genericMatch) {
    return genericMatch[1].toLowerCase();
  }

  if (rawSlot.includes("company")) return "company";
  if (rawSlot.includes("platoon")) return "platoon";

  return "";
}

function extractPlatoonKeyFromSlot(slotValue: string | null | undefined) {
  const slot = normaliseValue(stripDuplicateSuffix(slotValue));

  if (!slot) return "";

  if (slot.startsWith("tomahawk1")) return "tomahawk 1";
  if (slot.startsWith("scimitar1")) return "tomahawk 1";
  if (slot.startsWith("logi1")) return "tomahawk 1";
  if (slot.startsWith("claymore2")) return "claymore 2";
  if (slot.startsWith("broadsword3")) return "broadsword 3";
  if (slot.startsWith("halberd")) return "broadsword 3";
  if (slot.startsWith("dagger")) return "dagger";
  if (slot.startsWith("company")) return "company command";

  if (slot.startsWith("hammer-1")) return "tomahawk 1";
  if (slot.startsWith("hammer-2")) return "claymore 2";
  if (slot.startsWith("hammer-3")) return "broadsword 3";
  if (slot.startsWith("hammer-4")) return "dagger";

  return "";
}

function matchesSquad(slotValue: string | null | undefined, selectedSquad: string | null) {
  if (!selectedSquad) return true;

  const selectedKey = getSelectedSquadKey(selectedSquad);
  if (!selectedKey) return true;

  const slotKey = extractSquadKeyFromSlot(slotValue);

  if (selectedKey === "company") {
    return slotKey === "company";
  }

  if (selectedKey === "platoon") {
    return !slotKey || slotKey === "platoon";
  }

  return slotKey === selectedKey;
}

function matchesPlatoon(slotValue: string | null | undefined, activeTab: string | null) {
  if (!activeTab) return true;

  const slotPlatoon = extractPlatoonKeyFromSlot(slotValue);
  return slotPlatoon === normaliseValue(activeTab);
}

function getMonthIndex(month: string) {
  return months.findIndex((m) => m === month);
}

function getPeriodValue(month: string, week: number) {
  const monthIndex = getMonthIndex(month);
  if (monthIndex < 0) return -1;
  return monthIndex * 10 + week;
}

function getOrderedPeriodBounds(
  startMonth: string,
  startWeek: number,
  endMonth: string,
  endWeek: number
) {
  const startValue = getPeriodValue(startMonth, startWeek);
  const endValue = getPeriodValue(endMonth, endWeek);

  if (startValue <= endValue) {
    return {
      start: startValue,
      end: endValue,
    };
  }

  return {
    start: endValue,
    end: startValue,
  };
}

function getMonthsInRange(
  startMonth: string,
  startWeek: number,
  endMonth: string,
  endWeek: number
) {
  const bounds = getOrderedPeriodBounds(startMonth, startWeek, endMonth, endWeek);

  return months.filter((month) => {
    const monthIndex = getMonthIndex(month);
    const monthStart = monthIndex * 10 + 1;
    const monthEnd = monthIndex * 10 + 5;
    return monthEnd >= bounds.start && monthStart <= bounds.end;
  });
}

function isPeriodInRange(
  month: string | null | undefined,
  week: number | null | undefined,
  startMonth: string,
  startWeek: number,
  endMonth: string,
  endWeek: number
) {
  if (!month || !week) return false;

  const value = getPeriodValue(month, week);
  const bounds = getOrderedPeriodBounds(startMonth, startWeek, endMonth, endWeek);

  return value >= bounds.start && value <= bounds.end;
}

function formatPercentage(value: number) {
  if (!Number.isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

export default function AttendanceDashboardViewer() {
  const defaultPeriod = getDefaultAttendancePeriod();

  const [records, setRecords] = useState<ViewerMember[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string | null>("Tomahawk 1");
  const [activeSquad, setActiveSquad] = useState<string | null>("Tomahawk Platoon");
  const [expandedTab, setExpandedTab] = useState<string | null>("Tomahawk 1");

  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month);
  const [selectedWeek, setSelectedWeek] = useState(defaultPeriod.week);
  const [selectedType, setSelectedType] = useState("Training");
  const [search, setSearch] = useState("");

  const [individualSearch, setIndividualSearch] = useState("");
  const [individualType, setIndividualType] = useState<"All" | "Training" | "MainOp">("All");
  const [rangeStartMonth, setRangeStartMonth] = useState(defaultPeriod.month);
  const [rangeStartWeek, setRangeStartWeek] = useState(defaultPeriod.week);
  const [rangeEndMonth, setRangeEndMonth] = useState(defaultPeriod.month);
  const [rangeEndWeek, setRangeEndWeek] = useState(defaultPeriod.week);
  const [individualLoading, setIndividualLoading] = useState(false);
  const [individualResults, setIndividualResults] = useState<IndividualAttendanceMember[]>([]);

  const tabs = [
    "Company Command",
    "Tomahawk 1",
    "Claymore 2",
    "Broadsword 3",
    "Dagger",
  ];

  const platoons: Record<string, string[]> = {
    "Company Command": ["Company"],
    "Tomahawk 1": ["Tomahawk Platoon", "1-1", "1-2", "1-3", "Scimitar HQ", "Scimitar", "Anvil", "Hammer 1"],
    "Claymore 2": ["Claymore Platoon", "2-1", "2-2", "2-3", "Hammer 2"],
    "Broadsword 3": ["Broadsword Platoon", "3-1", "3-2", "3-3", "Halberd", "Hammer 3"],
    Dagger: ["Dagger Platoon", "1-1", "1-2", "1-3", "Hammer 4"],
  };

  const fetchRecords = useCallback(async () => {
    if (!activeTab) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          type,
          status,
          personnel (
            id,
            name,
            slotted_position,
            ranks ( name )
          )
        `)
        .eq("attendance_month", selectedMonth)
        .eq("week_number", selectedWeek)
        .eq("type", selectedType);

      if (error || !data) {
        console.error(error);
        setRecords([]);
        return;
      }

      const filtered = data.filter((row: any) => {
        const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
        const slot = person?.slotted_position;

        if (!slot) return false;

        const platoonMatched = matchesPlatoon(slot, activeTab);
        const squadMatched = matchesSquad(slot, activeSquad);

        return platoonMatched && squadMatched;
      });

      const formatted: ViewerMember[] = filtered
        .map((row: any) => {
          const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
          const rankRow = Array.isArray(person?.ranks) ? person?.ranks[0] : person?.ranks;

          return {
            id: person?.id,
            recordId: row.id,
            name: person?.name ?? "Unknown",
            rank: rankRow?.name ?? "Unknown",
            slot: person?.slotted_position ?? "Unassigned",
            status: row.status ?? "N",
            type: row.type ?? "Unknown",
          };
        })
        .filter((member) => member.id && member.recordId)
        .sort((a, b) => {
          const aKey = normaliseValue(a.slot);
          const bKey = normaliseValue(b.slot);

          const aOrder = structureSlotOrder[aKey] ?? 999999;
          const bOrder = structureSlotOrder[bKey] ?? 999999;

          if (aOrder !== bOrder) {
            return aOrder - bOrder;
          }

          return a.name.localeCompare(b.name);
        });

      setRecords(formatted);
    } catch (err) {
      console.error(err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeSquad, selectedMonth, selectedWeek, selectedType]);

  const fetchIndividualAttendance = useCallback(async () => {
    const term = individualSearch.trim().toLowerCase();

    if (!term) {
      setIndividualResults([]);
      return;
    }

    try {
      setIndividualLoading(true);

      const monthsToQuery = getMonthsInRange(
        rangeStartMonth,
        rangeStartWeek,
        rangeEndMonth,
        rangeEndWeek
      );

      let query = supabase
        .from("attendance_records")
        .select(`
          id,
          type,
          status,
          attendance_month,
          week_number,
          personnel (
            id,
            name,
            slotted_position,
            ranks ( name )
          )
        `)
        .in("attendance_month", monthsToQuery);

      if (individualType !== "All") {
        query = query.eq("type", individualType);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.error(error);
        setIndividualResults([]);
        return;
      }

      const filteredRows = data.filter((row: any) => {
        const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
        const rankRow = Array.isArray(person?.ranks) ? person?.ranks[0] : person?.ranks;

        const name = normaliseValue(person?.name);
        const rank = normaliseValue(rankRow?.name);
        const slot = normaliseValue(person?.slotted_position);

        const matchesSearch =
          name.includes(term) ||
          rank.includes(term) ||
          slot.includes(term);

        if (!matchesSearch) return false;

        return isPeriodInRange(
          row.attendance_month,
          row.week_number,
          rangeStartMonth,
          rangeStartWeek,
          rangeEndMonth,
          rangeEndWeek
        );
      });

      const grouped = new Map<string, IndividualAttendanceMember>();

      for (const row of filteredRows) {
        const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
        const rankRow = Array.isArray(person?.ranks) ? person?.ranks[0] : person?.ranks;

        if (!person?.id) continue;

        const existing = grouped.get(person.id) || {
          id: person.id,
          name: person?.name ?? "Unknown",
          rank: rankRow?.name ?? "Unknown",
          slot: person?.slotted_position ?? "Unassigned",
          total: 0,
          yes: 0,
          no: 0,
          excused: 0,
          loa: 0,
          attendancePct: 0,
          nonAttendancePct: 0,
        };

        existing.total += 1;

        if (row.status === "Y") existing.yes += 1;
        else if (row.status === "N") existing.no += 1;
        else if (row.status === "Excused") existing.excused += 1;
        else if (row.status === "LOA") existing.loa += 1;

        grouped.set(person.id, existing);
      }

      const result = Array.from(grouped.values())
        .map((person) => {
          const total = person.total || 1;

          return {
            ...person,
            attendancePct: (person.yes / total) * 100,
            nonAttendancePct: (person.no / total) * 100,
          };
        })
        .sort((a, b) => {
          const aExact = normaliseValue(a.name) === term ? 1 : 0;
          const bExact = normaliseValue(b.name) === term ? 1 : 0;

          if (aExact !== bExact) return bExact - aExact;

          if (b.attendancePct !== a.attendancePct) {
            return b.attendancePct - a.attendancePct;
          }

          return a.name.localeCompare(b.name);
        });

      setIndividualResults(result);
    } catch (err) {
      console.error(err);
      setIndividualResults([]);
    } finally {
      setIndividualLoading(false);
    }
  }, [
    individualSearch,
    individualType,
    rangeStartMonth,
    rangeStartWeek,
    rangeEndMonth,
    rangeEndWeek,
  ]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  useEffect(() => {
    fetchIndividualAttendance();
  }, [fetchIndividualAttendance]);

  const filteredRoster = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return records;

    return records.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        member.rank.toLowerCase().includes(term) ||
        member.slot.toLowerCase().includes(term) ||
        member.status.toLowerCase().includes(term) ||
        member.type.toLowerCase().includes(term)
      );
    });
  }, [records, search]);

  const stats = useMemo(() => {
    const total = records.length;
    const yes = records.filter((m) => m.status === "Y").length;
    const no = records.filter((m) => m.status === "N").length;
    const excused = records.filter((m) => m.status === "Excused").length;
    const loa = records.filter((m) => m.status === "LOA").length;

    return {
      total,
      yes,
      no,
      excused,
      loa,
      yesPct: total > 0 ? (yes / total) * 100 : 0,
      noPct: total > 0 ? (no / total) * 100 : 0,
      excusedLoaPct: total > 0 ? ((excused + loa) / total) * 100 : 0,
    };
  }, [records]);

  const currentSquads = activeTab ? platoons[activeTab] || [] : [];

  return (
    <motion.div className="relative min-h-screen text-white font-orbitron overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.03)_1px,transparent_1px)] bg-[size:40px_40px] z-0 pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-7xl p-6 md:p-10 xl:p-12">
        <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-6 md:p-8 shadow-[0_0_40px_rgba(0,255,102,0.08)] mb-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-2xl">
              <p className="text-xs uppercase tracking-[0.35em] text-[#00ff66]/60 mb-3">
                Personnel Records
              </p>
              <h1 className="text-3xl md:text-4xl font-bold text-[#00ff66] tracking-[0.18em]">
                ATTENDANCE DASHBOARD
              </h1>
              <p className="mt-3 text-sm md:text-base text-[#b9d8c4]">
                Review platoon and squad attendance for Training and MainOp periods.
                Select a formation, review the roster, inspect attendance status, and
                search historical attendance percentages for individual personnel.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 min-w-0 xl:min-w-[620px]">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
              >
                {months.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>

              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
              >
                {[1, 2, 3, 4, 5].map((w) => (
                  <option key={w} value={w}>
                    Week {w}
                  </option>
                ))}
              </select>

              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
              >
                <option value="Training">Training</option>
                <option value="MainOp">MainOp</option>
              </select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/50" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search roster..."
                  className="w-full bg-[#06100a] border border-[#00ff66]/30 text-white px-10 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <div className="rounded-2xl border border-[#00ff66]/15 bg-[#08110c]/80 p-4">
              <div className="flex items-center gap-3 text-[#00ff66]/70 text-xs uppercase tracking-[0.2em]">
                <Users className="h-4 w-4" />
                Selected Platoon
              </div>
              <div className="mt-3 text-white font-semibold">
                {activeTab || "None Selected"}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/15 bg-[#08110c]/80 p-4">
              <div className="flex items-center gap-3 text-[#00ff66]/70 text-xs uppercase tracking-[0.2em]">
                <ShieldCheck className="h-4 w-4" />
                Selected Squad
              </div>
              <div className="mt-3 text-white font-semibold">
                {activeSquad || "All"}
              </div>
            </div>

            <div className="rounded-2xl border border-[#00ff66]/15 bg-[#08110c]/80 p-4">
              <div className="flex items-center gap-3 text-[#00ff66]/70 text-xs uppercase tracking-[0.2em]">
                <Users className="h-4 w-4" />
                Total
              </div>
              <div className="mt-3 text-white font-semibold">{stats.total}</div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-3 text-emerald-300/80 text-xs uppercase tracking-[0.2em]">
                <CheckCircle2 className="h-4 w-4" />
                Y
              </div>
              <div className="mt-3 text-white font-semibold">
                {stats.yes}
                <span className="ml-2 text-sm text-emerald-300/80">
                  {formatPercentage(stats.yesPct)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4">
              <div className="flex items-center gap-3 text-red-300/80 text-xs uppercase tracking-[0.2em]">
                <XCircle className="h-4 w-4" />
                N
              </div>
              <div className="mt-3 text-white font-semibold">
                {stats.no}
                <span className="ml-2 text-sm text-red-300/80">
                  {formatPercentage(stats.noPct)}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <div className="flex items-center gap-3 text-amber-300/80 text-xs uppercase tracking-[0.2em]">
                <PlaneTakeoff className="h-4 w-4" />
                Excused / LOA
              </div>
              <div className="mt-3 text-white font-semibold">
                {stats.excused + stats.loa}
                <span className="ml-2 text-sm text-amber-300/80">
                  {formatPercentage(stats.excusedLoaPct)}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            <div className="rounded-2xl border border-emerald-500/20 bg-[#08110c]/80 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/70">
                    Attending Percentage
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatPercentage(stats.yesPct)}
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-emerald-300/70" />
              </div>
              <div className="mt-4 h-2 rounded-full bg-black/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-400 transition-all"
                  style={{ width: `${Math.min(stats.yesPct, 100)}%` }}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-red-500/20 bg-[#08110c]/80 p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-red-300/70">
                    Non-Attending Percentage
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">
                    {formatPercentage(stats.noPct)}
                  </p>
                </div>
                <BarChart3 className="h-5 w-5 text-red-300/70" />
              </div>
              <div className="mt-4 h-2 rounded-full bg-black/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-red-400 transition-all"
                  style={{ width: `${Math.min(stats.noPct, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-5 md:p-6 shadow-[0_0_30px_rgba(0,255,102,0.05)] mb-8">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <UserSearch className="h-5 w-5 text-[#00ff66]/70" />
              <h2 className="text-xl font-bold text-white">
                Individual Attendance Review
              </h2>
            </div>
            <p className="text-sm text-[#9bc4a8] mt-2">
              Search a person over a selected period and view their attendance percentage.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/50" />
              <input
                value={individualSearch}
                onChange={(e) => setIndividualSearch(e.target.value)}
                placeholder="Search person, rank, or slot..."
                className="w-full bg-[#06100a] border border-[#00ff66]/30 text-white px-10 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
              />
            </div>

            <select
              value={individualType}
              onChange={(e) =>
                setIndividualType(e.target.value as "All" | "Training" | "MainOp")
              }
              className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
            >
              <option value="All">All Types</option>
              <option value="Training">Training</option>
              <option value="MainOp">MainOp</option>
            </select>

            <select
              value={rangeStartMonth}
              onChange={(e) => setRangeStartMonth(e.target.value)}
              className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
            >
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            <select
              value={rangeStartWeek}
              onChange={(e) => setRangeStartWeek(Number(e.target.value))}
              className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  From Week {w}
                </option>
              ))}
            </select>

            <select
              value={rangeEndMonth}
              onChange={(e) => setRangeEndMonth(e.target.value)}
              className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
            >
              {months.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>

            <select
              value={rangeEndWeek}
              onChange={(e) => setRangeEndWeek(Number(e.target.value))}
              className="bg-[#06100a] border border-[#00ff66]/30 text-[#00ff66] px-4 py-3 rounded-xl backdrop-blur-md outline-none focus:border-[#00ff66]/70"
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>
                  To Week {w}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 rounded-2xl border border-[#00ff66]/10 bg-[#08110c]/70 p-4 flex items-center gap-3 text-sm text-[#a9efbc]">
            <CalendarRange className="h-4 w-4 text-[#00ff66]/70" />
            Reviewing period from {rangeStartMonth} Week {rangeStartWeek} to {rangeEndMonth} Week {rangeEndWeek}
          </div>

          {individualLoading ? (
            <p className="text-center text-gray-400 py-12">
              Loading individual attendance data...
            </p>
          ) : !individualSearch.trim() ? (
            <div className="rounded-2xl border border-[#00ff66]/10 bg-[#08110c]/70 px-6 py-12 text-center mt-6">
              <p className="text-lg text-white">Search for a person to begin.</p>
              <p className="text-sm text-[#88b596] mt-2">
                Enter a name, rank, or slot to review attendance history over your selected period.
              </p>
            </div>
          ) : individualResults.length === 0 ? (
            <div className="rounded-2xl border border-[#00ff66]/10 bg-[#08110c]/70 px-6 py-12 text-center mt-6">
              <p className="text-lg text-white">No matching attendance history found.</p>
              <p className="text-sm text-[#88b596] mt-2">
                Try a wider date range or a different search term.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {individualResults.map((person) => (
                <div
                  key={person.id}
                  className="rounded-2xl border border-[#00ff66]/15 bg-[#07100b]/80 p-5"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div>
                      <h3 className="text-lg text-[#dfffea] font-semibold">
                        {person.name}
                      </h3>
                      <p className="text-[#9fc6ac] text-sm mt-1">
                        {person.rank} • {person.slot}
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 min-w-0 xl:min-w-[420px]">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-emerald-300/70">
                          Attendance %
                        </p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {formatPercentage(person.attendancePct)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-red-300/70">
                          Non-Attendance %
                        </p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {formatPercentage(person.nonAttendancePct)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-[#00ff66]/15 bg-[#08110c]/80 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-[#00ff66]/60">
                          Total Records
                        </p>
                        <p className="mt-2 text-xl font-bold text-white">
                          {person.total}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                    <div className="rounded-xl border border-[#00ff66]/15 bg-[#08110c]/80 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-[#00ff66]/60">
                        Total
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{person.total}</p>
                    </div>

                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-emerald-300/70">
                        Y
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{person.yes}</p>
                    </div>

                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-red-300/70">
                        N
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{person.no}</p>
                    </div>

                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-amber-300/70">
                        Excused
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">
                        {person.excused}
                      </p>
                    </div>

                    <div className="rounded-xl border border-sky-500/20 bg-sky-500/10 p-3">
                      <p className="text-xs uppercase tracking-[0.16em] text-sky-300/70">
                        LOA
                      </p>
                      <p className="mt-2 text-lg font-semibold text-white">{person.loa}</p>
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-emerald-300/70 mb-2">
                        <span>Attending</span>
                        <span>{formatPercentage(person.attendancePct)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400"
                          style={{ width: `${Math.min(person.attendancePct, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs uppercase tracking-[0.14em] text-red-300/70 mb-2">
                        <span>Non-Attending</span>
                        <span>{formatPercentage(person.nonAttendancePct)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-black/50 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-red-400"
                          style={{ width: `${Math.min(person.nonAttendancePct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-5 shadow-[0_0_30px_rgba(0,255,102,0.05)] h-fit">
            <div className="mb-5">
              <h2 className="text-lg font-bold text-white">Formation Selection</h2>
              <p className="text-sm text-[#9bc4a8] mt-1">
                Expand a platoon, then choose the squad to review.
              </p>
            </div>

            <div className="space-y-3">
              {tabs.map((tab) => {
                const isOpen = expandedTab === tab;
                const isActive = activeTab === tab;
                const squads = platoons[tab] || [];

                return (
                  <div
                    key={tab}
                    className={`rounded-2xl border transition-all ${
                      isActive
                        ? "border-[#00ff66]/45 bg-[#08110c]/90"
                        : "border-[#00ff66]/15 bg-[#060b08]/80"
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (isOpen) {
                          setExpandedTab(null);
                          return;
                        }

                        setExpandedTab(tab);
                        setActiveTab(tab);
                        setActiveSquad(squads[0] || null);
                      }}
                      className="w-full px-5 py-4 flex items-center justify-between text-left"
                    >
                      <div>
                        <div className="text-white font-semibold">{tab}</div>
                        <div className="text-xs uppercase tracking-[0.18em] text-[#00ff66]/55 mt-1">
                          {squads.length} formations
                        </div>
                      </div>

                      {isOpen ? (
                        <ChevronDown className="h-5 w-5 text-[#00ff66]/70" />
                      ) : (
                        <ChevronRight className="h-5 w-5 text-[#00ff66]/70" />
                      )}
                    </button>

                    {isOpen && squads.length > 0 && (
                      <div className="px-4 pb-4">
                        <div className="border-t border-[#00ff66]/10 pt-4 flex flex-wrap gap-2">
                          {squads.map((squad) => (
                            <button
                              key={squad}
                              onClick={() => {
                                setActiveTab(tab);
                                setActiveSquad(squad);
                              }}
                              className={`px-3 py-2 rounded-xl border text-sm transition ${
                                activeSquad === squad && activeTab === tab
                                  ? "bg-[#00ff66] text-black border-[#00ff66]"
                                  : "bg-black/40 border-[#00ff66]/25 text-[#a9efbc] hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10"
                              }`}
                            >
                              {squad}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-5 md:p-6 shadow-[0_0_30px_rgba(0,255,102,0.05)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {activeTab || "No Platoon Selected"}
                </h2>
                <p className="text-sm text-[#9bc4a8] mt-1">
                  {activeSquad
                    ? `Viewing ${selectedType} attendance for ${activeSquad}`
                    : "Select a squad to begin reviewing attendance."}
                </p>
              </div>
            </div>

            {loading ? (
              <p className="text-center text-gray-400 py-16">
                Loading selected attendance roster...
              </p>
            ) : filteredRoster.length === 0 ? (
              <div className="rounded-2xl border border-[#00ff66]/10 bg-[#08110c]/70 px-6 py-16 text-center">
                <p className="text-lg text-white">No roster entries found.</p>
                <p className="text-sm text-[#88b596] mt-2">
                  Select a platoon and squad, or adjust the attendance filters.
                </p>
              </div>
            ) : (
              <>
                <div className="hidden lg:block overflow-hidden rounded-2xl border border-[#00ff66]/15">
                  <table className="min-w-full">
                    <thead className="bg-[#0d1611] text-left text-xs uppercase tracking-[0.18em] text-[#00ff66]/60">
                      <tr>
                        <th className="px-5 py-4">Personnel</th>
                        <th className="px-5 py-4">Rank</th>
                        <th className="px-5 py-4">Slot</th>
                        <th className="px-5 py-4">Type</th>
                        <th className="px-5 py-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoster.map((member) => (
                        <tr
                          key={member.recordId}
                          className="border-t border-[#00ff66]/10 bg-black/20"
                        >
                          <td className="px-5 py-4 text-white font-medium">
                            {member.name}
                          </td>
                          <td className="px-5 py-4 text-[#a8d7b7]">{member.rank}</td>
                          <td className="px-5 py-4 text-[#a8d7b7]">{member.slot}</td>
                          <td className="px-5 py-4 text-[#a8d7b7]">{member.type}</td>
                          <td className="px-5 py-4">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusPillStyles(member.status)}`}
                            >
                              {member.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="grid gap-4 lg:hidden">
                  {filteredRoster.map((member) => (
                    <div
                      key={member.recordId}
                      className="rounded-2xl border border-[#00ff66]/15 bg-[#07100b]/80 p-5"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="text-lg text-[#dfffea] font-semibold">
                            {member.name}
                          </h3>
                          <p className="text-[#9fc6ac] text-sm mt-1">{member.rank}</p>
                        </div>

                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusPillStyles(member.status)}`}
                        >
                          {member.status}
                        </span>
                      </div>

                      <p className="text-sm mt-4 text-[#a8d7b7]">
                        Slot: <span className="text-white break-all">{member.slot}</span>
                      </p>
                      <p className="text-sm mt-2 text-[#a8d7b7]">
                        Type: <span className="text-white">{member.type}</span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {currentSquads.length > 0 && activeTab && (
              <div className="mt-6 pt-6 border-t border-[#00ff66]/10">
                <p className="text-xs uppercase tracking-[0.2em] text-[#00ff66]/55 mb-3">
                  Quick Squad Switch
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentSquads.map((squad) => (
                    <button
                      key={squad}
                      onClick={() => setActiveSquad(squad)}
                      className={`px-3 py-2 rounded-xl border text-sm transition ${
                        activeSquad === squad
                          ? "bg-[#00ff66] text-black border-[#00ff66]"
                          : "bg-black/40 border-[#00ff66]/25 text-[#a9efbc] hover:border-[#00ff66]/60 hover:bg-[#00ff66]/10"
                      }`}
                    >
                      {squad}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}