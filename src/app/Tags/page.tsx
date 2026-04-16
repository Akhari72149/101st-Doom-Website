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
};

export default function CertificationLookupByTag() {
  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [search, setSearch] = useState("");
  const [certificationResults, setCertificationResults] = useState<CertificationRow[]>([]);
  const [selectedCertification, setSelectedCertification] = useState<CertificationRow | null>(null);
  const [personnel, setPersonnel] = useState<PersonRow[]>([]);
  const [loadingResults, setLoadingResults] = useState(false);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
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
    const { data } = await supabase.from("ranks").select("id, name").order("name");
    setRanks(data || []);
  };

  const fetchCertifications = async (value: string) => {
    setLoadingResults(true);

    const { data, error } = await supabase
      .from("certifications")
      .select("id, name")
      .ilike("name", `%${value}%`)
      .order("name");

    if (error) {
      console.error("Error fetching certifications:", error);
      setCertificationResults([]);
      setLoadingResults(false);
      return;
    }

    const results = [...(data || [])];
    const lower = value.toLowerCase();

    const shouldShowReservist =
      lower.includes("reservist") || lower.includes("reserv");

    if (
      shouldShowReservist &&
      !results.some((item) => item.id === "special-reservist")
    ) {
      results.unshift({
        id: "special-reservist",
        name: "Reservist",
      });
    }

    setCertificationResults(results);
    setLoadingResults(false);
  };

  const fetchPersonnelByCertification = async (certificationId: string) => {
    setLoadingPersonnel(true);

    const { data, error } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        awarded_at,
        personnel:personnel_id (
          id,
          name,
          rank_id,
          status
        )
      `)
      .eq("certification_id", certificationId)
      .order("awarded_at", { ascending: false });

    if (error) {
      console.error("Error fetching personnel by certification:", error);
      setPersonnel([]);
      setLoadingPersonnel(false);
      return;
    }

    const people = (data || [])
      .map((row: any) => {
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

    setPersonnel(people);
    setLoadingPersonnel(false);
  };

  const fetchReservists = async () => {
    setLoadingPersonnel(true);

    const { data, error } = await supabase
      .from("personnel")
      .select("id, name, rank_id, status, slotted_position, reservist_since")
      .is("slotted_position", null)
      .order("name");

    if (error) {
      console.error("Error fetching reservists:", error);
      setPersonnel([]);
      setLoadingPersonnel(false);
      return;
    }

    const people = (data || []).map((p: any) => ({
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

  const getReservistDuration = (dateString: string | null | undefined) => {
    if (!dateString) return "Unknown";

    const start = new Date(dateString);
    const now = new Date();

    if (Number.isNaN(start.getTime())) return "Unknown";

    const diffMs = now.getTime() - start.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

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
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
        >
          ← Return to Dashboard
        </button>

        <h1
          className="
            text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-8
            text-transparent bg-clip-text
            bg-gradient-to-r from-[#00ff66] to-[#00ffaa]
            tracking-[0.35em] sm:tracking-[0.5em]
            drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]
          "
        >
          TAG LOOKUP
        </h1>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff66]/50 w-5 h-5" />
          <input
            type="text"
            placeholder="Search certification or Reservist..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="
              w-full pl-12 pr-4 p-4 rounded-xl
              bg-black/40 backdrop-blur-md
              border border-[#00ff66]/40
              text-[#00ff66]
              placeholder:text-[#00ff66]/40
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
              transition-all duration-300
              outline-none
            "
          />
        </div>

        {search.trim() && (
          <div
            className="
              mb-8
              border border-[#00ff66]/30
              bg-black/60 backdrop-blur-lg
              rounded-xl
              shadow-[0_0_40px_rgba(0,255,100,0.1)]
              max-h-64 overflow-y-auto
              transition-all duration-300
            "
          >
            {loadingResults ? (
              <p className="p-4 text-gray-400">Searching tags...</p>
            ) : certificationResults.length === 0 ? (
              <p className="p-4 text-gray-400">No certifications found.</p>
            ) : (
              certificationResults.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() => {
                    setSelectedCertification(cert);
                    setSearch("");
                    setCertificationResults([]);

                    if (cert.id === "special-reservist") {
                      fetchReservists();
                    } else {
                      fetchPersonnelByCertification(cert.id);
                    }
                  }}
                  className="
                    px-4 py-3
                    border-b last:border-b-0 border-[#00ff66]/20
                    cursor-pointer
                    transition-all duration-200
                    hover:bg-[#00ff66]/10
                    hover:text-[#00ff66]
                    hover:pl-6
                  "
                >
                  {cert.name}
                </div>
              ))
            )}
          </div>
        )}

        {selectedCertification && (
          <div
            className="
              p-6 sm:p-8 rounded-3xl
              bg-black/60 backdrop-blur-2xl
              border border-[#00ff66]/40
              shadow-[0_0_80px_rgba(0,255,100,0.25)]
            "
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
              <div className="flex items-center gap-3 flex-wrap">
                <h2
                  className="
                    text-xl sm:text-2xl font-bold
                    text-[#00ff66]
                    tracking-widest
                  "
                >
                  {isReservistView
                    ? "Personnel with: Reservist"
                    : `Personnel with: ${selectedCertification.name}`}
                </h2>

                <span
                  className={`px-3 py-1 rounded-full border text-sm ${
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
                className="px-3 py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/10 transition"
              >
                Clear
              </button>
            </div>

            <div className="mb-6 border-b border-[#00ff66]/40 pb-4">
              <p className="text-sm text-[#00ff66]/70">
                {loadingPersonnel
                  ? "Loading personnel..."
                  : `${personnel.length} result${personnel.length === 1 ? "" : "s"} found`}
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
                  Try another certification or check your data
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-[#00ff66]/40">
                <table className="w-full min-w-[520px]">
                  <thead className="bg-[#00ff66]/20 backdrop-blur-md text-[#00ff66]">
                    <tr>
                      <th className="px-4 py-3 text-left">Rank</th>
                      <th className="px-4 py-3 text-left">Name</th>
                      {isReservistView ? (
                        <th className="px-4 py-3 text-left">Reservist For</th>
                      ) : (
                        <th className="px-4 py-3 text-left">Awarded</th>
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {personnel.map((p) => (
                      <tr
                        key={p.personnelCertificationId}
                        className="
                          border-t border-[#00ff66]/20
                          transition-all duration-200
                          hover:bg-[#00ff66]/10
                          even:bg-[#00ff66]/5
                        "
                      >
                        <td className="px-4 py-3 text-[#00ff66]">
                          {getRankName(p)}
                        </td>
                        <td className="px-4 py-3">{p.name}</td>

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
                    ))}
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