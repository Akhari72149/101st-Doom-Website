"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { useRouter } from "next/navigation";
import { BadgeCheck, X } from "lucide-react";
import { getCertificationFamilyName } from "@/lib/certification-families";

type Personnel = {
  id: string;
  name: string;
  rank_id: string | null;
  status?: string | null;
  slotted_position?: string | null;
};

type Rank = { id: string; name: string; rank_level?: number | null };

type Certification = {
  id: string;
  name: string;
  is_trainer_cert?: boolean;
  lead_personnel_id?: string | null;
  lead_name?: string | null;
  lead_rank_id?: string | null;
};

type PersonnelCertification = {
  id: string;
  personnel_id: string;
  certification?: Certification | null;
};

type CertificationsResponse = {
  personnel?: Personnel[];
  ranks?: Rank[];
  certifications?: Certification[];
  trainers?: Personnel[];
  currentUserId?: string;
};

type CertificationLeadFamily = {
  name: string;
  certificationIds: string[];
  lead_personnel_id: string | null;
  lead_name: string | null;
  mixedLeads: boolean;
};

export default function ManageCertifications() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [canEdit, setCanEdit] = useState(false);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [personCerts, setPersonCerts] = useState<PersonnelCertification[]>([]);
  const [selectedPeople, setSelectedPeople] = useState<string[]>([]);
  const [searchPerson, setSearchPerson] = useState("");
  const [selectedCerts, setSelectedCerts] = useState<string[]>([]);
  const [filteredCerts, setFilteredCerts] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(false);
  const [trainerPersonnel, setTrainerPersonnel] = useState<Personnel[]>([]);
  const [selectedTrainer, setSelectedTrainer] = useState("");
  const [trainerSearch, setTrainerSearch] = useState("");
  const [processedByName, setProcessedByName] = useState("Unknown");
  const [leadCertificationSearch, setLeadCertificationSearch] = useState("");
  const [leadPersonnelSearch, setLeadPersonnelSearch] = useState("");
  const [editingLeadFamilyName, setEditingLeadFamilyName] = useState<string | null>(null);
  const [savingLeadFamilyName, setSavingLeadFamilyName] = useState<string | null>(null);
  const [leadMessage, setLeadMessage] = useState("");
  const [leadModalOpen, setLeadModalOpen] = useState(false);

  const fetchData = useCallback(async () => {
    const response = await fetch("/api/admin/certifications", {
      cache: "no-store",
      headers: await getAppAuthHeaders(),
    });
    if (!response.ok) return null;
    return (await response.json()) as CertificationsResponse;
  }, []);

  const fetchPersonCerts = useCallback(async (personId: string) => {
    const response = await fetch(
      `/api/admin/certifications?personId=${encodeURIComponent(personId)}`,
      { cache: "no-store", headers: await getAppAuthHeaders() },
    );
    const data = (await response.json().catch(() => null)) as {
      personCerts?: PersonnelCertification[];
    } | null;
    return response.ok ? data?.personCerts || [] : [];
  }, []);

  const refreshPersonCerts = useCallback(async (personId: string) => {
    setPersonCerts(await fetchPersonCerts(personId));
  }, [fetchPersonCerts]);

  /* ================= AUTH ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      const hasAccess = hasAppPermission(session,"admin.certifications","read");

      if (!hasAccess) {
        router.replace("/");
        return;
      }
      setCanEdit(hasAppPermission(session, "admin.certifications", "edit"));

      setProcessedByName(session.user.displayName || session.user.email || "Unknown");
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    if (loadingAuth) return;
    let cancelled = false;
    void fetchData().then((data) => {
      if (cancelled || !data) return;
      setPersonnel(data.personnel || []);
      setRanks(data.ranks || []);
      setCertifications(data.certifications || []);
      setTrainerPersonnel(data.trainers || []);
      if ((data.trainers || []).some((trainer) => trainer.id === data.currentUserId)) {
        setSelectedTrainer(data.currentUserId || "");
      } else if ((data.trainers || []).length === 1) {
        setSelectedTrainer(data.trainers?.[0].id || "");
      }
    });
    return () => { cancelled = true; };
  }, [fetchData, loadingAuth]);

  useEffect(() => {
    let cancelled = false;
    if (selectedPeople.length === 1) {
      void fetchPersonCerts(selectedPeople[0]).then((records) => {
        if (!cancelled) setPersonCerts(records);
      });
    } else {
      void Promise.resolve().then(() => {
        if (!cancelled) setPersonCerts([]);
      });
    }
    return () => { cancelled = true; };
  }, [fetchPersonCerts, selectedPeople]);

  useEffect(() => {
    if (!leadModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLeadModalOpen(false);
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [leadModalOpen]);

  const broadcastWebsiteAction = async (payload: Record<string, unknown>) => {
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

  const assignCertification = async () => {
    if (!canEdit) return;
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
    if (!canEdit) return;
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
      refreshPersonCerts(selectedPeople[0]);
    }
  };

  const assignCertificationLead = async (family: CertificationLeadFamily, leadPersonnelId: string) => {
    if (!canEdit) return;
    setSavingLeadFamilyName(family.name);
    setLeadMessage("");
    const response = await fetch("/api/admin/certifications", {
      method: "PATCH",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        ...(await getAppAuthHeaders()),
      },
      body: JSON.stringify({ certificationIds: family.certificationIds, leadPersonnelId }),
    });
    const body = await response.json().catch(() => null);
    setSavingLeadFamilyName(null);
    if (!response.ok) {
      setLeadMessage(body?.error || "Failed to update certification lead.");
      return;
    }
    setCertifications((current) => current.map((certification) =>
      family.certificationIds.includes(certification.id)
        ? {
            ...certification,
            lead_personnel_id: leadPersonnelId,
            lead_name: body?.leadName || "Unknown",
            lead_rank_id: personnel.find((person) => person.id === leadPersonnelId)?.rank_id || null,
          }
        : certification
    ));
    setEditingLeadFamilyName(null);
    setLeadPersonnelSearch("");
    setLeadMessage("Certification lead updated.");
    if (selectedPeople.length === 1) refreshPersonCerts(selectedPeople[0]);
  };

  const getRankName = (person: Personnel) => {
    const rank = ranks.find((r) => r.id === person.rank_id);
    return rank ? rank.name : "Unranked";
  };

  const closeLeadModal = () => {
    setLeadModalOpen(false);
    setEditingLeadFamilyName(null);
    setLeadCertificationSearch("");
    setLeadPersonnelSearch("");
    setLeadMessage("");
  };

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p)} ${p.name}`
      .toLowerCase()
      .includes(searchPerson.toLowerCase())
  );
  const activeLeadPersonnel = personnel.filter((person) => {
    const status = String(person.status || "").trim().toLowerCase();
    return !["removed", "retired", "transferred"].includes(status);
  });
  const certificationLeadFamilies = useMemo(() => {
    const groups = new Map<string, Certification[]>();
    for (const certification of certifications) {
      const familyName = getCertificationFamilyName(certification.name);
      groups.set(familyName, [...(groups.get(familyName) || []), certification]);
    }
    return [...groups.entries()].map(([name, members]): CertificationLeadFamily => {
      const leadIds = new Set(members.map((member) => member.lead_personnel_id || null));
      const mixedLeads = leadIds.size > 1;
      const leadPersonnelId = mixedLeads ? null : members[0]?.lead_personnel_id || null;
      const lead = personnel.find((person) => person.id === leadPersonnelId);
      return {
        name,
        certificationIds: members.map((member) => member.id),
        lead_personnel_id: leadPersonnelId,
        lead_name: mixedLeads ? null : lead?.name || members[0]?.lead_name || null,
        mixedLeads,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [certifications, personnel]);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Checking Permissions...
      </div>
    );
  }

  const visibleLeadCertifications = certificationLeadFamilies.filter((family) =>
    family.name.toLowerCase().includes(leadCertificationSearch.trim().toLowerCase())
  );
  const visibleLeadPersonnel = activeLeadPersonnel.filter((person) =>
    `${getRankName(person)} ${person.name}`
      .toLowerCase()
      .includes(leadPersonnelSearch.trim().toLowerCase())
  );

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">
      <button
        onClick={() => router.push("/")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-7xl mx-auto p-8 rounded-3xl border border-[#00ff66]/20 bg-black/60 backdrop-blur-xl">
        <h1 className="text-3xl font-bold mb-10 text-[#00ff66]">
          Certification Management
        </h1>

        <div className="mb-10 flex flex-col gap-4 border border-[#00ff66]/25 bg-black/45 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00ff66]">
              Certification Leadership
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Review and assign the lead responsible for each certification.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setLeadModalOpen(true)}
            className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-4 py-2 font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/20"
          >
            <BadgeCheck aria-hidden="true" className="h-5 w-5" />
            Manage Certification Leads
          </button>
        </div>

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
                          {pc.certification?.lead_personnel_id === selectedPeople[0] && (
                            <span className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-cyan-300">
                              Certification Lead
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => revokeCertification(pc.id)}
                          disabled={!canEdit}
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
                  disabled={!canEdit || loading || selectedCerts.length === 0}
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

      {leadModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="certification-leads-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeLeadModal();
          }}
        >
          <section className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden border border-[#00ff66]/35 bg-[#001108] shadow-[0_0_60px_rgba(0,255,102,0.12)] sm:max-h-[calc(100dvh-3rem)]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#00ff66]/20 p-4 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00ff66]">
                  Certification Leadership
                </p>
                <h2 id="certification-leads-title" className="mt-2 text-xl font-semibold text-white sm:text-2xl">
                  Manage Certification Leads
                </h2>
                <p className="mt-1 text-sm text-gray-400">
                  Assign one active lead to each certification. Changes are recorded in the audit log.
                </p>
              </div>
              <button
                type="button"
                onClick={closeLeadModal}
                aria-label="Close certification leads"
                className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 text-gray-300 transition hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </header>

            <div className="shrink-0 border-b border-[#00ff66]/15 p-4 sm:p-5">
              <input
                type="search"
                value={leadCertificationSearch}
                onChange={(event) => setLeadCertificationSearch(event.target.value)}
                placeholder="Search certifications"
                className="w-full border border-[#00ff66]/30 bg-black px-3 py-3 text-sm text-white outline-none focus:border-[#00ff66]"
              />
              {leadMessage && (
                <div className={`mt-3 border px-4 py-3 text-sm ${
                  leadMessage === "Certification lead updated."
                    ? "border-[#00ff66]/25 bg-[#00ff66]/10 text-[#72ffab]"
                    : "border-red-500/25 bg-red-500/10 text-red-300"
                }`}>
                  {leadMessage}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 divide-y divide-[#00ff66]/10 overflow-y-auto overscroll-contain">
              {visibleLeadCertifications.length === 0 ? (
                <p className="p-8 text-center text-sm text-gray-400">No certifications found.</p>
              ) : visibleLeadCertifications.map((family) => {
                const isEditing = editingLeadFamilyName === family.name;
                const lead = personnel.find((person) => person.id === family.lead_personnel_id);
                return (
                  <div key={family.name} className="p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-white">{family.name}</p>
                        <p className={`mt-1 text-sm ${family.lead_name ? "text-[#72ffab]" : "text-amber-300"}`}>
                          {family.mixedLeads
                            ? "Multiple leads assigned across this family"
                            : family.lead_name
                              ? `Lead: ${lead ? `${getRankName(lead)} ` : ""}${family.lead_name}`
                              : "Lead unassigned"}
                        </p>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingLeadFamilyName(isEditing ? null : family.name);
                            setLeadPersonnelSearch("");
                            setLeadMessage("");
                          }}
                          className="min-h-10 shrink-0 border border-[#00ff66]/35 px-3 py-2 text-sm font-semibold text-[#00ff66] transition hover:bg-[#00ff66]/10"
                        >
                          {isEditing ? "Cancel" : family.lead_name || family.mixedLeads ? "Change Lead" : "Assign Lead"}
                        </button>
                      )}
                    </div>

                    {isEditing && (
                      <div className="mt-4 border border-[#00ff66]/20 bg-black/70 p-3">
                        <input
                          type="search"
                          autoFocus
                          value={leadPersonnelSearch}
                          onChange={(event) => setLeadPersonnelSearch(event.target.value)}
                          placeholder="Search active personnel by rank or name"
                          className="w-full border border-[#00ff66]/30 bg-black px-3 py-3 text-sm text-white outline-none focus:border-[#00ff66]"
                        />
                        <div className="mt-2 max-h-52 divide-y divide-white/5 overflow-y-auto border border-white/10">
                          {visibleLeadPersonnel.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-gray-400">No active personnel found.</p>
                          ) : visibleLeadPersonnel.map((person) => (
                            <button
                              key={person.id}
                              type="button"
                              disabled={savingLeadFamilyName === family.name}
                              onClick={() => assignCertificationLead(family, person.id)}
                              className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm text-gray-200 transition hover:bg-[#00ff66]/10 hover:text-white disabled:opacity-50"
                            >
                              <span>{getRankName(person)} {person.name}</span>
                              {person.id === family.lead_personnel_id && (
                                <span className="text-xs font-semibold uppercase text-[#00ff66]">Current</span>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <footer className="shrink-0 border-t border-[#00ff66]/20 bg-black/40 p-4 text-right">
              <button
                type="button"
                onClick={closeLeadModal}
                className="min-h-11 border border-white/20 px-5 py-2 text-sm font-semibold text-gray-200 transition hover:border-[#00ff66]/40 hover:text-white"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
