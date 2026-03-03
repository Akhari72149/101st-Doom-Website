"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export default function CertificationByPerson() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [certifications, setCertifications] = useState<any[]>([]);
  const router = useRouter();

  /* ===================================================== */
  /* FETCH */
  /* ===================================================== */

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

  /* ===================================================== */
  /* HELPERS */
  /* ===================================================== */

  const getRankName = (person: any) => {
    const rank = ranks.find((r) => r.id === person.rank_id);
    return rank ? rank.name : "Unranked";
  };

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ===================================================== */
  /* UI */
  /* ===================================================== */

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

      {/* TITLE */}
      <h1 className="
        text-4xl font-extrabold mb-8
        text-transparent bg-clip-text
        bg-gradient-to-r from-[#00ff66] to-[#00ffaa]
        tracking-[0.5em]
        drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]
       ">
        CERTIFICATION LOOKUP
      </h1>

      {/* SEARCH */}
      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff66]/50 w-5 h-5" />
        <input
          type="text"
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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

      {/* SEARCH RESULTS */}
      {search && (
        <div className="
          mb-8
          border border-[#00ff66]/30
          g-black/60 backdrop-blur-lg
          rounded-xl
          shadow-[0_0_40px_rgba(0,255,100,0.1)]
          max-h-64 overflow-y-auto
          transition-all duration-300
        ">
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
                  px-4 py-3
                  border-b border-[#00ff66]/20
                  cursor-pointer
                  transition-all duration-200
                  hover:bg-[#00ff66]/10
                  hover:text-[#00ff66]
                  hover:pl-6
                "
              >
                {getRankName(p)} {p.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* PROFILE CARD */}
      {selectedPerson && (
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
            {getRankName(selectedPerson)} {selectedPerson.name}
          </h2>

          {/* CERTIFICATIONS TABLE */}
          {certifications.length === 0 ? (
            <div className="py-10 text-center text-[#00ff66]/60">
              <p className="text-lg font-medium">
                No certifications assigned yet
                 </p>
                  <p className="text-sm opacity-70">
                   Assign certifications to this person to see them listed here
                </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-[#00ff66]/40">
              <table className="w-full">
                <thead className="bg-[#00ff66]/20 backdrop-blur-md text-[#00ff66]">
                  <tr>
                    
                    <th className="px-4 py-3 text-left">
                      
                      Certification
                    </th>
                    <th className="px-4 py-3 text-left">
                      Awarded
                    </th>
                    
                  </tr>
                </thead>

                <tbody>
                  {certifications.map((c) => (
                    <tr
                      key={c.id}
                      className="
                        border-t border-[#00ff66]/20
                        transition-all duration-200
                        hover:bg-[#00ff66]/10
                        even:bg-[#00ff66]/5
                      "
                    >
                      <td className="px-4 py-3">
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
          )}
        </div>
      )}
    </div>
</div>
  );
}