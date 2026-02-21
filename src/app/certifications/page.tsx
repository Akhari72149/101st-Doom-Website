"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CertificationByPerson() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [certifications, setCertifications] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetchPersonnel();
  }, []);

  const fetchPersonnel = async () => {
    const { data } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    setPersonnel(data || []);
  };

  /* =====================================================
     🔥 FETCH CERTIFICATIONS (AWARDED_BY REMOVED)
  ======================================================*/
  const fetchCertifications = async (personId: string) => {
    const { data, error } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        awarded_at,
        certification:certification_id ( id, name )
      `)
      .eq("personnel_id", personId)
      .order("awarded_at", { ascending: false });

    console.log("CERT DATA:", data);
    console.log("ERROR:", error);

    setCertifications(data || []);
  };

  const filteredPersonnel = personnel.filter((p) =>
    `${p.Clone_Rank} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="p-8 text-white">
	<button
    onClick={() => router.push("/")}
    className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00] transition"
  >
    ← Back to Dashboard
  </button>
      <h1 className="text-3xl font-bold mb-6">
        Certification Lookup
      </h1>

      {/* Search Bar */}
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search by name or rank..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* Search Results */}
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
                {p.Clone_Rank} {p.name}
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected Person Certifications */}
      {selectedPerson && (
        <div className="border border-[#002700] p-6 bg-[#0f1a0f]">
          <h2 className="text-2xl font-bold mb-4">
            {selectedPerson.Clone_Rank} {selectedPerson.name}
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