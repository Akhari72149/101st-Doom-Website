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
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [filteredCerts, setFilteredCerts] = useState<any[]>([]);
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
    if (!selectedPerson || selectedCerts.length === 0) return;

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const inserts = selectedCerts.map((certId) => ({
      personnel_id: selectedPerson,
      certification_id: certId,
      awarded_at: new Date().toISOString(),
      awarded_by: user?.id ?? null,
    }));

    const { error } = await supabase
      .from("personnel_certifications")
      .insert(inserts);

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        alert("⚠ One or more certifications already assigned.");
      } else {
        alert(error.message);
      }
      return;
    }

    setSelectedCerts([]);
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

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-8 px-5 py-2 rounded-xl border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/10 transition"
      >
        ← Back
      </button>

      <div className="max-w-6xl mx-auto p-8 rounded-3xl border border-[#00ff66]/20 bg-black/60 backdrop-blur-xl">

        <h1 className="text-3xl font-bold mb-10 text-[#00ff66]">
          Certification Management
        </h1>

        {/* SEARCH PERSONNEL */}
        <div className="mb-8">
          <input
            type="text"
            placeholder="Search by rank or name..."
            value={searchPerson}
            onChange={(e) => setSearchPerson(e.target.value)}
            className="bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl"
          />

          {searchPerson && (
            <div className="mt-3 border border-[#00ff66]/30 bg-black rounded-xl max-h-60 overflow-y-auto">
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
                    className="p-4 border-b border-[#00ff66]/10 cursor-pointer hover:bg-[#00ff66]/10"
                  >
                    {getRankName(p)} {p.name}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* SELECTED PERSON DISPLAY */}
        {selectedPerson && (
          <div className="mb-6 p-4 rounded-xl border border-[#00ff66]/30 bg-black/40">
            <h2 className="text-sm text-gray-400 mb-2">
              Selected Personnel
            </h2>

            {(() => {
              const person = personnel.find(
                (p) => p.id === selectedPerson
              );
              if (!person) return null;

              return (
                <div className="text-[#00ff66] font-semibold text-lg">
                  {getRankName(person)} {person.name}
                </div>
              );
            })()}
          </div>
        )}

        {/* CURRENT CERTIFICATIONS */}
        {selectedPerson && (
          <div className="mb-10 p-6 rounded-2xl border border-[#00ff66]/20 bg-black/50">
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
                  <span>{pc.certification?.name}</span>

                  <button
                    onClick={() => revokeCertification(pc.id)}
                    className="px-4 py-1 rounded-lg border border-red-600 text-red-500 hover:bg-red-600 hover:text-black"
                  >
                    Revoke
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* ASSIGN CERTIFICATIONS (HIDDEN UNTIL PERSON SELECTED) */}
        {selectedPerson && (
          <div className="mb-10 p-6 rounded-2xl border border-[#00ff66]/30 bg-black/60 shadow-[0_0_40px_rgba(0,255,100,0.1)]">
            <h2 className="text-xl mb-4 text-[#00ff66] font-semibold">
              Assign Certifications (Can select multiple)
            </h2>

            {/* CERT SEARCH */}
            <input
              type="text"
              placeholder="Search certifications..."
              className="mb-4 bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl"
              onChange={(e) => {
                const search = e.target.value.toLowerCase();
                const filtered = certifications.filter(
                  (c) =>
                    c.name.toLowerCase().includes(search) &&
                    !personCerts.some(
                      (pc) => pc.certification?.id === c.id
                    )
                );
                setFilteredCerts(filtered);
              }}
            />

            {/* AVAILABLE CERTS */}
            <div className="max-h-60 overflow-y-auto border border-[#00ff66]/20 rounded-xl p-3 mb-4 bg-black/40">
              {(filteredCerts.length ? filteredCerts : certifications)
                .filter(
                  (c) =>
                    !personCerts.some(
                      (pc) => pc.certification?.id === c.id
                    )
                )
                .map((c) => {
                  const isSelected = selectedCerts.includes(c.id);

                  return (
                    <div
                      key={c.id}
                      onClick={() =>
                        setSelectedCerts((prev) =>
                          prev.includes(c.id)
                            ? prev.filter((id) => id !== c.id)
                            : [...prev, c.id]
                        )
                      }
                      className={`p-3 rounded-lg cursor-pointer mb-2 transition ${
                        isSelected
                          ? "bg-[#00ff66]/20 border border-[#00ff66]"
                          : "hover:bg-[#00ff66]/10"
                      }`}
                    >
                      {c.name}
                    </div>
                  );
                })}
            </div>

            {/* SELECTED CHIPS */}
            {selectedCerts.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedCerts.map((certId) => {
                  const cert = certifications.find(
                    (c) => c.id === certId
                  );
                  if (!cert) return null;

                  return (
                    <div
                      key={certId}
                      className="px-3 py-1 rounded-full bg-[#00ff66]/20 border border-[#00ff66] text-sm flex items-center gap-2"
                    >
                      {cert.name}
                      <span
                        className="cursor-pointer text-red-400"
                        onClick={() =>
                          setSelectedCerts((prev) =>
                            prev.filter((id) => id !== certId)
                          )
                        }
                      >
                        ✕
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              onClick={assignCertification}
              disabled={loading || selectedCerts.length === 0}
              className="px-6 py-3 rounded-xl border border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/10 disabled:opacity-50 transition"
            >
              {loading
                ? "Assigning..."
                : selectedCerts.length > 1
                ? `Assign ${selectedCerts.length} Certifications`
                : "Assign Certification"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}