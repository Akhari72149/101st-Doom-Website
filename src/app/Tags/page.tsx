"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function CertificationLookupByTag() {
  const [ranks, setRanks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [certificationResults, setCertificationResults] = useState<any[]>([]);
  const [selectedCertification, setSelectedCertification] = useState<any>(null);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchRanks();
  }, []);

  const fetchRanks = async () => {
    const { data } = await supabase
      .from("ranks")
      .select("*");

    setRanks(data || []);
  };

  const fetchCertifications = async (value: string) => {
    if (!value.trim()) {
      setCertificationResults([]);
      return;
    }

    const { data, error } = await supabase
      .from("certifications")
      .select("id, name")
      .ilike("name", `%${value}%`)
      .order("name");

    if (error) {
      console.error("Error fetching certifications:", error);
      setCertificationResults([]);
      return;
    }

    const results = [...(data || [])];

    const lower = value.toLowerCase();
    const shouldShowReservist =
      "reservist".includes(lower) || lower.includes("reserv");

    if (shouldShowReservist) {
      results.unshift({
        id: "special-reservist",
        name: "Reservist",
      });
    }

    setCertificationResults(results);
  };

  const fetchPersonnelByCertification = async (certificationId: string) => {
    const { data, error } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        awarded_at,
        personnel:personnel_id (
          id,
          name,
          rank_id
        )
      `)
      .eq("certification_id", certificationId)
      .order("awarded_at", { ascending: false });

    if (error) {
      console.error("Error fetching personnel by certification:", error);
      setPersonnel([]);
      return;
    }

    const people = (data || [])
      .map((row) => ({
        ...row.personnel,
        awarded_at: row.awarded_at,
        personnelCertificationId: row.id,
      }))
      .filter(Boolean);

    setPersonnel(people);
  };

  const fetchReservists = async () => {
    const { data, error } = await supabase
      .from("personnel")
      .select("id, name, rank_id, slotted_position, reservist_since")
      .is("slotted_position", null)
      .order("name");

    if (error) {
      console.error("Error fetching reservists:", error);
      setPersonnel([]);
      return;
    }

    const people = (data || []).map((p) => ({
      ...p,
      awarded_at: null,
      personnelCertificationId: `reservist-${p.id}`,
    }));

    setPersonnel(people);
  };

  const getRankName = (person: any) => {
    const rank = ranks.find((r) => r.id === person.rank_id);
    return rank ? rank.name : "Unranked";
  };

  const getReservistDuration = (dateString: string | null) => {
    if (!dateString) return "Unknown";

    const start = new Date(dateString);
    const now = new Date();

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

  const isReservistView = selectedCertification?.id === "special-reservist";

  return (
    <div className="
      min-h-screen
      bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
      text-[#eafff2]
      p-10
    ">
      <div className="max-w-6xl mx-auto">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
        >
          ← Return to Dashboard
        </button>

        <h1 className="
          text-4xl font-extrabold mb-8
          text-transparent bg-clip-text
          bg-gradient-to-r from-[#00ff66] to-[#00ffaa]
          tracking-[0.5em]
          drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]
        ">
          TAG LOOKUP
        </h1>

        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff66]/50 w-5 h-5" />
          <input
            type="text"
            placeholder="Search certification or Reservist..."
            value={search}
            onChange={(e) => {
              const value = e.target.value;
              setSearch(value);
              fetchCertifications(value);
            }}
            className="
              w-full pl-12 p-4 rounded-xl
              bg-black/40 backdrop-blur-md
              border border-[#00ff66]/40
              text-[#00ff66]
              placeholder:text-[#00ff66]/40
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
              transition-all duration-300
            "
          />
        </div>

        {search && (
          <div className="
            mb-8
            border border-[#00ff66]/30
            bg-black/60 backdrop-blur-lg
            rounded-xl
            shadow-[0_0_40px_rgba(0,255,100,0.1)]
            max-h-64 overflow-y-auto
            transition-all duration-300
          ">
            {certificationResults.length === 0 ? (
              <p className="p-4 text-gray-400">
                No certifications found.
              </p>
            ) : (
              certificationResults.map((cert) => (
                <div
                  key={cert.id}
                  onClick={() => {
                    setSelectedCertification(cert);

                    if (cert.id === "special-reservist") {
                      fetchReservists();
                    } else {
                      fetchPersonnelByCertification(cert.id);
                    }

                    setSearch("");
                    setCertificationResults([]);
                  }}
                  className="
                    px-4 py-3
                    border-b border-[#00ff66]/20
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
          <div className="
            p-8 rounded-3xl
            bg-black/60 backdrop-blur-2xl
            border border-[#00ff66]/40
            shadow-[0_0_80px_rgba(0,255,100,0.25)]
            animate-fade-in
          ">
            <h2 className="
              text-2xl font-bold mb-6
              text-[#00ff66]
              tracking-widest
              border-b border-[#00ff66]/40
            ">
              {isReservistView
                ? "Personnel with: Reservist"
                : `Personnel with: ${selectedCertification.name}`}
            </h2>

            {personnel.length === 0 ? (
              <div className="py-10 text-center text-[#00ff66]/60">
                <p className="text-lg font-medium">
                  No personnel found
                </p>
                <p className="text-sm opacity-70">
                  Try another certification or check your data
                </p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-[#00ff66]/40">
                <table className="w-full">
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
                        <td className="px-4 py-3">
                          {p.name}
                        </td>

                        {isReservistView ? (
                          <td className="px-4 py-3 text-[#00ff66]">
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