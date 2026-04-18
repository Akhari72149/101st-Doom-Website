"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type Person = {
  id: string;
  name: string;
  rank_id: string | null;
  status?: string | null;
  slotted_position?: string | null;
};

type Rank = {
  id: string;
  name: string;
};

type Award = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
};

type AwardRow = {
  id: string;
  awarded_at: string | null;
  notes?: string | null;
  award?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    category?: string | null;
  } | null;
};

export default function AwardManagementPage() {
  const router = useRouter();

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingAwards, setLoadingAwards] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingAwardId, setRemovingAwardId] = useState<string | null>(null);

  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [awards, setAwards] = useState<Award[]>([]);

  const [search, setSearch] = useState("");
  const [awardSearch, setAwardSearch] = useState("");
  const [notes, setNotes] = useState("");

  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedAward, setSelectedAward] = useState<Award | null>(null);
  const [personAwards, setPersonAwards] = useState<AwardRow[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    checkAccessAndFetch();
  }, []);

  const checkAccessAndFetch = async () => {
    setLoadingPage(true);
    setErrorMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    setCurrentUserId(user.id);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const roles = roleData?.map((r) => String(r.role).toLowerCase()) || [];

    if (
      !roles.includes("admin") &&
      !roles.includes("nco") &&
      !roles.includes("di") &&
      !roles.includes("recruiter") &&
      !roles.includes("akhari")
    ) {
      router.replace("/pcs");
      return;
    }

    const [{ data: people }, { data: rankData }, { data: awardData }] =
      await Promise.all([
        supabase.from("personnel").select("*").order("name"),
        supabase.from("ranks").select("*"),
        supabase.from("awards").select("*").order("name"),
      ]);

    setPersonnel((people as Person[]) || []);
    setRanks((rankData as Rank[]) || []);
    setAwards((awardData as Award[]) || []);
    setLoadingPage(false);
  };

  const fetchAwardsForPerson = async (person: Person) => {
    setSelectedPerson(person);
    setLoadingAwards(true);
    setPersonAwards([]);
    setSelectedAward(null);
    setAwardSearch("");
    setNotes("");
    setSuccessMessage("");
    setErrorMessage("");

    const { data, error } = await supabase
      .from("personnel_awards")
      .select(`
        id,
        awarded_at,
        notes,
        award:award_id (
          id,
          name,
          description,
          category
        )
      `)
      .eq("personnel_id", person.id)
      .order("awarded_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setLoadingAwards(false);
      return;
    }

    setPersonAwards((data as AwardRow[]) || []);
    setLoadingAwards(false);
  };

  const rankMap = useMemo(() => {
    return Object.fromEntries(ranks.map((rank) => [rank.id, rank.name]));
  }, [ranks]);

  const getRankName = (person: Person | null) => {
    if (!person?.rank_id) return "Unranked";
    return rankMap[person.rank_id] || "Unranked";
  };

  const normalizedSearch = search.trim().toLowerCase();

  const filteredPersonnel = useMemo(() => {
    return personnel
      .filter((p) => {
        const status = (p.status || "").trim().toLowerCase();
        return status !== "retired" && status !== "removed";
      })
      .filter((p) => {
        if (!normalizedSearch) return true;

        return `${getRankName(p)} ${p.name}`
          .toLowerCase()
          .includes(normalizedSearch);
      });
  }, [personnel, normalizedSearch, rankMap]);

  const selectedAwardIds = useMemo(() => {
    return new Set(
      personAwards
        .map((entry) => entry.award?.id)
        .filter((id): id is string => Boolean(id))
    );
  }, [personAwards]);

  const filteredAwards = useMemo(() => {
    const normalized = awardSearch.trim().toLowerCase();

    return awards.filter((award) => {
      const matchesSearch =
        !normalized ||
        award.name.toLowerCase().includes(normalized) ||
        (award.description || "").toLowerCase().includes(normalized) ||
        (award.category || "").toLowerCase().includes(normalized);

      return matchesSearch;
    });
  }, [awards, awardSearch]);

  const assignAward = async () => {
    if (!selectedPerson || !selectedAward || !currentUserId || submitting) return;

    if (selectedAwardIds.has(selectedAward.id)) {
      setErrorMessage(`${selectedPerson.name} already has ${selectedAward.name}.`);
      setSuccessMessage("");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.from("personnel_awards").insert([
      {
        personnel_id: selectedPerson.id,
        award_id: selectedAward.id,
        awarded_at: new Date().toISOString(),
        awarded_by: currentUserId,
        notes: notes.trim() || null,
      },
    ]);

    if (error) {
      setErrorMessage(error.message);
      setSubmitting(false);
      return;
    }

    setSuccessMessage(`${selectedAward.name} awarded to ${selectedPerson.name}.`);
    setSelectedAward(null);
    setAwardSearch("");
    setNotes("");
    await fetchAwardsForPerson(selectedPerson);
    setSubmitting(false);
  };

  const removeAward = async (awardRowId: string) => {
    if (!selectedPerson) return;

    setRemovingAwardId(awardRowId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("personnel_awards")
      .delete()
      .eq("id", awardRowId);

    if (error) {
      setErrorMessage(error.message);
      setRemovingAwardId(null);
      return;
    }

    setSuccessMessage("Award removed.");
    await fetchAwardsForPerson(selectedPerson);
    setRemovingAwardId(null);
  };

  if (loadingPage) {
    return (
      <div
        className="
          min-h-screen
          bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
          px-4 py-8 text-[#eafff2]
          sm:px-6 lg:px-10
          flex items-center justify-center
        "
      >
        <div className="text-[#00ff66]">Loading Award Management...</div>
      </div>
    );
  }

  return (
    <div
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
        px-4 py-8 text-[#eafff2]
        sm:px-6 lg:px-10
      "
    >
      <div className="mx-auto max-w-[1600px]">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 rounded-lg border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-[#7fa08e]">
            Personnel Command System
          </div>

          <h1
            className="
              mt-3
              bg-gradient-to-r from-[#00ff66] to-[#00ffaa]
              bg-clip-text
              text-4xl font-extrabold tracking-[0.3em] text-transparent
              drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]
            "
          >
            AWARD MANAGEMENT
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8eaa9b]">
            Search active personnel by rank or name, review their awards, and assign new decorations from a single dossier-style panel.
          </p>
        </div>

        {!!errorMessage && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {!!successMessage && (
          <div className="mb-4 rounded-xl border border-[#00ff66]/30 bg-[#00ff66]/10 px-4 py-3 text-sm text-[#7dffae]">
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-3xl border border-[#00ff66]/30 bg-black/55 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,100,0.08)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                    Directory
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-[#00ff66]">
                    Personnel Search
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                    Active
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {filteredPersonnel.length}
                  </div>
                </div>
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/50" />
                <input
                  type="text"
                  placeholder="Search by name or rank..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="
                    w-full rounded-xl border border-[#00ff66]/40 bg-black/40
                    py-4 pl-12 pr-4 text-[#00ff66]
                    placeholder:text-[#00ff66]/40
                    transition-all duration-300
                    focus:border-[#00ff66]
                    focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
                    outline-none
                  "
                />
              </div>

              <div
                className="
                  max-h-[70vh] overflow-y-auto rounded-2xl border border-[#00ff66]/25
                  bg-black/60 backdrop-blur-lg
                  shadow-[0_0_40px_rgba(0,255,100,0.08)]
                "
              >
                {filteredPersonnel.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">
                    No personnel found.
                  </p>
                ) : (
                  filteredPersonnel.map((p) => {
                    const isSelected = selectedPerson?.id === p.id;

                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          fetchAwardsForPerson(p);
                          setSearch("");
                        }}
                        className={`w-full border-b px-4 py-4 text-left transition-all duration-200 last:border-b-0 ${
                          isSelected
                            ? "border-[#00ff66]/30 bg-[#00ff66]/12"
                            : "border-[#00ff66]/15 hover:bg-[#00ff66]/10"
                        }`}
                      >
                        <div className="text-xs uppercase tracking-[0.16em] text-[#00ff66]">
                          {getRankName(p)}
                        </div>
                        <div className="mt-1 text-sm font-semibold text-white">
                          {p.name}
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
                className="
                  rounded-3xl border border-[#00ff66]/30 bg-black/55
                  p-8 backdrop-blur-2xl
                  shadow-[0_0_60px_rgba(0,255,100,0.12)]
                "
              >
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_0.8fr]">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                      Award Viewer
                    </div>
                    <h2 className="mt-3 text-3xl font-bold text-[#00ff66]">
                      Select a person to manage awards
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8eaa9b]">
                      Search by rank or name from the directory panel and open a
                      personnel record to review and assign awards.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 p-5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        Active Personnel
                      </div>
                      <div className="mt-2 text-3xl font-bold text-[#00ff66]">
                        {filteredPersonnel.length}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        Awards Loaded
                      </div>
                      <div className="mt-2 text-3xl font-bold text-white">
                        {awards.length}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div
                className="
                  rounded-3xl border border-[#00ff66]/40 bg-black/60
                  p-8 backdrop-blur-2xl
                  shadow-[0_0_80px_rgba(0,255,100,0.2)]
                "
              >
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                      Personnel Record
                    </div>

                    <h2
                      className="
                        mt-3 border-b border-[#00ff66]/30 pb-4
                        text-2xl font-bold tracking-[0.15em] text-[#00ff66]
                      "
                    >
                      {getRankName(selectedPerson)} {selectedPerson.name}
                    </h2>

                    <div className="mt-4 flex flex-wrap gap-3">
                      <span className="rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#00ff66]">
                        {personAwards.length} Award{personAwards.length !== 1 ? "s" : ""}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                        Active
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                        {awards.length} Available Awards
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPerson(null);
                      setPersonAwards([]);
                      setSelectedAward(null);
                      setAwardSearch("");
                      setNotes("");
                    }}
                    className="rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                  <div className="min-w-0">
                    <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#00ff66]/20 pb-4">
                      <h3 className="text-lg font-bold tracking-[0.14em] text-[#00ff66]">
                        CURRENT AWARDS
                      </h3>
                    </div>

                    {loadingAwards ? (
                      <div className="space-y-3">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <div
                            key={i}
                            className="h-16 animate-pulse rounded-xl border border-[#00ff66]/15 bg-white/[0.03]"
                          />
                        ))}
                      </div>
                    ) : personAwards.length === 0 ? (
                      <div className="py-12 text-center text-[#00ff66]/60">
                        <p className="text-lg font-medium">
                          No awards assigned yet
                        </p>
                        <p className="mt-2 text-sm opacity-70">
                          Select an award from the right panel to assign one
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {personAwards.map((entry, index) => (
                          <div
                            key={entry.id}
                            className={`rounded-2xl border border-[#00ff66]/20 p-4 transition hover:bg-[#00ff66]/5 ${
                              index % 2 === 1 ? "bg-[#00ff66]/5" : "bg-black/35"
                            }`}
                          >
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <div className="text-base font-semibold text-white">
                                  {entry.award?.name || "Unknown Award"}
                                </div>

                                {entry.award?.category && (
                                  <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#00ff66]">
                                    {entry.award.category}
                                  </div>
                                )}

                                {entry.award?.description && (
                                  <div className="mt-2 text-sm text-[#8eaa9b]">
                                    {entry.award.description}
                                  </div>
                                )}

                                <div className="mt-2 text-sm text-[#00ff66]">
                                  Awarded:{" "}
                                  {entry.awarded_at
                                    ? new Date(entry.awarded_at).toLocaleDateString()
                                    : "N/A"}
                                </div>

                                {entry.notes && (
                                  <div className="mt-2 text-sm text-gray-400">
                                    Notes: {entry.notes}
                                  </div>
                                )}
                              </div>

                              <button
                                onClick={() => removeAward(entry.id)}
                                disabled={removingAwardId === entry.id}
                                className="rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10 disabled:opacity-50"
                              >
                                {removingAwardId === entry.id ? "Removing..." : "Remove"}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 rounded-3xl border border-[#00ff66]/25 bg-black/45 p-5">
                    <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                      Award Assignment
                    </div>

                    <h3 className="mt-2 text-xl font-bold text-[#00ff66]">
                      Assign New Award
                    </h3>

                    <div className="relative mt-5">
                      <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/50" />
                      <input
                        type="text"
                        placeholder="Search awards..."
                        value={awardSearch}
                        onChange={(e) => setAwardSearch(e.target.value)}
                        className="
                          w-full rounded-xl border border-[#00ff66]/40 bg-black/40
                          py-4 pl-12 pr-4 text-[#00ff66]
                          placeholder:text-[#00ff66]/40
                          transition-all duration-300
                          focus:border-[#00ff66]
                          focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
                          outline-none
                        "
                      />
                    </div>

                    <div className="mt-4 max-h-[300px] overflow-y-auto rounded-2xl border border-[#00ff66]/25 bg-black/60">
                      {filteredAwards.length === 0 ? (
                        <p className="p-4 text-sm text-gray-400">
                          No awards found.
                        </p>
                      ) : (
                        filteredAwards.map((award) => {
                          const isSelected = selectedAward?.id === award.id;
                          const isAlreadyAssigned = selectedAwardIds.has(award.id);

                          return (
                            <button
                              key={award.id}
                              onClick={() => setSelectedAward(award)}
                              className={`w-full border-b px-4 py-4 text-left transition-all duration-200 last:border-b-0 ${
                                isSelected
                                  ? "border-[#00ff66]/30 bg-[#00ff66]/12"
                                  : "border-[#00ff66]/15 hover:bg-[#00ff66]/10"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="text-sm font-semibold text-white">
                                    {award.name}
                                  </div>

                                  {award.category && (
                                    <div className="mt-1 text-xs uppercase tracking-[0.16em] text-[#00ff66]">
                                      {award.category}
                                    </div>
                                  )}

                                  {award.description && (
                                    <div className="mt-2 text-sm text-[#8eaa9b]">
                                      {award.description}
                                    </div>
                                  )}
                                </div>

                                {isAlreadyAssigned && (
                                  <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-300">
                                    Assigned
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="mt-5">
                      <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[#7fa08e]">
                        Notes
                      </div>

                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={4}
                        placeholder="Optional notes..."
                        className="
                          w-full rounded-xl border border-[#00ff66]/30 bg-black/40
                          px-4 py-3 text-white placeholder:text-gray-500
                          outline-none transition-all duration-300
                          focus:border-[#00ff66]
                          focus:shadow-[0_0_15px_rgba(0,255,100,0.25)]
                          resize-none
                        "
                      />
                    </div>

                    <button
                      onClick={assignAward}
                      disabled={!selectedAward || submitting}
                      className="mt-5 w-full rounded-xl border border-[#00ff66]/40 bg-[#00ff66]/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:opacity-50"
                    >
                      {submitting
                        ? "Assigning..."
                        : selectedAward
                        ? `Assign ${selectedAward.name}`
                        : "Select Award"}
                    </button>
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