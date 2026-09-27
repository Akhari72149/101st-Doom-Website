"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Check,
  Search,
  Users,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";

type Member = {
  id: string;
  recordId: string;
  name: string;
  rank: string;
  slot: string;
  status: string;
};

type AttendanceRecordRow = {
  id: string;
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

const assignmentOptions = ["Y", "N", "Excused", "LOA"];

const statusLabels: Record<string, string> = {
  Y: "Present",
  N: "Absent",
  Excused: "Excused",
  LOA: "LOA",
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

function AttendanceStatusButtons({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (status: string) => void;
}) {
  return (
    <div className="grid w-full grid-cols-4 border border-[#00ff66]/15 bg-black/45" role="group" aria-label="Attendance status">
      {assignmentOptions.map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            aria-label={`Mark ${statusLabels[option]}`}
            onClick={() => option !== value && onChange(option)}
            className={`min-h-10 border-r border-[#00ff66]/10 px-2 text-[10px] font-bold uppercase tracking-[0.08em] transition last:border-r-0 disabled:cursor-wait disabled:opacity-50 ${selected ? getStatusPillStyles(option) : "text-[#7f9f8f] hover:bg-[#00ff66]/8 hover:text-white"}`}
          >
            {selected && <Check className="mx-auto mb-0.5 h-3 w-3" />}
            {statusLabels[option]}
          </button>
        );
      })}
    </div>
  );
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

  const daggerMatch = slot.match(/^dagger\d+-(\d)-(\d+)[ab]?/i);
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

export default function AttendancePage() {
  const router = useRouter();
  const defaultPeriod = getDefaultAttendancePeriod();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string | null>("Tomahawk 1");
  const [activeSquad, setActiveSquad] = useState<string | null>("Tomahawk Platoon");
  const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month);
  const [selectedWeek, setSelectedWeek] = useState(defaultPeriod.week);
  const [selectedType, setSelectedType] = useState("MainOp");
  const [search, setSearch] = useState("");
  const [updatingAll, setUpdatingAll] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState("Y");
  const [notice, setNotice] = useState("");
  const [requestError, setRequestError] = useState("");

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

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      const canAccess = hasAppPermission(session, "admin.weekly-attendance", "read");
      if (!canAccess) {
        router.replace("/");
        return;
      }
      setCanEdit(hasAppPermission(session, "admin.weekly-attendance", "edit"));

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const fetchRoster = useCallback(async () => {
    if (!activeTab || loadingAuth) return;

    try {
      setLoading(true);
      setRequestError("");

      const response = await fetch(
        `/api/attendance?mode=roster&month=${encodeURIComponent(selectedMonth)}&week=${selectedWeek}&type=${encodeURIComponent(selectedType)}`,
        { cache: "no-store", headers: await getAppAuthHeaders() },
      );
      const payload = await response.json().catch(() => null) as { records?: AttendanceRecordRow[]; error?: string } | null;
      if (!response.ok || !payload?.records) {
        setRequestError(payload?.error || "Failed to load attendance");
        setRoster([]);
        return;
      }

      const attendanceRows = payload.records;
      const filtered = attendanceRows.filter((row) => {
        const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
        const slot = person?.slotted_position;

        if (!slot) return false;

        const platoonMatched = matchesPlatoon(slot, activeTab);
        const squadMatched = matchesSquad(slot, activeSquad);

        return platoonMatched && squadMatched;
      });

      const formatted: Member[] = filtered
        .map((row) => {
          const person = Array.isArray(row.personnel) ? row.personnel[0] : row.personnel;
          const rankRow = Array.isArray(person?.ranks) ? person?.ranks[0] : person?.ranks;

          return {
            id: person?.id ?? row.id,
            recordId: row.id,
            name: person?.name ?? "Unknown",
            rank: rankRow?.name ?? "Unknown",
            slot: person?.slotted_position ?? "Unassigned",
            status: row.status ?? "N",
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

      setRoster(formatted);
    } catch (err) {
      console.error(err);
      setRequestError("Attendance records could not be loaded. Please try again.");
      setRoster([]);
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    activeSquad,
    selectedMonth,
    selectedWeek,
    selectedType,
    loadingAuth,
  ]);

  useEffect(() => {
    if (!loadingAuth) {
      fetchRoster();
    }
  }, [fetchRoster, loadingAuth]);

  const updateAssignment = async (recordId: string, value: string) => {
    if (!canEdit) return;
    setUpdatingMemberId(recordId);
    setRequestError("");
    setNotice("");

    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ ids: [recordId], status: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setRequestError(payload?.error || "Attendance could not be updated.");
        return;
      }

      setRoster((prev) =>
        prev.map((member) =>
          member.recordId === recordId ? { ...member, status: value } : member
        )
      );
    } catch {
      setRequestError("Attendance could not be updated. Please try again.");
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const bulkUpdateAssignment = async (value: string) => {
    if (!canEdit) return;
    if (!roster.length) return;
    if (!window.confirm(`Mark all ${roster.length} personnel in ${activeSquad || activeTab} as ${statusLabels[value]}?`)) return;

    setUpdatingAll(true);
    setRequestError("");
    setNotice("");

    const ids = roster.map((member) => member.recordId);

    try {
      const response = await fetch("/api/attendance", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ ids, status: value }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        setRequestError(payload?.error || "Bulk attendance update failed.");
        return;
      }

      setRoster((prev) => prev.map((member) => ({ ...member, status: value })));
      setNotice(`${roster.length} personnel marked ${statusLabels[value]}.`);
    } catch {
      setRequestError("Bulk attendance update failed. Please try again.");
    } finally {
      setUpdatingAll(false);
    }
  };

  const filteredRoster = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return roster;

    return roster.filter((member) => {
      return (
        member.name.toLowerCase().includes(term) ||
        member.rank.toLowerCase().includes(term) ||
        member.slot.toLowerCase().includes(term) ||
        member.status.toLowerCase().includes(term)
      );
    });
  }, [roster, search]);

  const stats = useMemo(() => {
    return {
      total: roster.length,
      yes: roster.filter((m) => m.status === "Y").length,
      no: roster.filter((m) => m.status === "N").length,
      excused: roster.filter((m) => m.status === "Excused").length,
      loa: roster.filter((m) => m.status === "LOA").length,
    };
  }, [roster]);

  const currentSquads = activeTab ? platoons[activeTab] || [] : [];

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 bg-black">
        Authorising attendance control...
      </div>
    );
  }

  return (
    <motion.main className="relative min-h-screen overflow-hidden bg-[#020806] text-white">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(0,255,102,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />

      <div className="relative mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-10">
        <button type="button" onClick={() => router.push("/")} className="mb-5 border border-[#00ff66]/30 px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#00ff66] transition hover:bg-[#00ff66]/10">
          ← Dashboard
        </button>

        <header className="border border-[#00ff66]/20 bg-black/65">
          <div className="flex flex-col gap-5 border-b border-[#00ff66]/15 p-5 lg:flex-row lg:items-center lg:justify-between lg:p-7">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#00ff66]/60">Personnel Command</p>
              <h1 className="mt-2 text-2xl font-black uppercase tracking-[0.1em] text-white sm:text-3xl">Weekly Attendance</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#9ab9a4]">Choose the event period and formation, then mark each member. Changes save immediately.</p>
            </div>
            <div className={`w-fit border px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] ${canEdit ? "border-[#00ff66]/30 bg-[#00ff66]/10 text-[#00ff66]" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
              {canEdit ? "Edit access" : "View only"}
            </div>
          </div>

          <section className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-[1.15fr_0.8fr_0.9fr_1.5fr_auto]" aria-label="Attendance period controls">
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Month</span>
              <select value={selectedMonth} onChange={(event) => setSelectedMonth(event.target.value)} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">
                {months.map((month) => <option key={month}>{month}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Week</span>
              <select value={selectedWeek} onChange={(event) => setSelectedWeek(Number(event.target.value))} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">
                {[1, 2, 3, 4, 5].map((week) => <option key={week} value={week}>Week {week}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Event</span>
              <select value={selectedType} onChange={(event) => setSelectedType(event.target.value)} className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] px-3 text-sm text-white outline-none focus:border-[#00ff66]/70">
                <option value="MainOp">Main Operation</option>
                <option value="Training">Training</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[#7f9f8f]">Find personnel</span>
              <span className="relative block">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/50" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Name, rank, slot or status" className="h-11 w-full border border-[#00ff66]/25 bg-[#06100a] pl-10 pr-3 text-sm text-white outline-none placeholder:text-gray-600 focus:border-[#00ff66]/70" />
              </span>
            </label>
            <button type="button" onClick={() => void fetchRoster()} disabled={loading} title="Refresh roster" className="mt-auto grid h-11 w-11 place-items-center border border-[#00ff66]/30 text-[#00ff66] transition hover:bg-[#00ff66]/10 disabled:opacity-50">
              <RefreshCw className={loading ? "animate-spin" : ""} size={17} />
            </button>
          </section>
        </header>

        <section className="mt-5 border border-[#00ff66]/20 bg-black/65" aria-label="Formation selection">
          <div className="flex items-center gap-2 border-b border-[#00ff66]/15 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-[#00ff66]"><Users size={16} /> Formation</div>
          <div className="grid grid-cols-2 border-b border-[#00ff66]/10 sm:grid-cols-3 lg:grid-cols-5">
            {tabs.map((tab) => (
              <button key={tab} type="button" onClick={() => { setActiveTab(tab); setActiveSquad(platoons[tab]?.[0] || null); }} className={`min-h-12 border-r border-[#00ff66]/10 px-3 text-xs font-bold uppercase tracking-[0.08em] transition last:border-r-0 ${activeTab === tab ? "bg-[#00ff66] text-black" : "text-[#9bc4a8] hover:bg-[#00ff66]/10 hover:text-white"}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 p-4">
            {currentSquads.map((squad) => (
              <button key={squad} type="button" onClick={() => setActiveSquad(squad)} className={`min-h-9 border px-3 text-xs font-bold uppercase tracking-[0.08em] transition ${activeSquad === squad ? "border-[#00ff66] bg-[#00ff66]/15 text-[#00ff66]" : "border-[#00ff66]/20 text-[#7f9f8f] hover:border-[#00ff66]/50 hover:text-white"}`}>
                {squad}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 border border-[#00ff66]/20 bg-black/65 sm:grid-cols-3 lg:grid-cols-5" aria-label="Attendance totals">
          {[
            { label: "Roster", value: stats.total, tone: "text-white", icon: <Users size={15} /> },
            { label: "Present", value: stats.yes, tone: "text-emerald-300", icon: <CheckCircle2 size={15} /> },
            { label: "Absent", value: stats.no, tone: "text-red-300", icon: <XCircle size={15} /> },
            { label: "Excused", value: stats.excused, tone: "text-amber-300", icon: <Clock3 size={15} /> },
            { label: "LOA", value: stats.loa, tone: "text-sky-300", icon: <CalendarDays size={15} /> },
          ].map((item) => (
            <div key={item.label} className="border-b border-r border-[#00ff66]/10 p-4 last:border-r-0 sm:border-b-0">
              <div className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] ${item.tone}`}>{item.icon}{item.label}</div>
              <div className="mt-2 text-2xl font-black text-white">{item.value}</div>
            </div>
          ))}
        </section>

        {(requestError || notice) && (
          <div className={`mt-5 flex items-start gap-3 border p-4 text-sm ${requestError ? "border-red-400/35 bg-red-500/10 text-red-200" : "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"}`}>
            {requestError ? <TriangleAlert size={18} /> : <CheckCircle2 size={18} />}
            {requestError || notice}
          </div>
        )}

        <section className="mt-5 border border-[#00ff66]/20 bg-black/65">
          <header className="flex flex-col gap-4 border-b border-[#00ff66]/15 p-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#00ff66]/60">{selectedMonth} · Week {selectedWeek} · {selectedType === "MainOp" ? "Main Operation" : "Training"}</p>
              <h2 className="mt-2 text-xl font-black text-white">{activeSquad || activeTab}</h2>
              <p className="mt-1 text-sm text-[#7f9f8f]">{filteredRoster.length} of {roster.length} personnel shown. Select a status to save it immediately.</p>
            </div>

            <div className="border border-amber-300/20 bg-amber-300/[0.04] p-3">
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-200">Apply to entire formation</div>
              <div className="flex gap-2">
                <select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} disabled={!canEdit || updatingAll} className="h-10 min-w-32 border border-amber-300/25 bg-[#0c0b05] px-3 text-sm text-white outline-none">
                  {assignmentOptions.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                </select>
                <button type="button" onClick={() => void bulkUpdateAssignment(bulkStatus)} disabled={!canEdit || !roster.length || updatingAll} className="inline-flex h-10 items-center gap-2 border border-amber-300/35 px-4 text-xs font-bold uppercase tracking-[0.1em] text-amber-200 transition hover:bg-amber-300/10 disabled:cursor-not-allowed disabled:opacity-40">
                  {updatingAll && <Loader2 className="animate-spin" size={15} />} Apply
                </button>
              </div>
            </div>
          </header>

          {loading ? (
            <div className="flex min-h-64 items-center justify-center gap-3 text-sm text-[#7f9f8f]"><Loader2 className="animate-spin text-[#00ff66]" size={20} /> Loading attendance roster...</div>
          ) : filteredRoster.length === 0 ? (
            <div className="px-6 py-20 text-center"><p className="font-bold text-white">No personnel found</p><p className="mt-2 text-sm text-[#7f9f8f]">Change the formation, period, or search filter.</p></div>
          ) : (
            <>
              <div className="hidden overflow-x-auto lg:block">
                <table className="w-full min-w-[960px]">
                  <thead className="bg-[#07100b] text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#6f927b]">
                    <tr><th className="px-5 py-3">Personnel</th><th className="px-5 py-3">Rank</th><th className="px-5 py-3">Position</th><th className="px-5 py-3">Attendance status</th></tr>
                  </thead>
                  <tbody>
                    {filteredRoster.map((member) => (
                      <tr key={member.recordId} className="border-t border-[#00ff66]/10 transition hover:bg-[#00ff66]/[0.025]">
                        <td className="px-5 py-4 font-bold text-white">{member.name}</td>
                        <td className="px-5 py-4 text-sm text-[#9ab9a4]">{member.rank}</td>
                        <td className="max-w-xs px-5 py-4 text-sm text-[#9ab9a4]">{member.slot}</td>
                        <td className="px-5 py-3"><AttendanceStatusButtons value={member.status} disabled={!canEdit || updatingMemberId === member.recordId} onChange={(status) => void updateAssignment(member.recordId, status)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="divide-y divide-[#00ff66]/10 lg:hidden">
                {filteredRoster.map((member) => (
                  <article key={member.recordId} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div><h3 className="font-bold text-white">{member.name}</h3><p className="mt-1 text-xs text-[#7f9f8f]">{member.rank} · {member.slot}</p></div>
                      <span className={`border px-2 py-1 text-[10px] font-bold uppercase ${getStatusPillStyles(member.status)}`}>{statusLabels[member.status] || member.status}</span>
                    </div>
                    <div className="mt-4"><AttendanceStatusButtons value={member.status} disabled={!canEdit || updatingMemberId === member.recordId} onChange={(status) => void updateAssignment(member.recordId, status)} /></div>
                  </article>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </motion.main>
  );
}
