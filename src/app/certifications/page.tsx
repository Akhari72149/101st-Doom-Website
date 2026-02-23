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
     🔥 HELPERS (RANK RESOLUTION)
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
     ✅ UI (BLUE HOLO + ORBITRON)
  ======================================================*/

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-[#e6faff] p-10 font-orbitron tracking-wide">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 border border-[#00e5ff] px-4 py-2 hover:bg-[#00e5ff] hover:text-black transition shadow-[0_0_15px_rgba(0,229,255,0.4)]"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-4xl font-bold mb-8 text-[#00e5ff] tracking-widest">
        Certification Lookup
      </h1>

      {/* SEARCH */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-black border border-[#00e5ff] p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00e5ff] shadow-[0_0_15px_rgba(0,229,255,0.2)]"
        />
      </div>

      {/* SEARCH RESULTS */}
      {search && (
        <div className="mb-8 border border-[#00e5ff] bg-black/60 rounded-xl">
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
                className="p-3 border-b border-[#00e5ff] cursor-pointer hover:bg-[#00e5ff] hover:text-black transition"
              >
                {getRankName(p)} {p.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* SELECTED PERSON */}
      {selectedPerson && (
        <div className="border border-[#00e5ff] p-6 bg-black/60 rounded-2xl shadow-[0_0_40px_rgba(0,229,255,0.2)]">
          <h2 className="text-2xl font-bold mb-6 text-[#00e5ff]">
            {getRankName(selectedPerson)} {selectedPerson.name}
          </h2>

          {certifications.length === 0 ? (
            <p className="text-gray-400">
              No certifications assigned.
            </p>
          ) : (
            <table className="w-full border border-[#00e5ff]">
              <thead className="bg-[#00e5ff] text-black">
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
                    className="border-t border-[#00e5ff] hover:bg-[#00e5ff]/10 transition"
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