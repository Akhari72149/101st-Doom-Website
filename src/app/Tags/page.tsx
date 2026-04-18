"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

type RankRow = {
  id: string;
  name: string;
};

type CertificationRow = {
  id: string;
  name: string;
};

type PersonRow = {
  id: string;
  name: string;
  rank_id: string | null;
  status?: string | null;
  slotted_position?: string | null;
  reservist_since?: string | null;
  awarded_at?: string | null;
  personnelCertificationId: string;
  mos?: string | null;
};

type PersonnelCertificationQueryRow = {
  id: string;
  awarded_at: string | null;
  personnel:
    | {
        id: string;
        name: string;
        rank_id: string | null;
        status?: string | null;
        slotted_position?: string | null;
        reservist_since?: string | null;
        mos?: string | null;
      }
    | {
        id: string;
        name: string;
        rank_id: string | null;
        status?: string | null;
        slotted_position?: string | null;
        reservist_since?: string | null;
        mos?: string | null;
      }[]
    | null;
};

export default function CertificationLookupByTag() {
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [search, setSearch] = useState("");
  const [certificationResults, setCertificationResults] = useState<
    CertificationRow[]
  >([]);
  const [selectedCertification, setSelectedCertification] =
    useState<CertificationRow | null>(null);
  const [personnel, setPersonnel] = useState<PersonRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    fetchRanks();
  }, []);

  useEffect(() => {
    const trimmed = search.trim();

    if (!trimmed) {
      setCertificationResults([]);
      setLoadingResults(false);
      return;
    }

    const timeout = setTimeout(() => {
      fetchCertifications(trimmed);
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  const fetchRanks = async () => {
    const { data, error } = await supabase
      .from("ranks")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Error fetching ranks:", error);
      return;
    }

    setRanks((data as RankRow[]) || []);
  };

  const fetchCertifications = async (value: string) => {
    setLoadingResults(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("certifications")
      .select("id, name")
      .ilike("name", `%${value}%`)
      .order("name");

    if (error) {
      console.error("Error fetching certifications:", error);
      setCertificationResults([]);
      setLoadingResults(false);
      setErrorMessage("Failed to load tags.");
      return;
    }

    const results = [...((data as CertificationRow[]) || [])];
    const lower = value.toLowerCase();

    const shouldShowReservist =
      lower.includes("reservist") ||
      lower.includes("reserv") ||
      lower.includes("reserve");

    if (
      shouldShowReservist &&
      !results.some((item) => item.id === "special-reservist")
    ) {
      results.unshift({
        id: "special-reservist",
        name: "Reservist",
      });
    }

    const exactMatches = results.filter(
      (item) => item.name.toLowerCase() === lower
    );
    const startsWithMatches = results.filter(
      (item) =>
        item.name.toLowerCase().startsWith(lower) &&
        item.name.toLowerCase() !== lower
    );
    const containsMatches = results.filter(
      (item) => !item.name.toLowerCase().startsWith(lower)
    );

    setCertificationResults([
      ...exactMatches,
      ...startsWithMatches,
      ...containsMatches,
    ]);
    setLoadingResults(false);
  };

  const fetchPersonnelByCertification = async (certificationId: string) => {
    setLoadingPersonnel(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        awarded_at,
        personnel:personnel_id (
          id,
          name,
          rank_id,
          status,
          slotted_position,
          reservist_since,
          mos
        )
      `)
      .eq("certification_id", certificationId)
      .order("awarded_at", { ascending: false });

    if (error) {
      console.error("Error fetching personnel by certification:", error);
      setPersonnel([]);
      setLoadingPersonnel(false);
      setErrorMessage("Failed to load personnel for the selected tag.");
      return;
    }

    const mappedPeople = ((data as PersonnelCertificationQueryRow[]) || [])
      .map((row) => {
        const person = Array.isArray(row.personnel)
          ? row.personnel[0] ?? null
          : row.personnel;

        if (!person) return null;

        return {
          ...person,
          awarded_at: row.awarded_at,
          personnelCertificationId: row.id,
        } as PersonRow;
      })
      .filter(Boolean) as PersonRow[];

    const uniqueByPerson = new Map<string, PersonRow>();

    mappedPeople.forEach((person) => {
      const status = (person.status || "").trim().toLowerCase();
      if (status === "retired" || status === "removed") return;

      if (!uniqueByPerson.has(person.id)) {
        uniqueByPerson.set(person.id, person);
      }
    });

    setPersonnel(Array.from(uniqueByPerson.values()));
    setLoadingPersonnel(false);
  };

  const fetchReservists = async () => {
    setLoadingPersonnel(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("personnel")
      .select("id, name, rank_id, status, slotted_position, reservist_since, mos")
      .is("slotted_position", null)
      .order("reservist_since", { ascending: false, nullsFirst: false });

    if (error) {
      console.error("Error fetching reservists:", error);
      setPersonnel([]);
      setLoadingPersonnel(false);
      setErrorMessage("Failed to load reservists.");
      return;
    }

    const people = ((data as Omit<PersonRow, "personnelCertificationId" | "awarded_at">[]) || [])
      .filter((p) => {
        const status = (p.status || "").trim().toLowerCase();
        return status !== "retired" && status !== "removed";
      })
      .map((p) => ({
        ...p,
        awarded_at: null,
        personnelCertificationId: `reservist-${p.id}`,
      })) as PersonRow[];

    setPersonnel(people);
    setLoadingPersonnel(false);
  };

  const rankMap = useMemo(() => {
    const map: Record<string, string> = {};
    ranks.forEach((rank) => {
      map[rank.id] = rank.name;
    });
    return map;
  }, [ranks]);

  const getRankName = (person: PersonRow) => {
    if (!person.rank_id) return "Unranked";
    return rankMap[person.rank_id] || "Unranked";
  };

  const getDisplayedRank = (person: PersonRow) => {
    const mos = (person.mos || "").trim();
    if (mos) return mos;
    return getRankName(person);
  };

  const getReservistDuration = (dateString: string | null | undefined) => {
    if (!dateString) return "Not Recorded";

    const start = new Date(dateString);
    const now = new Date();

    if (Number.isNaN(start.getTime())) return "Not Recorded";

    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.max(
      0,
      Math.floor(diffMs / (1000 * 60 * 60 * 24))
    );

    if (diffDays < 1) return "Less than 1 day";
    if (diffDays === 1) return "1 day";
    if (diffDays < 30) return `${diffDays} days`;

    const months = Math.floor(diffDays / 30);
    if (months === 1) return "1 month";
    if (months < 12) return `${months} months`;

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;

    if (remainingMonths === 0) {
      return years === 1 ? "1 year" : `${years} years`;
    }

    return `${years}y ${remainingMonths}m`;
  };

  const clearSelection = () => {
    setSelectedCertification(null);
    setPersonnel([]);
    setSearch("");
    setCertificationResults([]);
    setErrorMessage("");
  };

  const isReservistView = selectedCertification?.id === "special-reservist";

  return (
    <div
      className="
        min-h-screen
        bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
        text-[#eafff2]
        p-4 sm:p-6 lg:p-10
      "
    >
      <div className="mx-auto max-w-6xl">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 rounded-lg border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-[#7aaa8c]">
            Personnel Command System
          </div>
          <h1
            className="
              mt-3
              text-2xl font-extrabold
              tracking-[0.35em] text-transparent
              bg-gradient-to-r from-[#00ff66] to-[#00ffaa] bg-clip-text
              drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]
              sm:text-3xl lg:text-4xl sm:tracking-[0.5em]
            "
          >
            TAG LOOKUP
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#9bb3a5]">
            Search by certification tag or the special Reservist tag to view
            matching personnel records.
          </p>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/50" />
          <input
            type="text"
            placeholder="Search certification or Reservist..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              if (selectedCertification) {
                setSelectedCertification(null);
                setPersonnel([]);
              }
              setErrorMessage("");
            }}
            className="
              w-full rounded-xl border border-[#00ff66]/40
              bg-black/40 p-4 pl-12 pr-4
              text-[#00ff66]
              outline-none transition-all duration-300
              placeholder:text-[#00ff66]/40
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
            "
          />
        </div>

        {errorMessage && (
          <div className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {search.trim() && (
          <div
            className="
              mb-8 max-h-64 overflow-y-auto rounded-xl
              border border-[#00ff66]/30
              bg-black/60 backdrop-blur-lg
              shadow-[0_0_40px_rgba(0,255,100,0.1)]
              transition-all duration-300
            "
          >
            {loadingResults ? (
              <p className="p-4 text-gray-400">Searching tags...</p>
            ) : certificationResults.length === 0 ? (
              <p className="p-4 text-gray-400">No certifications found.</p>
            ) : (
              certificationResults.map((cert) => (
                <button
                  key={cert.id}
                  onClick={() => {
                    setSelectedCertification(cert);
                    setSearch("");
                    setCertificationResults([]);
                    setErrorMessage("");

                    if (cert.id === "special-reservist") {
                      fetchReservists();
                    } else {
                      fetchPersonnelByCertification(cert.id);
                    }
                  }}
                  className="
                    block w-full cursor-pointer
                    border-b border-[#00ff66]/20 px-4 py-3 text-left
                    transition-all duration-200
                    hover:bg-[#00ff66]/10 hover:pl-6 hover:text-[#00ff66]
                    last:border-b-0
                  "
                >
                  {cert.name}
                </button>
              ))
            )}
          </div>
        )}

        {selectedCertification && (
          <div
            className="
              rounded-3xl border border-[#00ff66]/40
              bg-black/60 p-6 backdrop-blur-2xl
              shadow-[0_0_80px_rgba(0,255,100,0.25)]
              sm:p-8
            "
          >
            <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <h2
                  className="
                    text-xl font-bold tracking-widest text-[#00ff66]
                    sm:text-2xl
                  "
                >
                  {isReservistView
                    ? "Personnel with: Reservist"
                    : `Personnel with: ${selectedCertification.name}`}
                </h2>

                <span
                  className={`rounded-full border px-3 py-1 text-sm ${
                    isReservistView
                      ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                      : "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                  }`}
                >
                  {selectedCertification.name}
                </span>
              </div>

              <button
                onClick={clearSelection}
                className="rounded-lg border border-red-500/40 px-3 py-2 text-red-400 transition hover:bg-red-500/10"
              >
                Clear
              </button>
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#87a695]">
                  Results
                </p>
                <p className="mt-2 text-xl font-bold text-[#00ff66]">
                  {loadingPersonnel ? "..." : personnel.length}
                </p>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#87a695]">
                  View
                </p>
                <p className="mt-2 text-sm font-semibold text-[#eafff2]">
                  {isReservistView ? "Reservist Status" : "Certification Award"}
                </p>
              </div>

              <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#87a695]">
                  Selected Tag
                </p>
                <p className="mt-2 text-sm font-semibold text-[#eafff2]">
                  {selectedCertification.name}
                </p>
              </div>
            </div>

            <div className="mb-6 border-b border-[#00ff66]/40 pb-4">
              <p className="text-sm text-[#00ff66]/70">
                {loadingPersonnel
                  ? "Loading personnel..."
                  : `${personnel.length} result${
                      personnel.length === 1 ? "" : "s"
                    } found`}
              </p>
            </div>

            {loadingPersonnel ? (
              <div className="py-10 text-center text-[#00ff66]/60">
                <p className="text-lg font-medium">Loading personnel...</p>
              </div>
            ) : personnel.length === 0 ? (
              <div className="py-10 text-center text-[#00ff66]/60">
                <p className="text-lg font-medium">No personnel found</p>
                <p className="text-sm opacity-70">
                  Try another certification or check your data.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#00ff66]/40">
                <table className="min-w-[720px] w-full">
                  <thead className="sticky top-0 bg-[#00ff66]/20 text-[#00ff66] backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Status</th>
                      {isReservistView ? (
                        <th className="px-4 py-3 text-left">Reservist For</th>
                      ) : (
                        <th className="px-4 py-3 text-left">Awarded</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {personnel.map((p) => {
                      const status = (p.status || "Active").trim();
                      const statusLower = status.toLowerCase();

                      return (
                        <tr
                          key={p.personnelCertificationId}
                          onClick={() => router.push(`/personnel-profile?id=${p.id}`)}
                          className="
                            cursor-pointer
                            border-t border-[#00ff66]/20
                            transition-all duration-200
                            even:bg-[#00ff66]/5
                            hover:bg-[#00ff66]/10
                          "
                        >
                          <td className="px-4 py-3 text-[#00ff66]">
                            {getDisplayedRank(p)}
                          </td>

                          <td className="px-4 py-3 text-[#eafff2]">{p.name}</td>

                          <td className="px-4 py-3">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                statusLower === "active"
                                  ? "border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
                                  : statusLower === "loa"
                                  ? "border-amber-400/40 bg-amber-400/10 text-amber-300"
                                  : "border-cyan-400/40 bg-cyan-400/10 text-cyan-300"
                              }`}
                            >
                              {status}
                            </span>
                          </td>

                          {isReservistView ? (
                            <td className="px-4 py-3 text-cyan-300">
                              {getReservistDuration(p.reservist_since)}
                            </td>
                          ) : (
                            <td className="px-4 py-3 text-[#00ff66]">
                              {p.awarded_at
                                ? new Date(p.awarded_at).toLocaleDateString()
                                : "N/A"}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}