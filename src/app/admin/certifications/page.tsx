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

  /* ================= AUTH ================= */

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
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Checking Permissions...
      </div>
    );
  }

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(searchPerson.toLowerCase())
  );

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-8 px-5 py-2 rounded-xl border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/10 transition shadow-[0_0_15px_rgba(0,255,100,0.2)]"
      >
        ← Back
      </button>

      <div className="max-w-6xl mx-auto p-8 rounded-3xl border border-[#00ff66]/20 bg-black/60 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,100,0.15)]">

        <h1 className="text-3xl font-bold mb-10 text-[#00ff66] tracking-wide">
          Certification Management
        </h1>

        {/* SEARCH */}
        <div className="mb-8">
          <label className="block mb-2 text-sm text-gray-400">
            Search Personnel
          </label>

          <input
            type="text"
            placeholder="Search by rank or name..."
            value={searchPerson}
            onChange={(e) => setSearchPerson(e.target.value)}
            className="bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66] transition"
          />

          {searchPerson && (
            <div className="mt-3 border border-[#00ff66]/30 bg-black/80 rounded-xl max-h-60 overflow-y-auto shadow-lg">
              {filteredPersonnel.length === 0 ? (
                <p className="p-4 text-gray-400">No personnel found.</p>
              ) : (
                filteredPersonnel.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => {
                      setSelectedPerson(p.id);
                      setSearchPerson("");
                    }}
                    className="p-4 border-b border-[#00ff66]/10 cursor-pointer hover:bg-[#00ff66]/10 hover:text-[#00ff66] transition"
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
          <div className="mb-10 p-6 rounded-2xl border border-[#00ff66]/20 bg-black/50 shadow-[0_0_40px_rgba(0,255,100,0.1)]">
            <h2 className="text-xl mb-6 text-[#00ff66] font-semibold">
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
                  className="flex justify-between items-center mb-4"
                >
                  <span className="text-gray-200">
                    {pc.certification?.name}
                  </span>

                  <button
                    onClick={() => revokeCertification(pc.id)}
                    className="px-4 py-1 rounded-lg border border-red-600 text-red-500 hover:bg-red-600 hover:text-black transition"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ASSIGN */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-400">
            Select Certification
          </label>

          <select
            className="bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl focus:border-[#00ff66] transition"
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
          className="px-6 py-3 rounded-xl border border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10 hover:shadow-[0_0_25px_rgba(0,255,100,0.5)] transition disabled:opacity-50"
        >
          {loading ? "Assigning..." : "Assign Certification"}
        </button>

      </div>
    </div>
  );
}