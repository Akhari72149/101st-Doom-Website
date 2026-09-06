"use client";

import { useEffect, useState } from "react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { useRouter } from "next/navigation";

export default function ManageCertifications() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [personCerts, setPersonCerts] = useState<any[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [searchPerson, setSearchPerson] = useState("");
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [filteredCerts, setFilteredCerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trainerPersonnel, setTrainerPersonnel] = useState<any[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [trainerSearch, setTrainerSearch] = useState("");
  const [processedByName, setProcessedByName] = useState("Unknown");

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const roleList = session.roles.map((role) => role.toLowerCase());
      const allowedRoles = ["admin", "trainer"];

      const hasAccess = roleList.some((role) => allowedRoles.includes(role)) || hasAppPermission(session,"admin.certifications","read");

      if (!hasAccess) {
        router.replace("/");
        return;
      }

      setProcessedByName(session.user.displayName || session.user.email || "Unknown");
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (!loadingAuth) fetchData();
  }, [loadingAuth]);

  useEffect(() => {
    if (selectedPeople.length === 1) {
      fetchPersonCerts(selectedPeople[0]);
    } else {
      setPersonCerts([]);
    }
  }, [selectedPeople]);

  const broadcastWebsiteAction = async (payload: any) => {
    try {
      await fetch("/api/website-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAppAuthHeaders()),
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("Failed to broadcast website action:", error);
    }
  };

  const fetchData = async () => {
    const response=await fetch("/api/admin/certifications",{cache:"no-store",headers:await getAppAuthHeaders()});
    if(!response.ok)return;const data=await response.json();
    setPersonnel(data.personnel||[]);setRanks(data.ranks||[]);setCertifications(data.certifications||[]);setTrainerPersonnel(data.trainers||[]);
    if((data.trainers||[]).some((t:any)=>t.id===data.currentUserId))setSelectedTrainer(data.currentUserId);else if((data.trainers||[]).length===1)setSelectedTrainer(data.trainers[0].id);
  };

  const fetchPersonCerts = async (personId: string) => {
    const response=await fetch(`/api/admin/certifications?personId=${encodeURIComponent(personId)}`,{cache:"no-store",headers:await getAppAuthHeaders()});
    const data=await response.json().catch(()=>null);setPersonCerts(response.ok?data?.personCerts||[]:[]);
  };

  const assignCertification = async () => {
    if (
      selectedPeople.length === 0 ||
      selectedCerts.length === 0 ||
      !selectedTrainer
    ) {
      alert("Please select personnel, certifications, and a trainer.");
      return;
    }

    setLoading(true);

    const response=await fetch("/api/admin/certifications",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({personnelIds:selectedPeople,certificationIds:selectedCerts,awardedBy:selectedTrainer})});

    setLoading(false);

    if (!response.ok) {
      const data=await response.json().catch(()=>null);alert(data?.error||"Failed to assign certifications");
      return;
    }

    for (const personId of selectedPeople) {
      for (const certId of selectedCerts) {
        const certification = certifications.find((c) => c.id === certId);

        await broadcastWebsiteAction({
          action: "CERTIFICATION_ASSIGNED",
          target_personnel_id: personId,
          processedBy: processedByName,
          certName: certification?.name || "Unknown Certification",
        });
      }
    }

    setSelectedCerts([]);
    setSelectedPeople([]);
    setFilteredCerts([]);
  };

  const revokeCertification = async (recordId: string) => {
    if (!confirm("Revoke this certification?")) return;

    const certRecord = personCerts.find((pc) => pc.id === recordId);
    const targetPersonnelId =
      certRecord?.personnel_id || selectedPeople[0] || null;
    const certName = certRecord?.certification?.name || "Unknown Certification";

    const response=await fetch(`/api/admin/certifications?id=${encodeURIComponent(recordId)}`,{method:"DELETE",credentials:"same-origin",headers:await getAppAuthHeaders()});
    if (!response.ok) {
      const data=await response.json().catch(()=>null);alert(data?.error||"Failed to revoke certification");
      return;
    }

    if (targetPersonnelId) {
      await broadcastWebsiteAction({
        action: "CERTIFICATION_REVOKED",
        target_personnel_id: targetPersonnelId,
        processedBy: processedByName,
        certName,
      });
    }

    if (selectedPeople.length === 1) {
      fetchPersonCerts(selectedPeople[0]);
    }
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
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-7xl mx-auto p-8 rounded-3xl border border-[#00ff66]/20 bg-black/60 backdrop-blur-xl">
        <h1 className="text-3xl font-bold mb-10 text-[#00ff66]">
          Certification Management
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* LEFT COLUMN */}
          <div>
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
                          setSelectedPeople((prev) =>
                            prev.includes(p.id)
                              ? prev.filter((id) => id !== p.id)
                              : [...prev, p.id]
                          );
                          setSearchPerson("");
                        }}
                        className={`p-4 border-b border-[#00ff66]/10 cursor-pointer transition ${
                          selectedPeople.includes(p.id)
                            ? "bg-[#00ff66]/20 border-l-4 border-[#00ff66]"
                            : "hover:bg-[#00ff66]/10"
                        }`}
                      >
                        {getRankName(p)} {p.name}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* SELECTED PERSON DISPLAY */}
            {selectedPeople.length > 0 && (
              <div className="mb-6 p-4 rounded-xl border border-[#00ff66]/30 bg-black/40">
                <h2 className="text-sm text-gray-400 mb-2">
                  Selected Personnel ({selectedPeople.length})
                </h2>

                <div className="flex flex-wrap gap-2">
                  {selectedPeople.map((personId) => {
                    const person = personnel.find((p) => p.id === personId);
                    if (!person) return null;

                    return (
                      <div
                        key={personId}
                        className="px-3 py-1 rounded-full bg-[#00ff66]/20 border border-[#00ff66] text-sm flex items-center gap-2"
                      >
                        {getRankName(person)} {person.name}

                        <span
                          className="cursor-pointer text-red-400"
                          onClick={() =>
                            setSelectedPeople((prev) =>
                              prev.filter((id) => id !== personId)
                            )
                          }
                        >
                          ✕
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TRAINER SELECTION - SHOW AFTER PERSON IS SELECTED */}
            {selectedPeople.length > 0 && (
              <div className="mb-6 p-4 rounded-xl border border-[#00ff66]/30 bg-black/30">
                <h2 className="text-sm text-gray-400 mb-2">
                  Select Trainer Who Is Assigning
                </h2>

                {trainerPersonnel.length === 0 ? (
                  <p className="text-gray-400 text-sm">
                    No trainers available.
                  </p>
                ) : (
                  <>
                    <input
                      type="text"
                      placeholder="Search trainers..."
                      value={trainerSearch}
                      onChange={(e) => setTrainerSearch(e.target.value)}
                      className="bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl mb-3"
                    />

                    <div className="max-h-160 overflow-y-auto">
                      {trainerPersonnel
                        .filter((trainer) =>
                          trainer.name
                            ?.toLowerCase()
                            .includes(trainerSearch.toLowerCase())
                        )
                        .map((trainer) => {
                          const isSelected = selectedTrainer === trainer.id;

                          return (
                            <div
                              key={trainer.id}
                              onClick={() => {
                                setSelectedTrainer(trainer.id);
                                setTrainerSearch("");
                              }}
                              className={`p-2 rounded-lg cursor-pointer mb-2 transition ${
                                isSelected
                                  ? "bg-[#00ff66]/20 border border-[#00ff66]"
                                  : "hover:bg-[#00ff66]/10"
                              }`}
                            >
                              {trainer.name}
                            </div>
                          );
                        })}

                      {trainerPersonnel.filter((trainer) =>
                        trainer.name
                          ?.toLowerCase()
                          .includes(trainerSearch.toLowerCase())
                      ).length === 0 && (
                        <p className="text-gray-400 text-sm">
                          No matching trainers.
                        </p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN */}
          <div>
            {/* CURRENT CERTIFICATIONS */}
            {selectedPeople.length === 1 && (
              <div className="mb-10 p-6 rounded-2xl border border-[#00ff66]/20 bg-black/50">
                <h2 className="text-xl mb-4 text-[#00ff66] font-semibold">
                  Current Certifications
                </h2>

                {personCerts.length === 0 ? (
                  <p className="text-gray-400">
                    No certifications assigned.
                  </p>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-[#00ff66]/20 rounded-xl p-3 bg-black/40">
                    {personCerts.map((pc) => (
                      <div
                        key={pc.id}
                        className="p-3 rounded-lg mb-2 border border-[#00ff66]/30 bg-[#00ff66]/10 flex justify-between items-center transition hover:bg-[#00ff66]/20"
                      >
                        <div className="flex flex-col">
                          <span className="font-medium text-white">
                            {pc.certification?.name}
                          </span>

                          <span className="text-xs text-[#00ff66]/70">
                            ✔ Certified
                          </span>
                        </div>

                        <button
                          onClick={() => revokeCertification(pc.id)}
                          className="px-3 py-1 rounded-lg border border-red-600 text-red-500 text-sm hover:bg-red-600 hover:text-black transition"
                        >
                          Revoke
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ASSIGN CERTIFICATIONS */}
            {selectedPeople.length > 0 && (
              <div className="mb-10 p-6 rounded-2xl border border-[#00ff66]/30 bg-black/60 shadow-[0_0_40px_rgba(0,255,100,0.1)]">
                <h2 className="text-xl mb-4 text-[#00ff66] font-semibold">
                  Assign Certifications (Can select multiple)
                </h2>

                <input
                  type="text"
                  placeholder="Search certifications..."
                  className="mb-4 bg-black border border-[#00ff66]/30 p-3 w-full rounded-xl"
                  onChange={(e) => {
                    const search = e.target.value.toLowerCase();

                    const filtered = certifications.filter((c) => {
                      const matchesSearch = c.name
                        .toLowerCase()
                        .includes(search);

                      if (!matchesSearch) return false;

                      if (selectedPeople.length === 1) {
                        return !personCerts.some(
                          (pc) => pc.certification?.id === c.id
                        );
                      }

                      return true;
                    });

                    setFilteredCerts(filtered);
                  }}
                />

                <div className="max-h-84 overflow-y-auto border border-[#00ff66]/20 rounded-xl p-3 mb-4 bg-black/40">
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

                {selectedCerts.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {selectedCerts.map((certId) => {
                      const cert = certifications.find((c) => c.id === certId);
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
      </div>
    </div>
  );
}
