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

  /* =====================================================
     🔎 FILTER
  ======================================================*/

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* =====================================================
     ✅ UI
  ======================================================*/

  return (
    <div className="p-8 text-white">

      <button
        onClick={() => router.push("/")}
        className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
      >
        ← Back to Dashboard
      </button>

      <h1 className="text-3xl font-bold mb-6">
        Certification Lookup
      </h1>

      {/* SEARCH */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* SEARCH RESULTS */}
      {search && (
        <div className="mb-8 border border-[#002700] bg-[#0f1a0f]">
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
                className="p-3 border-b border-[#002700] cursor-pointer hover:bg-[#002700]"
              >
                {getRankName(p)} {p.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* SELECTED PERSON */}
      {selectedPerson && (
        <div className="border border-[#002700] p-6 bg-[#0f1a0f]">
          <h2 className="text-2xl font-bold mb-4">
            {getRankName(selectedPerson)} {selectedPerson.name}
          </h2>

          {certifications.length === 0 ? (
            <p className="text-gray-400">
              No certifications assigned.
            </p>
          ) : (
            <table className="w-full border border-[#002700]">
              <thead className="bg-[#002700]">
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
                    className="border-t border-[#002700]"
                  >
                    <td className="px-4 py-2">
                      {c.certification?.name || "Unknown"}
                    </td>

                    <td className="px-4 py-2">
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