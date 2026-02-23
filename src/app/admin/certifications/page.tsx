"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ManageCertifications() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [personCerts, setPersonCerts] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] = useState("");
  const [searchPerson, setSearchPerson] = useState("");
  const [selectedCert, setSelectedCert] = useState("");
  const [loading, setLoading] = useState(false);

  /* ===================================================== */
  /* ================= AUTH ============================== */
  /* ===================================================== */

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = roles?.map((r) => r.role) || [];

      const allowedRoles = ["admin", "trainer"];

      const hasAccess = roleList.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasAccess) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (!loadingAuth) fetchData();
  }, [loadingAuth]);

  useEffect(() => {
    if (selectedPerson) fetchPersonCerts();
    else setPersonCerts([]);
  }, [selectedPerson]);

  const fetchData = async () => {
    const { data: people } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    const { data: rankData } = await supabase
      .from("ranks")
      .select("*")
      .order("rank_level", { ascending: true });

    const { data: certs } = await supabase
      .from("certifications")
      .select("*")
      .order("name");

    setPersonnel(people || []);
    setRanks(rankData || []);
    setCertifications(certs || []);
  };

  const fetchPersonCerts = async () => {
    const { data } = await supabase
      .from("personnel_certifications")
      .select(`
        id,
        certification:certification_id ( id, name )
      `)
      .eq("personnel_id", selectedPerson);

    setPersonCerts(data || []);
  };

  const assignCertification = async () => {
    if (!selectedPerson || !selectedCert) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from("personnel_certifications")
      .insert([
        {
          personnel_id: selectedPerson,
          certification_id: selectedCert,
          awarded_at: new Date().toISOString(),
          awarded_by: user?.id ?? null,
        },
      ]);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        alert("⚠ Already assigned.");
      } else {
        alert(error.message);
      }
      return;
    }

    setSelectedCert("");
    fetchPersonCerts();
  };

  const revokeCertification = async (recordId: string) => {
    if (!confirm("Revoke this certification?")) return;

    const { error } = await supabase
      .from("personnel_certifications")
      .delete()
      .eq("id", recordId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchPersonCerts();
  };

  const getRankName = (person: any) => {
    const rank = ranks.find((r) => r.id === person.rank_id);
    return rank ? rank.name : "Unranked";
  };

  if (loadingAuth) {
    return (
      <div className="
        min-h-screen flex items-center justify-center
        bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00]
        text-[#00ff4c] font-orbitron
      ">
        Checking Permissions...
      </div>
    );
  }

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(searchPerson.toLowerCase())
  );

  /* ===================================================== */
  /* ================= UI ================================ */
  /* ===================================================== */

  return (
    <div className="
      min-h-screen
      bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00]
      text-white
      p-8
      font-orbitron
      tracking-wide
    ">

      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-6
          border border-[#00ff4c]
          px-4 py-2
          rounded-xl
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

      <h1 className="text-4xl font-bold mb-8 text-[#00ff4c]">
        Certification Management
      </h1>

      {/* SEARCH PERSONNEL */}
      <div className="mb-6">
        <label className="block mb-2">Search Personnel</label>

        <input
          type="text"
          placeholder="Search by rank or name..."
          value={searchPerson}
          onChange={(e) => setSearchPerson(e.target.value)}
          className="
            bg-black
            border border-[#00ff4c]
            p-3
            w-full
            rounded-xl
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all
          "
        />

        {searchPerson && (
          <div className="
            mt-2
            border border-[#00ff4c]
            bg-black/60
            rounded-xl
            max-h-60 overflow-y-auto
          ">
            {filteredPersonnel.length === 0 ? (
              <p className="p-3 text-gray-400">No personnel found.</p>
            ) : (
              filteredPersonnel.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedPerson(p.id);
                    setSearchPerson("");
                  }}
                  className="
                    p-3
                    border-b border-[#00ff4c]/30
                    cursor-pointer
                    hover:bg-[#003d14]
                    hover:text-[#00ff4c]
                    transition
                  "
                >
                  {getRankName(p)} {p.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* CURRENT CERTS */}
      {selectedPerson && (
        <div className="
          mb-8
          border border-[#00ff4c]
          p-6
          bg-black/60
          rounded-2xl
          shadow-[0_0_40px_rgba(0,255,80,0.2)]
        ">
          <h2 className="text-2xl mb-6 text-[#00ff4c]">
            Current Certifications
          </h2>

          {personCerts.length === 0 ? (
            <p className="text-gray-400">
              No certifications assigned.
            </p>
          ) : (
            personCerts.map((pc) => (
              <div
                key={pc.id}
                className="flex justify-between items-center mb-3"
              >
                <span>{pc.certification?.name}</span>

                <button
                  onClick={() => revokeCertification(pc.id)}
                  className="
                    px-3 py-1
                    rounded-lg
                    bg-red-700
                    hover:bg-red-600
                    hover:scale-105
                    transition
                  "
                >
                  Revoke
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* ASSIGN CERT */}
      <div className="mb-6">
        <label className="block mb-2">
          Select Certification
        </label>

        <select
          className="
            bg-black
            border border-[#00ff4c]
            p-3
            w-full
            rounded-xl
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all
          "
          value={selectedCert}
          onChange={(e) => setSelectedCert(e.target.value)}
        >
          <option value="">-- Select Certification --</option>
          {certifications.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={assignCertification}
        disabled={loading}
        className="
          px-6 py-3
          border border-[#00ff4c]
          text-[#00ff4c]
          rounded-xl
          transition-all duration-300
          hover:bg-[#003d14]
          hover:text-black
          hover:scale-105
          hover:shadow-[0_0_25px_rgba(0,255,80,0.6)]
          disabled:opacity-50
        "
      >
        {loading ? "Assigning..." : "Assign Certification"}
      </button>

    </div>
  );
}