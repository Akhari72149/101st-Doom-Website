"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CertificationByPerson() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [certifications, setCertifications] = useState<any[]>([]);
  const router = useRouter();

  /* =====================================================
     🔥 FETCH PERSONNEL + RANKS
  ======================================================*/

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: people } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    const { data: rankData } = await supabase
      .from("ranks")
      .select("*");

    setPersonnel(people || []);
    setRanks(rankData || []);
  };

  /* =====================================================
     🔥 FETCH CERTIFICATIONS
  ======================================================*/

  const fetchCertifications = async (personId: string) => {
    const { data } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        awarded_at,
        certification:certification_id ( id, name )
      `)
      .eq("personnel_id", personId)
      .order("awarded_at", { ascending: false });

    setCertifications(data || []);
  };

  /* =====================================================
     🔥 HELPERS
  ======================================================*/

  const getRankName = (person: any) => {
    const rank = ranks.find((r) => r.id === person.rank_id);
    return rank ? rank.name : "Unranked";
  };

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* =====================================================
     ✅ UI — GREEN TACTICAL THEME
  ======================================================*/

  return (
    <div className="
      min-h-screen
      bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00]
      text-[#eafff2]
      p-10
      font-orbitron
      tracking-wide
    ">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-6
          border border-[#00ff4c]
          px-4 py-2
          rounded-lg
          transition-all duration-300
          shadow-[0_0_15px_rgba(0,255,80,0.3)]
          hover:bg-[#003d14]
          hover:text-[#00ff4c]
          hover:scale-105
          hover:shadow-[0_0_25px_rgba(0,255,80,0.6)]
        "
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-4xl font-bold mb-8 text-[#00ff4c] tracking-widest">
        Certification Lookup
      </h1>

      {/* SEARCH */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="
            bg-black
            border border-[#00ff4c]
            p-3 w-full
            rounded-xl
            text-white
            placeholder-gray-400
            focus:outline-none
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all duration-300
            shadow-[0_0_15px_rgba(0,255,80,0.2)]
          "
        />
      </div>

      {/* SEARCH RESULTS */}
      {search && (
        <div className="mb-8 border border-[#00ff4c] bg-black/60 rounded-xl">
          {filteredPersonnel.length === 0 ? (
            <p className="p-4 text-gray-400">
              No personnel found.
            </p>
          ) : (
            filteredPersonnel.map((p) => (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedPerson(p);
                  fetchCertifications(p.id);
                  setSearch("");
                }}
                className="
                  p-3
                  border-b border-[#00ff4c]
                  cursor-pointer
                  transition-all duration-300
                  hover:bg-[#003d14]
                  hover:text-[#00ff4c]
                  hover:pl-6
                "
              >
                {getRankName(p)} {p.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* SELECTED PERSON */}
      {selectedPerson && (
        <div className="
          border border-[#00ff4c]
          p-6
          bg-black/60
          rounded-2xl
          shadow-[0_0_40px_rgba(0,255,80,0.2)]
        ">
          <h2 className="text-2xl font-bold mb-6 text-[#00ff4c]">
            {getRankName(selectedPerson)} {selectedPerson.name}
          </h2>

          {certifications.length === 0 ? (
            <p className="text-gray-400">
              No certifications assigned.
            </p>
          ) : (
            <table className="w-full border border-[#00ff4c]">
              <thead className="bg-[#00ff4c] text-black">
                <tr>
                  <th className="px-4 py-2 text-left">
                    Certification
                  </th>
                  <th className="px-4 py-2 text-left">
                    Awarded At
                  </th>
                </tr>
              </thead>

              <tbody>
                {certifications.map((c) => (
                  <tr
                    key={c.id}
                    className="
                      border-t border-[#00ff4c]
                      transition-all duration-300
                      hover:bg-[#003d14]
                      hover:text-[#00ff4c]
                    "
                  >
                    <td className="px-4 py-3">
                      {c.certification?.name || "Unknown"}
                    </td>

                    <td className="px-4 py-3">
                      {c.awarded_at
                        ? new Date(c.awarded_at).toLocaleDateString()
                        : "N/A"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}