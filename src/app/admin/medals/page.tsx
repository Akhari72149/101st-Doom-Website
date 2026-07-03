"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  Medal,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  GiArmorVest,
  GiCheckedShield,
  GiCrossedSwords,
  GiCrystalGrowth,
  GiHeartBeats,
  GiJetFighter,
  GiLaurelCrown,
  GiLifeSupport,
  GiLungs,
  GiMedal,
  GiMedicalPack,
  GiMedicines,
  GiRibbonMedal,
  GiShieldBounces,
  GiStarfighter,
  GiStarsStack,
  GiTank,
  GiTrophy,
} from "react-icons/gi";
import { supabase } from "@/lib/supabase";

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

type MedalRecord = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  icon_key?: string | null;
  ribbon_color?: string | null;
  award_type?: string | null;
};

type PersonnelMedalRow = {
  id: string;
  awarded_at: string | null;
  notes?: string | null;
  award?: {
    id?: string;
    name?: string | null;
    description?: string | null;
    category?: string | null;
    icon_key?: string | null;
    ribbon_color?: string | null;
  } | null;
};

function MedalIcon({
  iconKey,
  className = "h-5 w-5",
  style,
}: {
  iconKey?: string | null;
  className?: string;
  style?: CSSProperties;
}) {
  if (iconKey === "swords") return <GiCrossedSwords className={className} style={style} />;
  if (iconKey === "medical") return <GiMedicalPack className={className} style={style} />;
  if (iconKey === "shield") return <GiCheckedShield className={className} style={style} />;
  if (iconKey === "star") return <GiStarsStack className={className} style={style} />;
  if (iconKey === "engineering") return <GiCrystalGrowth className={className} style={style} />;
  if (iconKey === "ribbon") return <GiRibbonMedal className={className} style={style} />;
  if (iconKey === "laurel") return <GiLaurelCrown className={className} style={style} />;
  if (iconKey === "trophy") return <GiTrophy className={className} style={style} />;
  if (iconKey === "armor") return <GiArmorVest className={className} style={style} />;
  if (iconKey === "shield_burst") return <GiShieldBounces className={className} style={style} />;
  if (iconKey === "tank") return <GiTank className={className} style={style} />;
  if (iconKey === "jet") return <GiJetFighter className={className} style={style} />;
  if (iconKey === "starfighter") return <GiStarfighter className={className} style={style} />;
  if (iconKey === "heart") return <GiHeartBeats className={className} style={style} />;
  if (iconKey === "plasma") return <GiMedicines className={className} style={style} />;
  if (iconKey === "surgery") return <GiLifeSupport className={className} style={style} />;
  if (iconKey === "lungs") return <GiLungs className={className} style={style} />;
  return <GiMedal className={className} style={style} />;
}

export default function MedalAwardingPage() {
  const router = useRouter();

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingMedals, setLoadingMedals] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [removingMedalId, setRemovingMedalId] = useState<string | null>(null);

  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [medals, setMedals] = useState<MedalRecord[]>([]);
  const [personMedals, setPersonMedals] = useState<PersonnelMedalRow[]>([]);

  const [personSearch, setPersonSearch] = useState("");
  const [medalSearch, setMedalSearch] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [selectedMedal, setSelectedMedal] = useState<MedalRecord | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    async function checkAccessAndFetch() {
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

      const [{ data: people }, { data: rankData }, { data: medalData }] =
        await Promise.all([
          supabase.from("personnel").select("*").order("name"),
          supabase.from("ranks").select("*"),
          supabase
            .from("awards")
            .select("*")
            .eq("award_type", "manual")
            .eq("is_active", true)
            .order("sort_order")
            .order("name"),
        ]);

      setPersonnel((people as Person[]) || []);
      setRanks((rankData as Rank[]) || []);
      setMedals((medalData as MedalRecord[]) || []);
      setLoadingPage(false);
    }

    checkAccessAndFetch();
  }, [router]);

  const rankMap = useMemo(() => {
    return Object.fromEntries(ranks.map((rank) => [rank.id, rank.name]));
  }, [ranks]);

  const getRankName = useMemo(() => {
    return (person: Person | null) => {
      if (!person?.rank_id) return "Unranked";
      return rankMap[person.rank_id] || "Unranked";
    };
  }, [rankMap]);

  const activePersonnel = useMemo(() => {
    return personnel.filter((person) => {
      const status = (person.status || "").trim().toLowerCase();
      return status !== "retired" && status !== "removed";
    });
  }, [personnel]);

  const filteredPersonnel = useMemo(() => {
    const query = personSearch.trim().toLowerCase();

    return activePersonnel.filter((person) => {
      if (!query) return true;
      return `${getRankName(person)} ${person.name} ${person.slotted_position || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [activePersonnel, getRankName, personSearch]);

  const assignedMedalIds = useMemo(() => {
    return new Set(
      personMedals
        .map((entry) => entry.award?.id)
        .filter((id): id is string => Boolean(id)),
    );
  }, [personMedals]);

  const filteredMedals = useMemo(() => {
    const query = medalSearch.trim().toLowerCase();

    return medals.filter((medal) => {
      if (!query) return true;
      return `${medal.name} ${medal.category || ""} ${medal.description || ""}`
        .toLowerCase()
        .includes(query);
    });
  }, [medalSearch, medals]);

  const selectedMedalAlreadyAssigned =
    selectedMedal !== null && assignedMedalIds.has(selectedMedal.id);

  async function loadMedalsForPerson(person: Person) {
    setSelectedPerson(person);
    setSelectedMedal(null);
    setMedalSearch("");
    setNotes("");
    setLoadingMedals(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase
      .from("personnel_awards")
      .select(
        `
        id,
        awarded_at,
        notes,
        award:award_id (
          id,
          name,
          description,
          category,
          icon_key,
          ribbon_color
        )
      `,
      )
      .eq("personnel_id", person.id)
      .order("awarded_at", { ascending: false });

    if (error) {
      setErrorMessage(error.message);
      setPersonMedals([]);
      setLoadingMedals(false);
      return;
    }

    setPersonMedals((data as PersonnelMedalRow[]) || []);
    setLoadingMedals(false);
  }

  async function awardMedal() {
    if (!selectedPerson || !selectedMedal || !currentUserId || submitting) return;

    if (assignedMedalIds.has(selectedMedal.id)) {
      setErrorMessage(`${selectedPerson.name} already has ${selectedMedal.name}.`);
      setSuccessMessage("");
      return;
    }

    setSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase.from("personnel_awards").insert([
      {
        personnel_id: selectedPerson.id,
        award_id: selectedMedal.id,
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

    setSuccessMessage(`${selectedMedal.name} awarded to ${selectedPerson.name}.`);
    setSelectedMedal(null);
    setMedalSearch("");
    setNotes("");
    await loadMedalsForPerson(selectedPerson);
    setSubmitting(false);
  }

  async function removeMedal(rowId: string) {
    if (!selectedPerson) return;

    setRemovingMedalId(rowId);
    setErrorMessage("");
    setSuccessMessage("");

    const { error } = await supabase
      .from("personnel_awards")
      .delete()
      .eq("id", rowId);

    if (error) {
      setErrorMessage(error.message);
      setRemovingMedalId(null);
      return;
    }

    setSuccessMessage("Medal removed.");
    await loadMedalsForPerson(selectedPerson);
    setRemovingMedalId(null);
  }

  if (loadingPage) {
    return (
      <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#020704] px-4 text-[#00ff66]">
        <div
          className="fixed inset-0 bg-center bg-cover opacity-35"
          style={{ backgroundImage: "url('/art/Advisor/20240107033013_1.jpg')" }}
        />
        <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.15),transparent_36%),linear-gradient(180deg,rgba(2,7,4,0.38),#020704_86%)]" />
        <div className="relative border border-[#00ff66]/25 bg-black/45 px-6 py-5 backdrop-blur-sm">
          Loading Medal Awarding...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#020704] px-4 py-6 text-[#eafff2] sm:px-6 lg:px-8">
      <div
        className="fixed inset-0 bg-center bg-cover opacity-35"
        style={{ backgroundImage: "url('/art/Advisor/20240107033013_1.jpg')" }}
      />
      <div className="fixed inset-0 bg-[linear-gradient(90deg,rgba(0,255,102,0.045)_1px,transparent_1px),linear-gradient(rgba(0,255,102,0.035)_1px,transparent_1px)] bg-[size:72px_72px]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.15),transparent_36%),linear-gradient(180deg,rgba(2,7,4,0.42),#020704_88%)]" />
      <div className="fixed inset-0 bg-black/10 backdrop-blur-[0.5px]" />

      <div className="relative mx-auto max-w-[1800px]">
        <header className="mb-5 border border-[#00ff66]/15 bg-black/35">
          <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <button
                type="button"
                onClick={() => router.push("/pcs")}
                className="mb-5 inline-flex items-center gap-2 border border-[#00ff66]/35 bg-black/35 px-3 py-2 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/10"
              >
                <ArrowLeft className="h-4 w-4" />
                Dashboard
              </button>

              <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff66]/55">
                Personnel Command System
              </p>
              <h1 className="mt-2 text-4xl font-extrabold tracking-[0.18em] text-[#00ff66] sm:text-5xl">
                MEDAL AWARDING
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8eaa9b]">
                Select a recipient, choose a medal, add citation notes, and
                apply the decoration to their personnel profile.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 lg:w-[520px]">
              {[
                ["Roster", activePersonnel.length],
                ["Medals", medals.length],
                ["Assigned", personMedals.length],
              ].map(([label, value]) => (
                <div key={label} className="border-l border-[#00ff66]/30 bg-black/25 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </header>

        {(errorMessage || successMessage) && (
          <div className="mb-5 grid gap-3">
            {errorMessage && (
              <div className="border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {errorMessage}
              </div>
            )}
            {successMessage && (
              <div className="border border-[#00ff66]/30 bg-[#00ff66]/10 px-4 py-3 text-sm text-[#7dffae]">
                {successMessage}
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_minmax(0,0.86fr)_minmax(500px,0.64fr)]">
          <aside className="border border-[#00ff66]/15 bg-black/35 xl:sticky xl:top-5 xl:h-fit">
            <div className="border-b border-[#00ff66]/15 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/55">
                    Recipient
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-[#00ff66]">
                    Personnel
                  </h2>
                </div>
                <UserRound className="h-7 w-7 text-[#00ff66]/65" />
              </div>

              <div className="relative mt-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/55" />
                <input
                  type="text"
                  placeholder="Search name, rank, slot..."
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#00ff66]/25 bg-black/50 pl-10 pr-3 text-sm text-[#00ff66] outline-none transition placeholder:text-[#00ff66]/30 focus:border-[#00ff66]/65"
                />
              </div>
            </div>

            <div className="max-h-[68vh] overflow-y-auto p-3">
              {filteredPersonnel.length === 0 ? (
                <p className="p-4 text-sm text-gray-400">No personnel found.</p>
              ) : (
                <div className="space-y-2">
                  {filteredPersonnel.map((person) => {
                    const isSelected = selectedPerson?.id === person.id;

                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => {
                          loadMedalsForPerson(person);
                          setPersonSearch("");
                        }}
                        className={`w-full border px-3 py-3 text-left transition ${
                          isSelected
                            ? "border-[#00ff66]/55 bg-[#00ff66]/12"
                            : "border-[#00ff66]/12 bg-black/30 hover:border-[#00ff66]/35 hover:bg-[#00ff66]/8"
                        }`}
                      >
                        <p className="truncate text-[10px] uppercase tracking-[0.16em] text-[#00ff66]">
                          {getRankName(person)}
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-white">
                          {person.name}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-500">
                          {person.slotted_position || "Unassigned"}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-5">
            {!selectedPerson ? (
              <div className="grid min-h-[520px] place-items-center border border-[#00ff66]/15 bg-black/30 p-8 text-center">
                <div>
                  <Medal className="mx-auto h-16 w-16 text-[#00ff66]/65" />
                  <h2 className="mt-5 text-3xl font-bold text-[#00ff66]">
                    Select a recipient
                  </h2>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-[#8eaa9b]">
                    Open a personnel record from the left rail to view existing
                    medals and issue a new decoration.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <section className="border border-[#00ff66]/15 bg-black/35">
                  <div className="flex flex-col gap-4 border-b border-[#00ff66]/15 p-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/55">
                        Active Dossier
                      </p>
                      <h2 className="mt-2 text-3xl font-bold text-[#00ff66]">
                        {getRankName(selectedPerson)} {selectedPerson.name}
                      </h2>
                      <p className="mt-2 text-sm text-gray-400">
                        {selectedPerson.slotted_position || "Unassigned"}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:w-[280px]">
                      <div className="border border-[#00ff66]/15 bg-black/30 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                          Medals
                        </p>
                        <p className="mt-1 text-2xl font-bold text-white">
                          {personMedals.length}
                        </p>
                      </div>
                      <div className="border border-[#00ff66]/15 bg-black/30 px-3 py-3">
                        <p className="text-[10px] uppercase tracking-[0.16em] text-gray-500">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-semibold text-[#00ff66]">
                          Ready
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    {loadingMedals ? (
                      <div className="grid gap-3 md:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, index) => (
                          <div
                            key={index}
                            className="h-28 animate-pulse border border-[#00ff66]/10 bg-white/[0.03]"
                          />
                        ))}
                      </div>
                    ) : personMedals.length === 0 ? (
                      <div className="border border-[#00ff66]/12 bg-black/30 px-5 py-10 text-center text-[#00ff66]/65">
                        No medals assigned yet.
                      </div>
                    ) : (
                      <div className="grid gap-3 md:grid-cols-2">
                        {personMedals.map((entry) => (
                          <div
                            key={entry.id}
                            className="border border-[#00ff66]/15 bg-black/35 p-4"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-start gap-3">
                                  <div
                                    className="grid h-11 w-11 shrink-0 place-items-center border border-[#00ff66]/25 bg-[#00ff66]/10"
                                    style={{
                                      color:
                                        entry.award?.ribbon_color ||
                                        "#00ff66",
                                    }}
                                  >
                                    <MedalIcon iconKey={entry.award?.icon_key} />
                                  </div>
                                  <div className="min-w-0">
                                    <h3 className="text-sm font-semibold text-white">
                                      {entry.award?.name || "Unknown Medal"}
                                    </h3>
                                    {entry.award?.category && (
                                      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#00ff66]">
                                        {entry.award.category}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => removeMedal(entry.id)}
                                disabled={removingMedalId === entry.id}
                                className="grid h-9 w-9 shrink-0 place-items-center border border-red-500/35 text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
                                aria-label="Remove medal"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>

                            {entry.award?.description && (
                              <p className="mt-3 text-xs leading-5 text-[#8eaa9b]">
                                {entry.award.description}
                              </p>
                            )}
                            {entry.notes && (
                              <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-gray-400">
                                {entry.notes}
                              </p>
                            )}
                            <p className="mt-3 text-[11px] text-gray-500">
                              Awarded{" "}
                              {entry.awarded_at
                                ? new Date(entry.awarded_at).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              </>
            )}
          </main>

          <aside className="border border-[#00ff66]/15 bg-black/35 xl:sticky xl:top-5 xl:h-fit">
            <div className="border-b border-[#00ff66]/15 p-5">
              <p className="text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/55">
                Decoration Desk
              </p>
              <h2 className="mt-1 text-2xl font-bold text-[#00ff66]">
                Issue Medal
              </h2>
              <p className="mt-2 text-xs leading-5 text-gray-400">
                Select a medal and add optional citation notes before awarding.
              </p>
            </div>

            <div className="p-5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/55" />
                <input
                  type="text"
                  placeholder="Search medals..."
                  value={medalSearch}
                  onChange={(event) => setMedalSearch(event.target.value)}
                  className="h-11 w-full rounded-md border border-[#00ff66]/25 bg-black/50 pl-10 pr-3 text-sm text-[#00ff66] outline-none transition placeholder:text-[#00ff66]/30 focus:border-[#00ff66]/65"
                />
              </div>

              <div className="mt-4 max-h-[300px] overflow-y-auto border border-[#00ff66]/15 bg-black/45">
                {filteredMedals.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">No medals found.</p>
                ) : (
                  filteredMedals.map((medal) => {
                    const isSelected = selectedMedal?.id === medal.id;
                    const isAssigned = assignedMedalIds.has(medal.id);

                    return (
                      <button
                        key={medal.id}
                        type="button"
                        onClick={() => setSelectedMedal(medal)}
                        className={`w-full border-b px-4 py-4 text-left transition last:border-b-0 ${
                          isSelected
                            ? "border-[#00ff66]/30 bg-[#00ff66]/12"
                            : "border-[#00ff66]/10 hover:bg-[#00ff66]/8"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="mb-2 flex items-center gap-2">
                              <span
                                className="h-1.5 w-8 rounded-full"
                                style={{
                                  backgroundColor:
                                    medal.ribbon_color || "#00ff66",
                                }}
                              />
                              <MedalIcon
                                iconKey={medal.icon_key}
                                className="h-4 w-4"
                                style={{ color: medal.ribbon_color || "#00ff66" }}
                              />
                            </div>
                            <p className="text-sm font-semibold text-white">
                              {medal.name}
                            </p>
                            {medal.category && (
                              <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-[#00ff66]">
                                {medal.category}
                              </p>
                            )}
                            {medal.description && (
                              <p className="mt-2 text-xs leading-5 text-[#8eaa9b]">
                                {medal.description}
                              </p>
                            )}
                          </div>
                          {isAssigned && (
                            <span className="shrink-0 border border-amber-400/25 bg-amber-400/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-amber-300">
                              Held
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              <div className="mt-5 border border-[#00ff66]/15 bg-black/35 p-4">
                <div className="flex items-start gap-3">
                  <div
                    className="grid h-10 w-10 shrink-0 place-items-center border border-[#00ff66]/25 bg-[#00ff66]/10"
                    style={{
                      color: selectedMedal?.ribbon_color || "#00ff66",
                    }}
                  >
                    {selectedMedal ? (
                      <MedalIcon iconKey={selectedMedal.icon_key} />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">
                      {selectedMedal?.name || "No medal selected"}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-400">
                      {selectedPerson
                        ? `${getRankName(selectedPerson)} ${selectedPerson.name}`
                        : "Select a recipient before awarding."}
                    </p>
                    {selectedMedal?.description && (
                      <p className="mt-3 text-xs leading-5 text-[#8eaa9b]">
                        {selectedMedal.description}
                      </p>
                    )}
                  </div>
                </div>

                {selectedMedalAlreadyAssigned && (
                  <div className="mt-4 flex items-center gap-2 border border-amber-400/25 bg-amber-400/10 px-3 py-2 text-xs text-amber-300">
                    <CheckCircle2 className="h-4 w-4" />
                    Recipient already holds this medal.
                  </div>
                )}
              </div>

              <label className="mt-5 block text-xs uppercase tracking-[0.16em] text-[#7fa08e]">
                Citation Notes
              </label>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={6}
                placeholder="Optional medal citation notes..."
                className="mt-2 w-full resize-none rounded-md border border-[#00ff66]/25 bg-black/45 px-4 py-3 text-sm text-white outline-none transition placeholder:text-gray-500 focus:border-[#00ff66]/65"
              />

              <button
                type="button"
                onClick={awardMedal}
                disabled={
                  !selectedPerson ||
                  !selectedMedal ||
                  selectedMedalAlreadyAssigned ||
                  submitting
                }
                className="mt-5 w-full border border-[#00ff66]/40 bg-[#00ff66]/10 px-4 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-[#00ff66] transition hover:bg-[#00ff66]/20 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {submitting
                  ? "Awarding..."
                  : selectedMedal
                    ? `Award ${selectedMedal.name}`
                    : "Select Medal"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
