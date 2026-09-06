"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

type CertificationRow = {
  id: string;
  awarded_at: string | null;
  certification?: {
    id?: string;
    name?: string | null;
  } | null;
};

type ActiveTab = "normal" | "trainer";

export default function CertificationByPerson() {
  const router = useRouter();

  const [personnel, setPersonnel] = useState<Person[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [certifications, setCertifications] = useState<CertificationRow[]>([]);
  const [loadingCertifications, setLoadingCertifications] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("normal");
  const [directoryError, setDirectoryError] = useState("");
  const [certificationError, setCertificationError] = useState("");
  const requestId = useRef(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/personnel-profile", { cache: "no-store" });
      const body = (await response.json().catch(() => null)) as {
        personnel?: Person[];
        ranks?: Rank[];
      } | null;
      if (!response.ok || !body) throw new Error("CERTIFICATION_DIRECTORY_LOAD_FAILED");
      setPersonnel(body.personnel || []);
      setRanks(body.ranks || []);
      setDirectoryError("");
    } catch {
      setDirectoryError("The personnel directory could not be loaded.");
    }
  };

  const fetchCertifications = async (person: Person) => {
    const currentRequest = ++requestId.current;
    setSelectedPerson(person);
    setLoadingCertifications(true);
    setCertifications([]);
    setCertificationError("");
    setActiveTab("normal");

    try {
      const response = await fetch(
        `/api/personnel-profile?personnelId=${encodeURIComponent(person.id)}`,
        { cache: "no-store" },
      );
      const body = (await response.json().catch(() => null)) as {
        certifications?: CertificationRow[];
      } | null;
      if (!response.ok || !body) throw new Error("CERTIFICATION_LOAD_FAILED");
      if (requestId.current === currentRequest) {
        setCertifications(body.certifications || []);
      }
    } catch {
      if (requestId.current === currentRequest) {
        setCertificationError("Certifications could not be loaded for this person.");
      }
    } finally {
      if (requestId.current === currentRequest) setLoadingCertifications(false);
    }
  };

  const rankMap = useMemo(() => {
    return Object.fromEntries(ranks.map((rank) => [rank.id, rank.name]));
  }, [ranks]);

  const getRankName = useCallback((person: Person | null) => {
    if (!person?.rank_id) return "Unranked";
    return rankMap[person.rank_id] || "Unranked";
  }, [rankMap]);

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
  }, [personnel, normalizedSearch, getRankName]);

  const trainerCerts = useMemo(() => {
    return certifications.filter((c) =>
      c.certification?.name?.toLowerCase().includes("trainer")
    );
  }, [certifications]);

  const normalCerts = useMemo(() => {
    return certifications.filter(
      (c) => !c.certification?.name?.toLowerCase().includes("trainer")
    );
  }, [certifications]);

  const visibleCerts = activeTab === "trainer" ? trainerCerts : normalCerts;

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
            CERTIFICATION LOOKUP
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8eaa9b]">
            Search active personnel by rank or name and view their awarded
            certifications in a single dossier-style panel.
          </p>
        </div>

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
                {directoryError ? (
                  <p className="p-4 text-sm text-red-300">{directoryError}</p>
                ) : filteredPersonnel.length === 0 ? (
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
                          fetchCertifications(p);
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
                      Certification Viewer
                    </div>
                    <h2 className="mt-3 text-3xl font-bold text-[#00ff66]">
                      Select a person to view certifications
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8eaa9b]">
                      Search by rank or name from the directory panel and open a
                      personnel record to review all certifications awarded to
                      that person.
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
                        Search Ready
                      </div>
                      <div className="mt-2 text-3xl font-bold text-white">
                        Yes
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
                        {certifications.length} Certification
                        {certifications.length !== 1 ? "s" : ""}
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                        {normalCerts.length} Normal
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                        {trainerCerts.length} Trainer
                      </span>

                      <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-gray-300">
                        Active
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedPerson(null);
                      setCertifications([]);
                      setActiveTab("normal");
                    }}
                    className="rounded-xl border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                  >
                    Clear Selection
                  </button>
                </div>

                <div className="mt-8">
                  {loadingCertifications ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <div
                          key={i}
                          className="h-14 animate-pulse rounded-xl border border-[#00ff66]/15 bg-white/[0.03]"
                        />
                      ))}
                    </div>
                  ) : certificationError ? (
                    <div className="py-12 text-center text-red-300">
                      {certificationError}
                    </div>
                  ) : (
                    <>
                      <div className="mb-5 flex flex-wrap gap-3 border-b border-[#00ff66]/20 pb-4">
                        <button
                          onClick={() => setActiveTab("normal")}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.14em] transition ${
                            activeTab === "normal"
                              ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                              : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                          }`}
                        >
                          QUALIFICATIONS ({normalCerts.length})
                        </button>

                        <button
                          onClick={() => setActiveTab("trainer")}
                          className={`rounded-xl border px-4 py-2 text-sm font-semibold tracking-[0.14em] transition ${
                            activeTab === "trainer"
                              ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                              : "border-white/10 bg-white/[0.03] text-gray-400 hover:text-white"
                          }`}
                        >
                          TRAINER QUALIFICATIONS ({trainerCerts.length})
                        </button>
                      </div>

                      {visibleCerts.length === 0 ? (
                        <div className="py-12 text-center text-[#00ff66]/60">
                          <p className="text-lg font-medium">
                            {activeTab === "trainer"
                              ? "No trainer certifications assigned yet"
                              : "No certifications assigned yet"}
                          </p>
                          <p className="mt-2 text-sm opacity-70">
                            {activeTab === "trainer"
                              ? "Trainer certifications will appear here when awarded"
                              : "Assign certifications to this person to see them listed here"}
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-xl border border-[#00ff66]/35">
                          <div className="max-h-[520px] overflow-y-auto">
                            <table className="w-full">
                              <thead className="sticky top-0 bg-[#00ff66]/18 backdrop-blur-md text-[#00ff66]">
                                <tr>
                                  <th className="px-4 py-3 text-left font-semibold">
                                    Certification
                                  </th>
                                  <th className="w-[180px] px-4 py-3 text-left font-semibold">
                                    Awarded
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {visibleCerts.map((c, index) => (
                                  <tr
                                    key={c.id}
                                    className={`
                                      border-t border-[#00ff66]/15
                                      transition-all duration-200
                                      hover:bg-[#00ff66]/10
                                      ${index % 2 === 1 ? "bg-[#00ff66]/5" : ""}
                                    `}
                                  >
                                    <td className="px-4 py-3 text-white">
                                      {c.certification?.name || "Unknown"}
                                    </td>

                                    <td className="px-4 py-3 text-[#00ff66]">
                                      {c.awarded_at
                                        ? new Date(c.awarded_at).toLocaleDateString()
                                        : "N/A"}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
