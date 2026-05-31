"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Rank = {
  id: string;
  name: string;
  rank_level: number;
};

type Person = {
  id: string;
  rank_id: string | null;
  name: string;
  slotted_position: string | null;
  created_at: string | null;
  ts_id?: string | null;
  status?: string | null;
  mos?: string | null;
};

type CertificationRow = {
  certification?: {
    name?: string | null;
  } | null;
};

type RankHistoryRow = {
  id: string;
  old_rank_id: string | null;
  new_rank_id: string | null;
  changed_at: string | null;
};

type StatusAuditRow = {
  id: string;
  action: string;
  created_at: string;
  processor?: {
    name?: string | null;
  } | null;
};

type ActiveTab = "qual" | "trainer" | "rank";

export default function PersonnelProfile() {
  const router = useRouter();

  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [certifications, setCertifications] = useState<CertificationRow[]>([]);
  const [rankHistory, setRankHistory] = useState<RankHistoryRow[]>([]);
  const [statusAudit, setStatusAudit] = useState<StatusAuditRow | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("qual");
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setStatusAudit(null);

    const [{ data: rankData }, { data: personnelData }] = await Promise.all([
      supabase.from("ranks").select("*"),
      supabase.from("personnel").select("*").order("name"),
    ]);

    setRanks((rankData as Rank[]) || []);
    setPersonnel((personnelData as Person[]) || []);
  };

  const loadProfile = async (person: Person) => {
    setSelectedPerson(person);
    setStatusAudit(null);
    setLoadingProfile(true);
    setActiveTab("qual");

    const [{ data: certs }, { data: history }, { data: auditData }] =
      await Promise.all([
        supabase
          .from("personnel_certifications")
          .select(`certification:certification_id ( name )`)
          .eq("personnel_id", person.id),

        supabase
          .from("rank_history")
          .select(
            `
            id,
            old_rank_id,
            new_rank_id,
            changed_at,
            old_rank:ranks!rank_history_old_rank_id_fkey(name),
            new_rank:ranks!rank_history_new_rank_id_fkey(name)
          `,
          )
          .eq("personnel_id", person.id)
          .order("changed_at", { ascending: false }),

        supabase
          .from("audit_logs")
          .select(
            `
            id,
            action,
            created_at,
            processor:processed_by ( name )
          `,
          )
          .eq("target_personnel_id", person.id)
          .in("action", [
            "PERSONNEL_REMOVED",
            "PERSONNEL_RETIRED",
            "PERSONNEL_TRANSFERRED",
          ])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    setCertifications((certs as CertificationRow[]) || []);
    setRankHistory((history as RankHistoryRow[]) || []);
    setStatusAudit((auditData as StatusAuditRow) || null);
    setLoadingProfile(false);
  };

  const getRankName = (rankId: string | null) => {
    if (!rankId) return "Unranked";
    const rank = ranks.find((r) => r.id === rankId);
    return rank?.name || "Unranked";
  };

  const getDisplayedRank = (person: Person | null) => {
    if (!person) return "Unranked";
    const mos = (person.mos || "").trim();
    if (mos) return mos;
    return getRankName(person.rank_id);
  };

  const getRankLevel = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank?.rank_level || 1;
  };

  const getRankBars = (rankId: string | null) =>
    Math.max(getRankLevel(rankId), 1);

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString() : "N/A";

  const calculateServiceDuration = (date: string | null) => {
    if (!date) return { years: 0, months: 0 };

    const now = new Date();
    const then = new Date(date);

    let years = now.getFullYear() - then.getFullYear();
    let months = now.getMonth() - then.getMonth();

    if (months < 0) {
      years--;
      months += 12;
    }

    if (years < 0) return { years: 0, months: 0 };

    return { years, months };
  };

  const getBilletFromSlot = (slotId: string | null) => {
    if (!slotId) return "Unassigned";

    for (const section of structure) {
      for (const sub of section.children || []) {
        for (const role of sub.roles || []) {
          if (role.slotId === slotId) {
            return `${section.title} — ${sub.title} — ${role.role}`;
          }
        }
      }
    }

    return "Unassigned";
  };

  const getServiceColor = (totalMonths: number) => {
    if (totalMonths <= 12) return "#00ff66";
    if (totalMonths <= 36) return "#aeff00";
    if (totalMonths <= 60) return "#ffcc00";
    if (totalMonths <= 80) return "#ffa200";
    return "#ff0000";
  };

  const calculateTimeInGrade = () => {
    if (!selectedPerson || rankHistory.length === 0) return 0;

    const latestPromotion = rankHistory.find(
      (h) => h.new_rank_id === selectedPerson.rank_id,
    );

    if (!latestPromotion?.changed_at) return 0;

    const rankDate = new Date(latestPromotion.changed_at);
    const now = new Date();
    const diff = now.getTime() - rankDate.getTime();

    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const statusValue = (selectedPerson?.status || "").trim().toLowerCase();
  const isInactive =
    statusValue === "retired" ||
    statusValue === "removed" ||
    statusValue === "transferred";

  const theme = {
    pageBg: isInactive
      ? "bg-[radial-gradient(circle_at_center,#2a0000_0%,#0a0000_100%)]"
      : "bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)]",
    primaryText: isInactive ? "text-red-400" : "text-[#00ff66]",
    primaryBorder: isInactive ? "border-red-500/40" : "border-[#00ff66]/30",
    secondaryBorder: isInactive ? "border-red-500/25" : "border-[#00ff66]/20",
    searchBorder: isInactive ? "border-red-500/40" : "border-[#00ff66]/40",
    searchText: isInactive ? "text-red-300" : "text-[#00ff66]",
    searchPlaceholder: isInactive
      ? "placeholder:text-red-300/40"
      : "placeholder:text-[#00ff66]/40",
    hoverBg: isInactive ? "hover:bg-red-500/10" : "hover:bg-[#00ff66]/10",
    accentText: isInactive ? "text-red-400" : "text-[#00ff66]",
    buttonBorder: isInactive ? "border-red-500/50" : "border-[#00ff66]/50",
    buttonText: isInactive ? "text-red-400" : "text-[#00ff66]",
    buttonHover: isInactive ? "hover:bg-red-500/10" : "hover:bg-[#00ff66]/10",
    divider: isInactive ? "border-red-500/30" : "border-[#00ff66]/25",
    softDivider: isInactive ? "border-red-500/20" : "border-[#00ff66]/15",
    cardBg: "bg-black/50",
    tabActive: isInactive
      ? "border-red-400/40 bg-red-500/10 text-red-300"
      : "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]",
    tabInactive:
      "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white",
    rankBar: isInactive ? "bg-red-500" : "bg-[#00ff66]",
    badgeBg:
      statusValue === "removed"
        ? "border border-red-500/40 bg-red-500/15 text-red-300"
        : "border border-orange-500/40 bg-orange-500/15 text-orange-300",
  };

  const trainerCerts = useMemo(
    () =>
      certifications.filter((c) =>
        c.certification?.name?.toLowerCase().includes("trainer"),
      ),
    [certifications],
  );

  const normalCerts = useMemo(
    () =>
      certifications.filter(
        (c) => !c.certification?.name?.toLowerCase().includes("trainer"),
      ),
    [certifications],
  );

  const filteredPersonnel = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return personnel;

    return personnel.filter((p) => {
      const text = [
        getRankName(p.rank_id),
        p.mos || "",
        p.name,
        p.status || "",
        p.slotted_position || "",
        p.ts_id || "",
        getBilletFromSlot(p.slotted_position),
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(term);
    });
  }, [personnel, search, ranks]);

  const activePersonnel = useMemo(
    () =>
      personnel.filter((p) => {
        const status = (p.status || "").trim().toLowerCase();
        return (
          status !== "retired" &&
          status !== "removed" &&
          status !== "transferred"
        );
      }).length,
    [personnel],
  );

  const inactivePersonnel = personnel.length - activePersonnel;

  const selectedIndex = selectedPerson
    ? filteredPersonnel.findIndex((p) => p.id === selectedPerson.id)
    : -1;

  const goToPrevious = () => {
    if (selectedIndex > 0) {
      loadProfile(filteredPersonnel[selectedIndex - 1]);
    }
  };

  const goToNext = () => {
    if (selectedIndex >= 0 && selectedIndex < filteredPersonnel.length - 1) {
      loadProfile(filteredPersonnel[selectedIndex + 1]);
    }
  };

  const renderStatCard = (label: string, value: string, accent?: boolean) => (
    <div
      className={`rounded-2xl border ${theme.secondaryBorder} ${theme.cardBg} p-4`}
    >
      <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
        {label}
      </p>
      <p
        className={`mt-2 text-sm sm:text-base ${accent ? theme.accentText : "text-[#eafff2]"}`}
      >
        {value}
      </p>
    </div>
  );

  return (
    <div
      className={`min-h-screen ${theme.pageBg} px-4 py-8 text-[#eafff2] sm:px-6 lg:px-10`}
    >
      <div className="mx-auto max-w-[1800px]">
        <button
          onClick={() => router.push("/pcs")}
          className={`mb-6 rounded-xl border px-4 py-2 font-semibold transition hover:scale-105 ${theme.buttonBorder} ${theme.buttonText} ${theme.buttonHover}`}
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-gray-400">
            Personnel Command System
          </div>
          <h1
            className={`mt-3 text-4xl font-bold tracking-[0.18em] ${theme.primaryText}`}
          >
            PERSONNEL PROFILE
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
            Search the directory and open an individual service dossier with
            qualifications, trainer records, rank progression, and status
            history.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div
              className={`rounded-3xl border ${theme.primaryBorder} ${theme.cardBg} p-5 backdrop-blur-xl`}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-gray-400">
                    Directory
                  </p>
                  <h2 className={`mt-2 text-xl font-bold ${theme.primaryText}`}>
                    Personnel Index
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    Total
                  </p>
                  <p className="text-sm font-semibold text-white">
                    {personnel.length}
                  </p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3">
                <div
                  className={`rounded-2xl border ${theme.secondaryBorder} bg-black/40 p-3`}
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    Active
                  </p>
                  <p className={`mt-1 text-lg font-bold ${theme.primaryText}`}>
                    {activePersonnel}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                    Archived
                  </p>
                  <p className="mt-1 text-lg font-bold text-gray-200">
                    {inactivePersonnel}
                  </p>
                </div>
              </div>

              <input
                type="text"
                placeholder="Search name, rank, billet, status..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`mb-4 w-full rounded-2xl border bg-black/40 p-4 outline-none transition ${theme.searchBorder} ${theme.searchText} ${theme.searchPlaceholder}`}
              />

              <div
                className={`max-h-[65vh] overflow-y-auto rounded-2xl border ${theme.secondaryBorder} bg-black/30`}
              >
                {filteredPersonnel.length === 0 ? (
                  <div className="p-5 text-sm text-gray-400">
                    No personnel matched your search.
                  </div>
                ) : (
                  filteredPersonnel.map((p) => {
                    const personStatus = (p.status || "").trim().toLowerCase();
                    const isPersonInactive =
                      personStatus === "retired" ||
                      personStatus === "removed" ||
                      personStatus === "transferred";
                    const isSelected = selectedPerson?.id === p.id;

                    return (
                      <button
                        key={p.id}
                        onClick={() => loadProfile(p)}
                        className={`w-full border-b px-4 py-4 text-left transition last:border-b-0 ${
                          isSelected
                            ? isInactive
                              ? "border-red-500/25 bg-red-500/10"
                              : "border-[#00ff66]/25 bg-[#00ff66]/10"
                            : `${theme.softDivider} ${theme.hoverBg}`
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p
                              className={`text-xs uppercase tracking-[0.18em] ${isPersonInactive ? "text-red-300" : theme.primaryText}`}
                            >
                              {getDisplayedRank(p)}
                            </p>
                            <p className="mt-1 truncate text-sm font-semibold text-white">
                              {p.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-gray-400">
                              {getBilletFromSlot(p.slotted_position)}
                            </p>
                          </div>

                          <div className="shrink-0">
                            {isPersonInactive ? (
                              <span className="rounded-full border border-red-500/40 bg-red-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-red-300">
                                {personStatus === "removed"
                                  ? "Removed"
                                  : personStatus === "transferred"
                                    ? "Transferred"
                                    : "Retired"}
                              </span>
                            ) : (
                              <span className="rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-[#00ff66]">
                                Active
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            {!selectedPerson ? (
              <div
                className={`rounded-3xl border ${theme.primaryBorder} ${theme.cardBg} p-8`}
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_0.75fr]">
                  <div>
                    <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                      Dossier Viewer
                    </p>
                    <h2
                      className={`mt-3 text-3xl font-bold ${theme.primaryText}`}
                    >
                      Select a personnel record
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-gray-400">
                      Choose someone from the directory to view their rank,
                      billet, service duration, qualifications, trainer records,
                      and promotion history.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div
                      className={`rounded-2xl border ${theme.secondaryBorder} bg-black/40 p-5`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                        Personnel Loaded
                      </p>
                      <p
                        className={`mt-2 text-3xl font-bold ${theme.primaryText}`}
                      >
                        {personnel.length}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                        Active Records
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {activePersonnel}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                        Archived Records
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {inactivePersonnel}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">
                        Search Results
                      </p>
                      <p className="mt-2 text-3xl font-bold text-white">
                        {filteredPersonnel.length}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : loadingProfile ? (
              <div
                className={`rounded-3xl border ${theme.primaryBorder} ${theme.cardBg} p-8`}
              >
                <div className="animate-pulse space-y-6">
                  <div className="h-4 w-36 rounded bg-white/10" />
                  <div className="h-12 w-72 rounded bg-white/10" />
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-24 rounded-2xl bg-white/10" />
                    ))}
                  </div>
                  <div className="h-72 rounded-3xl bg-white/10" />
                </div>
              </div>
            ) : (
              <div className="space-y-8">
                <div
                  className={`rounded-3xl border ${theme.primaryBorder} ${theme.cardBg} p-8 sm:p-10`}
                >
                  <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-[0.35em] text-gray-400">
                        {getDisplayedRank(selectedPerson)}
                      </p>

                      <div className="mt-4 flex gap-2">
                        {Array.from({
                          length: getRankBars(selectedPerson.rank_id),
                        }).map((_, i) => (
                          <div
                            key={i}
                            className={`h-1.5 w-10 rounded-full ${theme.rankBar}`}
                          />
                        ))}
                      </div>

                      <div className="mt-5 flex flex-wrap items-center gap-3">
                        <h2
                          className={`text-4xl font-bold sm:text-5xl ${theme.primaryText}`}
                        >
                          {selectedPerson.name}
                        </h2>

                        {isInactive ? (
                          <span
                            className={`rounded-full px-3 py-1 text-sm font-semibold ${theme.badgeBg}`}
                          >
                            {statusValue === "removed"
                              ? "Removed"
                              : statusValue === "transferred"
                                ? "Transferred"
                                : "Retired"}
                          </span>
                        ) : (
                          <span className="rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-3 py-1 text-sm font-semibold text-[#00ff66]">
                            Active Record
                          </span>
                        )}
                      </div>

                      <p className="mt-4 max-w-3xl text-sm leading-7 text-gray-400">
                        {getBilletFromSlot(selectedPerson.slotted_position)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={goToPrevious}
                        disabled={selectedIndex <= 0}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Previous
                      </button>

                      <button
                        onClick={goToNext}
                        disabled={
                          selectedIndex < 0 ||
                          selectedIndex >= filteredPersonnel.length - 1
                        }
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Next
                      </button>

                      <button
                        onClick={() => {
                          setSelectedPerson(null);
                          setCertifications([]);
                          setRankHistory([]);
                          setStatusAudit(null);
                        }}
                        className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white transition hover:border-white/20"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {isInactive && statusAudit && (
                    <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          {statusValue === "removed"
                            ? "Removed On"
                            : "Retired On"}
                        </p>
                        <p className="mt-2 text-base text-red-300">
                          {formatDate(statusAudit.created_at)}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                          Processed By
                        </p>
                        <p className="mt-2 text-base text-red-300">
                          {statusAudit.processor?.name || "Unknown"}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className={`my-8 border-t ${theme.divider}`} />

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
                    {renderStatCard(
                      "Displayed Rank",
                      getDisplayedRank(selectedPerson),
                      true,
                    )}
                    {renderStatCard(
                      "Base Rank",
                      getRankName(selectedPerson.rank_id),
                    )}
                    {renderStatCard(
                      "MOS",
                      selectedPerson.mos?.trim() || "None",
                      true,
                    )}
                    {renderStatCard(
                      "Join Date",
                      formatDate(selectedPerson.created_at),
                    )}
                    {renderStatCard(
                      "Time in Grade",
                      `${calculateTimeInGrade()} Days`,
                      true,
                    )}
                    {renderStatCard(
                      "Current Billet",
                      getBilletFromSlot(selectedPerson.slotted_position),
                      true,
                    )}
                    {renderStatCard(
                      "Slot ID",
                      selectedPerson.slotted_position || "Unassigned",
                    )}
                    {renderStatCard(
                      "TeamSpeak ID",
                      selectedPerson.ts_id || "Not Set",
                      true,
                    )}

                    <div
                      className={`rounded-2xl border ${theme.secondaryBorder} ${theme.cardBg} p-4`}
                    >
                      <p className="text-[11px] uppercase tracking-[0.22em] text-gray-400">
                        Service Duration
                      </p>

                      {(() => {
                        const { years, months } = calculateServiceDuration(
                          selectedPerson.created_at,
                        );
                        const totalMonths = years * 12 + months;
                        const barColor = isInactive
                          ? "#ef4444"
                          : getServiceColor(totalMonths);

                        return (
                          <>
                            <div
                              className={`mt-3 h-5 w-full overflow-hidden rounded-xl ${
                                isInactive ? "bg-[#220000]" : "bg-[#001a0a]"
                              }`}
                            >
                              <div
                                className="h-full rounded-xl"
                                style={{
                                  width: `${Math.min(totalMonths / 1.2, 100)}%`,
                                  backgroundColor: barColor,
                                }}
                              />
                            </div>

                            <p
                              className="mt-3 text-sm"
                              style={{ color: barColor }}
                            >
                              {years} Year{years !== 1 ? "s" : ""} {months}{" "}
                              Month
                              {months !== 1 ? "s" : ""}
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-3xl border ${theme.primaryBorder} ${theme.cardBg} p-6 sm:p-8`}
                >
                  <div
                    className={`mb-6 flex flex-wrap gap-3 border-b ${theme.divider} pb-4`}
                  >
                    <button
                      onClick={() => setActiveTab("qual")}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.15em] transition ${
                        activeTab === "qual"
                          ? theme.tabActive
                          : theme.tabInactive
                      }`}
                    >
                      QUALIFICATIONS ({normalCerts.length})
                    </button>

                    <button
                      onClick={() => setActiveTab("trainer")}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.15em] transition ${
                        activeTab === "trainer"
                          ? theme.tabActive
                          : theme.tabInactive
                      }`}
                    >
                      TRAINER ({trainerCerts.length})
                    </button>

                    <button
                      onClick={() => setActiveTab("rank")}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.15em] transition ${
                        activeTab === "rank"
                          ? theme.tabActive
                          : theme.tabInactive
                      }`}
                    >
                      RANK HISTORY ({rankHistory.length})
                    </button>
                  </div>

                  <div className="max-h-[440px] overflow-y-auto pr-1">
                    {activeTab === "qual" ? (
                      normalCerts.length === 0 ? (
                        <p className="text-gray-400">
                          No certifications recorded.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {normalCerts.map((c, i) => (
                            <div
                              key={i}
                              className={`rounded-2xl border ${theme.softDivider} bg-black/30 px-4 py-3`}
                            >
                              <p className="text-sm text-white">
                                {c.certification?.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    ) : activeTab === "trainer" ? (
                      trainerCerts.length === 0 ? (
                        <p className="text-gray-400">
                          No trainer certifications recorded.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {trainerCerts.map((c, i) => (
                            <div
                              key={i}
                              className={`rounded-2xl border ${theme.softDivider} bg-black/30 px-4 py-3`}
                            >
                              <p className="text-sm text-white">
                                {c.certification?.name}
                              </p>
                            </div>
                          ))}
                        </div>
                      )
                    ) : rankHistory.length === 0 ? (
                      <p className="text-gray-400">No rank history recorded.</p>
                    ) : (
                      <div className="space-y-4">
                        {rankHistory.map((h, index) => (
                          <div key={h.id} className="flex gap-4">
                            <div className="flex flex-col items-center">
                              <div
                                className={`mt-1 h-3.5 w-3.5 rounded-full ${theme.rankBar}`}
                              />
                              {index !== rankHistory.length - 1 && (
                                <div
                                  className={`mt-2 h-full min-h-[42px] w-px ${isInactive ? "bg-red-500/30" : "bg-[#00ff66]/20"}`}
                                />
                              )}
                            </div>

                            <div
                              className={`mb-2 flex-1 rounded-2xl border ${theme.softDivider} bg-black/30 px-4 py-4`}
                            >
                              <p className="text-sm text-white">
                                {getRankName(h.old_rank_id)}{" "}
                                <span className={theme.accentText}>→</span>{" "}
                                {getRankName(h.new_rank_id)}
                              </p>

                              <p className="mt-2 text-xs uppercase tracking-[0.18em] text-gray-500">
                                {formatDate(h.changed_at)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
