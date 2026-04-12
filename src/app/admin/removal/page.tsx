"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { hasRole } from "@/lib/permissions";

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
  const [statusAction, setStatusAction] = useState<"Retired" | "Removed">("Removed");
  const [reason, setReason] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);

  const searchRef = useRef<HTMLDivElement | null>(null);

  const PROCESSOR_CERT_IDS = [
    "079827bf-8b8f-4f37-9b6c-664942689a0a",
    "c579ef59-7010-4bcc-bcd4-9cd448ac5bf5",
    "8eff73b9-9793-452a-b77d-c16cde5b9b4c",
  ];

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

      if (!hasRole(roleList, ["nco", "admin"])) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  useEffect(() => {
    const loadProcessors = async () => {
      const { data: certPersonnel, error: certError } = await supabase
        .from("personnel_certifications")
        .select("personnel_id")
        .in("certification_id", PROCESSOR_CERT_IDS);

      if (certError) {
        console.error("Failed to load processor certifications:", certError);
        return;
      }

      if (!certPersonnel || certPersonnel.length === 0) {
        setProcessors([]);
        return;
      }

      const personnelIds = [...new Set(certPersonnel.map((c) => c.personnel_id))];

      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("id, name, status")
        .in("id", personnelIds)
        .order("name", { ascending: true });

      if (personnelError) {
        console.error("Failed to load processors:", personnelError);
        return;
      }

      const filteredProcessors = (personnelData || []).filter((person) => {
        const status = (person.status || "").trim().toLowerCase();
        return status !== "removed" && status !== "retired";
      });

      setProcessors(filteredProcessors);
    };

    loadProcessors();
  }, []);

  useEffect(() => {
    const loadPersonnel = async () => {
      setLoadingPersonnel(true);

      const { data, error } = await supabase
        .from("personnel")
        .select("id, name, birth_number, status")
        .order("name", { ascending: true });

      if (error) {
        console.error("Failed to load personnel:", error);
        alert("Failed to load personnel: " + error.message);
        setLoadingPersonnel(false);
        return;
      }

      const activePersonnel = (data || []).filter((person) => {
        const status = (person.status || "").trim().toLowerCase();
        return status !== "removed" && status !== "retired";
      });

      setPersonnel(activePersonnel);
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

    const confirmText = `Are you sure you want to mark ${
      selectedPersonnel?.name || "this person"
    } as ${statusAction}?`;

    if (!window.confirm(confirmText)) {
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      alert("You are no longer logged in.");
      setSubmitting(false);
      return;
    }

    const { data: processorExists } = await supabase
      .from("personnel")
      .select("id")
      .eq("id", selectedProcessor)
      .maybeSingle();

    if (!processorExists) {
      alert("Selected processor does not exist.");
      setSubmitting(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("personnel")
      .update({
        status: statusAction,
        slotted_position: null,
      })
      .eq("id", selectedPersonnelId);

    if (updateError) {
      alert(updateError.message);
      setSubmitting(false);
      return;
    }

    const auditAction =
      statusAction === "Retired" ? "PERSONNEL_RETIRED" : "PERSONNEL_REMOVED";

    const auditDetails =
      reason.trim().length > 0
        ? `${statusAction} from active personnel. Reason: ${reason.trim()}`
        : `${statusAction} from active personnel.`;

    const { error: auditError } = await supabase.from("audit_logs").insert([
      {
        user_id: user.id,
        target_personnel_id: selectedPersonnelId,
        action: auditAction,
        details: auditDetails,
        processed_by: selectedProcessor,
      },
    ]);

    if (auditError) {
      console.error("Audit Insert Error:", auditError);
      alert("Status updated, but audit log failed: " + auditError.message);
      setSubmitting(false);
      return;
    }

    alert(`✅ Personnel marked as ${statusAction}`);

    setPersonnel((prev) => prev.filter((p) => p.id !== selectedPersonnelId));
    setSelectedPersonnelId("");
    setSearch("");
    setReason("");
    setSubmitting(false);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#eafff2] p-10">
      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <div className="max-w-3xl mx-auto p-10 rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30">
        <h1 className="text-3xl font-bold text-[#00ff66] mb-8 tracking-widest">
          Remove / Retire Personnel
        </h1>

        <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
          Personnel Selection
        </h2>

        <div className="mb-6 relative" ref={searchRef}>
          <label className="block mb-2 text-sm text-gray-300">
            Search by Name or Birth Number
          </label>

          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedPersonnelId("");
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Start typing a name or number..."
              className="w-full p-4 pr-24 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] placeholder:text-[#00ff66]/35 focus:outline-none focus:border-[#00ff66] focus:shadow-[0_0_12px_#00ff66]"
            />

            {search && (
              <button
                type="button"
                onClick={clearSelectedPersonnel}
                className="absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1 text-xs rounded-lg border border-red-500/50 text-red-300 hover:bg-red-500 hover:text-black transition"
              >
                Clear
              </button>
            )}
          </div>

          {searchOpen && (
            <div className="absolute z-50 mt-2 w-full rounded-2xl border border-[#00ff66]/30 bg-[#03150d] shadow-[0_0_20px_rgba(0,255,102,0.15)] backdrop-blur-xl max-h-72 overflow-y-auto">
              {loadingPersonnel ? (
                <div className="p-4 text-sm text-[#00ff66]/70">Loading personnel...</div>
              ) : filteredPersonnel.length > 0 ? (
                filteredPersonnel.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => handleSelectPersonnel(person)}
                    className="w-full text-left px-4 py-3 border-b border-[#00ff66]/10 last:border-b-0 hover:bg-[#00ff66]/10 transition"
                  >
                    <div className="text-[#eafff2] font-medium">
                      {person.name || "Unknown"}
                    </div>
                    <div className="text-xs text-[#00ff66]/60">
                      Birth Number: {person.birth_number || "N/A"}
                    </div>
                  </button>
                ))
              ) : (
                <div className="p-4 text-sm text-red-300">No matching personnel found.</div>
              )}
            </div>
          )}
        </div>

        {selectedPersonnel && (
          <div className="mb-6 rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
            <p className="text-sm text-[#00ff66]/80 mb-1">Selected Record</p>
            <p className="text-lg font-semibold text-white">
              {selectedPersonnel.name || "Unknown"}
            </p>
            <p className="text-sm text-gray-300">
              Birth Number: {selectedPersonnel.birth_number || "N/A"}
            </p>
            <p className="text-sm text-gray-300">
              Current Status: {selectedPersonnel.status || "Active"}
            </p>
          </div>
        )}

        <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
          Action Details
        </h2>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Update Status To
          </label>
          <select
            value={statusAction}
            onChange={(e) => setStatusAction(e.target.value as "Retired" | "Removed")}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          >
            <option value="Removed">Removed</option>
            <option value="Retired">Retired</option>
          </select>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Reason / Notes (Optional)
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66] resize-none"
            placeholder="Optional reason for audit log..."
          />
        </div>

        <div className="mb-8">
          <label className="block mb-2 text-sm text-gray-300">
            Who Processed This Action?
          </label>

          <p className="text-xs text-[#00ff66]/60 mb-2">
            Required for audit tracking
          </p>

          <select
            value={selectedProcessor}
            onChange={(e) => setSelectedProcessor(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          >
            <option value="">-- Select Processor --</option>
            {processors.map((processor) => (
              <option key={processor.id} value={processor.id}>
                {processor.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleStatusUpdate}
          disabled={!selectedPersonnelId || !selectedProcessor || submitting}
          className={`w-full py-4 rounded-xl font-bold transition-all duration-200
            ${
              !selectedPersonnelId || !selectedProcessor || submitting
                ? "bg-gray-700 border border-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-red-500/10 border border-red-400 text-red-300 hover:bg-red-500 hover:text-black hover:shadow-[0_0_25px_#ef4444]"
            }`}
        >
          {submitting ? "Processing..." : `Mark as ${statusAction}`}
        </button>
      </div>
    </div>
  );
}