"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import { Search, ShieldAlert, ShieldCheck, UserRound, Users } from "lucide-react";

type PersonnelRow = {
  id: string;
  name: string | null;
  birth_number: string | null;
  status: string | null;
};

type ProcessorRow = {
  id: string;
  name: string | null;
  status: string | null;
};


type StatusAction = "Retired" | "Removed" | "Transferred";

type ActionMeta = {
  title: string;
  subtitle: string;
  panelClass: string;
  badgeClass: string;
  buttonClass: string;
};

const TRANSFER_UNITS = [
  "212th Attack Battalion",
  "501st Legion",
  "91st Recon Company",
  "327th Star Corps",
  "38th Assault Corps",
];

export default function RemovePersonnelPage() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadingPersonnel, setLoadingPersonnel] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [personnel, setPersonnel] = useState<PersonnelRow[]>([]);
  const [processors, setProcessors] = useState<ProcessorRow[]>([]);

  const [search, setSearch] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState("");
  const [selectedProcessor, setSelectedProcessor] = useState("");
  const [statusAction, setStatusAction] = useState<StatusAction>("Removed");
  const [transferUnit, setTransferUnit] = useState("");
  const [reason, setReason] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkAccess = async () => {
      const session=await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      if (!session.roles.some(role=>["nco","admin"].includes(role.toLowerCase()))&&!hasAppPermission(session,"admin.removal","read")) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    const loadProcessors = async () => {
      const response=await fetch("/api/admin/personnel-operations?scope=removal",{cache:"no-store",headers:await getAppAuthHeaders()});if(!response.ok)return;const data=await response.json() as {processors?:ProcessorRow[]};setProcessors(data.processors||[]);
    };

    loadProcessors();
  }, []);

  useEffect(() => {
    const loadPersonnel = async () => {
      setLoadingPersonnel(true);

      const response=await fetch("/api/admin/personnel-operations?scope=removal",{cache:"no-store",headers:await getAppAuthHeaders()});
      if(!response.ok){
        alert("Failed to load personnel.");
        setLoadingPersonnel(false);
        return;
      }

      const data=await response.json() as {personnel?:PersonnelRow[]};setPersonnel(data.personnel||[]);
      setLoadingPersonnel(false);
    };

    if (!loadingAuth) {
      loadPersonnel();
    }
  }, [loadingAuth]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!searchRef.current) return;
      if (!searchRef.current.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredPersonnel = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return personnel.slice(0, 10);
    }

    return personnel
      .filter((person) => {
        const personName = (person.name || "").toLowerCase();
        const personBirthNumber = String(person.birth_number || "").toLowerCase();

        return personName.includes(term) || personBirthNumber.includes(term);
      })
      .slice(0, 10);
  }, [personnel, search]);

  const selectedPersonnel = useMemo(() => {
    return personnel.find((p) => p.id === selectedPersonnelId) || null;
  }, [personnel, selectedPersonnelId]);

  const actionMeta: ActionMeta = useMemo(() => {
    if (statusAction === "Retired") {
      return {
        title: "Retire Personnel",
        subtitle: "All Discord roles will be cleared, then the retired tag will be applied.",
        panelClass: "border-slate-500/30 bg-slate-500/10",
        badgeClass: "border-slate-400/30 bg-slate-400/10 text-slate-200",
        buttonClass:
          "bg-slate-500/10 border border-slate-400 text-slate-200 hover:bg-slate-400 hover:text-black hover:shadow-[0_0_25px_rgba(148,163,184,0.5)]",
      };
    }

    if (statusAction === "Transferred") {
      return {
        title: "Transfer Personnel",
        subtitle: "Personnel will be marked as transferred and the destination unit will be logged.",
        panelClass: "border-cyan-500/35 bg-cyan-500/10",
        badgeClass: "border-cyan-400/30 bg-cyan-400/10 text-cyan-200",
        buttonClass:
          "bg-cyan-500/10 border border-cyan-400 text-cyan-200 hover:bg-cyan-400 hover:text-black hover:shadow-[0_0_25px_rgba(34,211,238,0.6)]",
      };
    }

    return {
      title: "Remove Personnel",
      subtitle: "All Discord roles will be cleared, then the no roles tag will be applied.",
      panelClass: "border-red-500/35 bg-red-500/10",
      badgeClass: "border-red-400/30 bg-red-400/10 text-red-200",
      buttonClass:
        "bg-red-500/10 border border-red-400 text-red-300 hover:bg-red-500 hover:text-black hover:shadow-[0_0_25px_#ef4444]",
    };
  }, [statusAction]);

  const handleSelectPersonnel = (person: PersonnelRow) => {
    setSelectedPersonnelId(person.id);
    setSearch(
      `${person.name || "Unknown"}${person.birth_number ? ` - ${person.birth_number}` : ""}`
    );
    setSearchOpen(false);
  };

  const clearSelectedPersonnel = () => {
    setSelectedPersonnelId("");
    setSearch("");
    setSearchOpen(false);
  };

  const handleStatusUpdate = async () => {
    if (!selectedPersonnelId) {
      alert("Please select a person.");
      return;
    }

    if (!selectedProcessor) {
      alert("Please select who processed this action.");
      return;
    }

    if (statusAction === "Transferred" && !transferUnit) {
      alert("Please select the unit they are transferring to.");
      return;
    }

    const confirmText =
      statusAction === "Transferred"
        ? `Are you sure you want to mark ${
            selectedPersonnel?.name || "this person"
          } as Transferred to ${transferUnit}?`
        : `Are you sure you want to mark ${
            selectedPersonnel?.name || "this person"
          } as ${statusAction}?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setSubmitting(true);

    const response=await fetch("/api/admin/personnel-operations",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json",...(await getAppAuthHeaders())},body:JSON.stringify({scope:"removal",action:"status",personnelId:selectedPersonnelId,processorId:selectedProcessor,status:statusAction,transferUnit,reason})});
    if(!response.ok){const body=await response.json().catch(()=>null) as {error?:string}|null;alert(body?.error||"Failed to update personnel status");
      setSubmitting(false);
      return;
    }

    alert(
      statusAction === "Transferred"
        ? `✅ Personnel marked as Transferred to ${transferUnit}`
        : `✅ Personnel marked as ${statusAction}`
    );

    setPersonnel((prev) => prev.filter((p) => p.id !== selectedPersonnelId));
    setSelectedPersonnelId("");
    setSearch("");
    setReason("");
    setSelectedProcessor("");
    setTransferUnit("");
    setSubmitting(false);
  };

  const submitDisabled =
    !selectedPersonnelId ||
    !selectedProcessor ||
    submitting ||
    (statusAction === "Transferred" && !transferUnit);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] px-4 py-6 text-[#eafff2] sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1600px]">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 rounded-lg border border-[#00ff66]/50 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return to Dashboard
        </button>

        <div className="mb-8">
          <div className="text-xs uppercase tracking-[0.4em] text-[#7fa08e]">
            Personnel Command System
          </div>

          <h1 className="mt-3 bg-gradient-to-r from-[#00ff66] to-[#00ffaa] bg-clip-text text-4xl font-extrabold tracking-[0.22em] text-transparent drop-shadow-[0_0_10px_rgba(0,255,100,0.6)]">
            REMOVE / RETIRE / TRANSFER PERSONNEL
          </h1>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#8eaa9b]">
            Select an active personnel record, choose the status action, and process the
            status update alongside the audit entry.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 xl:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-3xl border border-[#00ff66]/30 bg-black/55 p-5 backdrop-blur-xl shadow-[0_0_40px_rgba(0,255,100,0.08)]">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                    Directory
                  </div>
                  <h2 className="mt-2 text-xl font-bold text-[#00ff66]">
                    Personnel Search
                  </h2>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 text-right">
                  <div className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
                    Active
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Users className="h-4 w-4 text-[#00ff66]" />
                    {personnel.length}
                  </div>
                </div>
              </div>

              <div ref={searchRef} className="relative mb-4">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#00ff66]/50" />
                <input
                  type="text"
                  placeholder="Search by name or birth number..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSelectedPersonnelId("");
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  className="w-full rounded-xl border border-[#00ff66]/40 bg-black/40 py-4 pl-12 pr-24 text-[#00ff66] placeholder:text-[#00ff66]/40 outline-none transition-all duration-300 focus:border-[#00ff66] focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]"
                />

                {search && (
                  <button
                    type="button"
                    onClick={clearSelectedPersonnel}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-300 transition hover:bg-red-500 hover:text-black"
                  >
                    Clear
                  </button>
                )}
              </div>

              <div className="max-h-[68vh] overflow-y-auto rounded-2xl border border-[#00ff66]/25 bg-black/60 backdrop-blur-lg shadow-[0_0_40px_rgba(0,255,100,0.08)]">
                {loadingPersonnel ? (
                  <p className="p-4 text-sm text-[#00ff66]/70">Loading personnel...</p>
                ) : filteredPersonnel.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">No personnel found.</p>
                ) : (
                  filteredPersonnel.map((person) => {
                    const isSelected = selectedPersonnel?.id === person.id;

                    return (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => handleSelectPersonnel(person)}
                        className={`w-full border-b px-4 py-4 text-left transition-all duration-200 last:border-b-0 ${
                          isSelected
                            ? "border-[#00ff66]/30 bg-[#00ff66]/12"
                            : "border-[#00ff66]/15 hover:bg-[#00ff66]/10"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-xs uppercase tracking-[0.16em] text-[#00ff66]">
                              Active Personnel
                            </div>
                            <div className="mt-1 truncate text-sm font-semibold text-white">
                              {person.name || "Unknown"}
                            </div>
                            <div className="mt-1 text-xs text-[#00ff66]/60">
                              Birth Number: {person.birth_number || "N/A"}
                            </div>
                          </div>

                          {isSelected && (
                            <div className="rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00ff66]">
                              Selected
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </aside>

          <section className="min-w-0">
            <div className="rounded-3xl border border-[#00ff66]/30 bg-black/55 p-6 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,255,100,0.12)] sm:p-8">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <div>
                  <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                    Action Console
                  </div>
                  <h2 className="mt-3 text-3xl font-bold text-[#00ff66]">
                    {actionMeta.title}
                  </h2>
                  <p className="mt-4 max-w-2xl text-sm leading-7 text-[#8eaa9b]">
                    Choose the target, enter the reason, and process the status update.
                  </p>

                  <div className={`mt-6 rounded-2xl border p-4 ${actionMeta.panelClass}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldAlert className="h-4 w-4" />
                      Action Summary
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[#d7e6dc]">
                      {actionMeta.subtitle}
                    </p>
                  </div>

                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        Selected Personnel
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-2xl font-bold text-white">
                        <UserRound className="h-5 w-5 text-[#00ff66]" />
                        {selectedPersonnel ? "1" : "0"}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/40 p-5">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                        Processors Available
                      </div>
                      <div className="mt-2 text-2xl font-bold text-white">
                        {processors.length}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-[#00ff66]/20 bg-black/40 p-5">
                  {selectedPersonnel ? (
                    <>
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-[0.25em] text-[#7fa08e]">
                            Selected Record
                          </div>
                          <h3 className="mt-2 text-2xl font-bold text-white">
                            {selectedPersonnel.name || "Unknown"}
                          </h3>
                        </div>

                        <button
                          onClick={clearSelectedPersonnel}
                          className="rounded-xl border border-red-500/50 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500 hover:text-black"
                        >
                          Clear
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                            Birth Number
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[#00ff66]">
                            {selectedPersonnel.birth_number || "N/A"}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
                          <div className="text-[11px] uppercase tracking-[0.18em] text-gray-500">
                            Current Status
                          </div>
                          <div className="mt-1 text-sm font-semibold text-white">
                            {selectedPersonnel.status || "Active"}
                          </div>
                        </div>

                        <div className={`rounded-2xl border p-4 ${actionMeta.panelClass}`}>
                          <div className="flex items-center gap-2 text-sm font-semibold">
                            <ShieldCheck className="h-4 w-4" />
                            Outcome
                          </div>
                          <p className="mt-2 text-sm leading-6 text-[#d7e6dc]">
                            {statusAction === "Removed"
                              ? "Personnel will be marked as removed."
                              : statusAction === "Retired"
                                ? "Personnel will be marked as retired."
                                : "Personnel will be marked as transferred and the selected unit will be logged."}
                          </p>

                          {statusAction === "Transferred" && transferUnit && (
                            <div className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-3 text-xs text-cyan-100">
                              Transfer Unit:{" "}
                              <span className="font-bold">{transferUnit}</span>
                            </div>
                          )}

                          <div className="mt-3">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${actionMeta.badgeClass}`}
                            >
                              {statusAction}
                            </span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="flex min-h-[290px] flex-col items-center justify-center rounded-3xl border border-dashed border-[#00ff66]/25 bg-black/20 p-8 text-center">
                      <div className="rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/10 p-4">
                        <UserRound className="h-7 w-7 text-[#00ff66]" />
                      </div>
                      <h3 className="mt-4 text-xl font-bold text-white">
                        No personnel selected
                      </h3>
                      <p className="mt-2 max-w-sm text-sm leading-6 text-[#8eaa9b]">
                        Pick a record from the search panel to begin.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Update Status To
                  </label>
                  <select
                    value={statusAction}
                    onChange={(e) => {
                      const nextAction = e.target.value as StatusAction;
                      setStatusAction(nextAction);

                      if (nextAction !== "Transferred") {
                        setTransferUnit("");
                      }
                    }}
                    className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 p-4 text-[#00ff66] outline-none transition focus:border-[#00ff66] focus:shadow-[0_0_12px_rgba(0,255,102,0.35)]"
                  >
                    <option value="Removed">Removed</option>
                    <option value="Retired">Retired</option>
                    <option value="Transferred">Transferred</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm text-gray-300">
                    Who Processed This Action?
                  </label>
                  <p className="mb-2 text-xs text-[#00ff66]/60">
                    Required for audit tracking
                  </p>
                  <select
                    value={selectedProcessor}
                    onChange={(e) => setSelectedProcessor(e.target.value)}
                    className="w-full rounded-xl border border-[#00ff66]/30 bg-black/60 p-4 text-[#00ff66] outline-none transition focus:border-[#00ff66] focus:shadow-[0_0_12px_rgba(0,255,102,0.35)]"
                  >
                    <option value="">-- Select Processor --</option>
                    {processors.map((processor) => (
                      <option key={processor.id} value={processor.id}>
                        {processor.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {statusAction === "Transferred" && (
                <div className="mt-6">
                  <label className="mb-2 block text-sm text-gray-300">
                    Transfer To Unit
                  </label>
                  <select
                    value={transferUnit}
                    onChange={(e) => setTransferUnit(e.target.value)}
                    className="w-full rounded-xl border border-cyan-400/30 bg-black/60 p-4 text-cyan-200 outline-none transition focus:border-cyan-300 focus:shadow-[0_0_12px_rgba(34,211,238,0.35)]"
                  >
                    <option value="">-- Select Unit --</option>
                    {TRANSFER_UNITS.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="mt-6">
                <label className="mb-2 block text-sm text-gray-300">
                  Reason / Notes (Optional)
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-[#00ff66]/30 bg-black/60 p-4 text-[#00ff66] outline-none transition placeholder:text-[#00ff66]/35 focus:border-[#00ff66] focus:shadow-[0_0_12px_rgba(0,255,102,0.35)]"
                  placeholder="Optional reason for audit log..."
                />
              </div>

              <div className="mt-8">
                <button
                  onClick={handleStatusUpdate}
                  disabled={submitDisabled}
                  className={`w-full rounded-xl py-4 font-bold transition-all duration-200 ${
                    submitDisabled
                      ? "cursor-not-allowed border border-gray-600 bg-gray-700 text-gray-400"
                      : actionMeta.buttonClass
                  }`}
                >
                  {submitting
                    ? "Processing..."
                    : statusAction === "Transferred"
                      ? "Mark as Transferred"
                      : `Mark as ${statusAction}`}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
