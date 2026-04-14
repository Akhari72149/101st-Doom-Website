"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { hasRole } from "@/lib/permissions";

type RankRow = {
  id: string;
  name: string;
  rank_level: number;
};

type ProcessorRow = {
  id: string;
  name: string | null;
  status: string | null;
};

type PersonnelDuplicateRow = {
  id: string;
  status: string | null;
};

type DuplicateState = "idle" | "checking" | "available" | "duplicate" | "error";

export default function CreatePersonnel() {
  const router = useRouter();

  const PROCESSOR_CERT_IDS = [
    "079827bf-8b8f-4f37-9b6c-664942689a0a",
    "c579ef59-7010-4bcc-bcd4-9cd448ac5bf5",
    "8eff73b9-9793-452a-b77d-c16cde5b9b4c",
  ];

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [ranks, setRanks] = useState<RankRow[]>([]);
  const [processors, setProcessors] = useState<ProcessorRow[]>([]);
  const [processorSearch, setProcessorSearch] = useState("");

  const [rankId, setRankId] = useState("");
  const [birthNumber, setBirthNumber] = useState("");
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [teamspeakId, setTeamspeakId] = useState("");
  const [importFromDiscord, setImportFromDiscord] = useState(false);
  const [createdAt, setCreatedAt] = useState("");
  const [selectedProcessor, setSelectedProcessor] = useState("");

  const [nameStatus, setNameStatus] = useState<DuplicateState>("idle");
  const [birthStatus, setBirthStatus] = useState<DuplicateState>("idle");
  const [discordError, setDiscordError] = useState("");

  const [nameError, setNameError] = useState("");
  const [birthError, setBirthError] = useState("");
  const [processorError, setProcessorError] = useState("");
  const [formError, setFormError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const isInactiveStatus = (status: string | null | undefined) => {
    const clean = (status || "").trim().toLowerCase();
    return clean === "removed" || clean === "retired";
  };

  const cleanNameValue = (value: string) =>
    value.replace(/\s+/g, " ").trim();

  const cleanBirthValue = (value: string) =>
    value.replace(/\s+/g, "").trim();

  const cleanDiscordValue = (value: string) => value.trim();

  const validateDiscordId = (value?: string) => {
  const clean = cleanDiscordValue(value ?? discordId);

  setDiscordError("");

  if (!clean) return true;

  if (!/^\d+$/.test(clean)) {
    setDiscordError("Discord ID must contain numbers only.");
    return false;
  }

  return true;
};

  const cleanTeamspeakValue = (value: string) =>
    value.trim();

  useEffect(() => {
    if (importFromDiscord) {
      setRankId("");
    }
  }, [importFromDiscord]);

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

      if (!hasRole(roleList, ["recruiter", "di", "nco"])) {
        router.replace("/");
        return;
      }

      const [{ data: rankData, error: rankError }, { data: certPersonnel, error: certError }] =
        await Promise.all([
          supabase.from("ranks").select("id, name, rank_level").order("rank_level", { ascending: true }),
          supabase
            .from("personnel_certifications")
            .select("personnel_id")
            .in("certification_id", PROCESSOR_CERT_IDS),
        ]);

      if (rankError) {
        console.error("Failed to load ranks:", rankError);
        setRanks([]);
      } else {
        setRanks(rankData || []);
      }

      if (certError) {
        console.error("Failed to load processor certifications:", certError);
        setProcessors([]);
        setLoadingAuth(false);
        return;
      }

      if (!certPersonnel || certPersonnel.length === 0) {
        setProcessors([]);
        setLoadingAuth(false);
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
        setProcessors([]);
      } else {
        const activeProcessors = (personnelData || []).filter((person) => {
          const status = (person.status || "").trim().toLowerCase();
          return status !== "removed" && status !== "retired";
        });

        setProcessors(activeProcessors);
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const selectedRank = useMemo(
    () => ranks.find((rank) => rank.id === rankId),
    [ranks, rankId]
  );

  const filteredProcessors = useMemo(() => {
    const query = processorSearch.trim().toLowerCase();

    if (!query) return processors;

    return processors.filter((processor) =>
      (processor.name || "").toLowerCase().includes(query)
    );
  }, [processors, processorSearch]);

  const selectedProcessorName = useMemo(() => {
    return processors.find((p) => p.id === selectedProcessor)?.name || "";
  }, [processors, selectedProcessor]);

  const createdAtLabel = useMemo(() => {
    if (!createdAt) return "Default";
    return "Custom";
  }, [createdAt]);

  const roleSyncLabel = useMemo(() => {
    return importFromDiscord ? "Disabled (Discord Import)" : "Enabled";
  }, [importFromDiscord]);

  const rankSourceLabel = useMemo(() => {
    return importFromDiscord ? "Discord Import" : "Manual";
  }, [importFromDiscord]);

  const auditStatusLabel = useMemo(() => {
    return selectedProcessor ? "Selected" : "Missing";
  }, [selectedProcessor]);

  const statusPillClass = (active: boolean) =>
    active
      ? "border border-[#00ff66]/40 bg-[#00ff66]/10 text-[#00ff66]"
      : "border border-red-500/40 bg-red-500/10 text-red-300";

  const checkNameDuplicate = async (value?: string) => {
    const clean = cleanNameValue(value ?? name);

    setNameError("");

    if (!clean) {
      setNameStatus("idle");
      return false;
    }

    setNameStatus("checking");

    const { data, error } = await supabase
      .from("personnel")
      .select("id, status")
      .eq("name", clean);

    if (error) {
      setNameStatus("error");
      setNameError("Failed to check existing names.");
      return false;
    }

    const activeDuplicate = (data || []).find(
      (row: PersonnelDuplicateRow) => !isInactiveStatus(row.status)
    );

    if (activeDuplicate) {
      setNameStatus("duplicate");
      setNameError("Name already exists on an active personnel record.");
      return true;
    }

    setNameStatus("available");
    return false;
  };

  const checkBirthDuplicate = async (value?: string) => {
    const clean = cleanBirthValue(value ?? birthNumber);

    setBirthError("");

    if (!clean) {
      setBirthStatus("idle");
      return false;
    }

    setBirthStatus("checking");

    const { data, error } = await supabase
      .from("personnel")
      .select("id, status")
      .eq("birth_number", clean);

    if (error) {
      setBirthStatus("error");
      setBirthError("Failed to check existing birth numbers.");
      return false;
    }

    const activeDuplicate = (data || []).find(
      (row: PersonnelDuplicateRow) => !isInactiveStatus(row.status)
    );

    if (activeDuplicate) {
      setBirthStatus("duplicate");
      setBirthError("Birth number already exists on an active personnel record.");
      return true;
    }

    setBirthStatus("available");
    return false;
  };

  const validateRequiredFields = () => {
    let valid = true;

    setFormError("");
    setProcessorError("");

    if (!selectedProcessor) {
      setProcessorError("You must select who processed this form.");
      valid = false;
    }

    if (!cleanBirthValue(birthNumber)) {
      setBirthError("Birth Number is required.");
      setBirthStatus("idle");
      valid = false;
    }

    if (!cleanNameValue(name)) {
      setNameError("Name is required.");
      setNameStatus("idle");
      valid = false;
    }

    if (!validateDiscordId()) {
        valid = false;
    }

    return valid;
  };

  const createUser = async () => {
    setSuccessMessage("");
    setFormError("");

    if (!validateRequiredFields()) return;

    const cleanName = cleanNameValue(name);
    const cleanBirthNumber = cleanBirthValue(birthNumber);
    const cleanDiscordId = cleanDiscordValue(discordId);
    const cleanTeamspeakId = cleanTeamspeakValue(teamspeakId);

    const [nameDuplicate, birthDuplicate] = await Promise.all([
      checkNameDuplicate(cleanName),
      checkBirthDuplicate(cleanBirthNumber),
    ]);

    if (nameDuplicate || birthDuplicate) {
      setFormError("Please resolve the duplicate checks before creating personnel.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: processorExists } = await supabase
        .from("personnel")
        .select("id")
        .eq("id", selectedProcessor)
        .maybeSingle();

      if (!processorExists) {
        setProcessorError("Selected processor does not exist.");
        setSubmitting(false);
        return;
      }

      const insertPayload: {
        rank_id: string | null;
        birth_number: string;
        name: string;
        discord_id: string | null;
        ts_id: string | null;
        auto_role_sync: boolean;
        status: null;
        created_at?: string | null;
      } = {
        rank_id: rankId || null,
        birth_number: cleanBirthNumber,
        name: cleanName,
        discord_id: cleanDiscordId || null,
        ts_id: cleanTeamspeakId || null,
        auto_role_sync: !importFromDiscord,
        status: null,
      };

      if (createdAt) {
        insertPayload.created_at = new Date(createdAt).toISOString();
      }

      const { data, error } = await supabase
        .from("personnel")
        .insert([insertPayload])
        .select()
        .single();

      if (error) {
        setFormError(error.message);
        setSubmitting(false);
        return;
      }

      const { error: auditError } = await supabase
        .from("audit_logs")
        .insert([
          {
            user_id: user.id,
            target_personnel_id: data.id,
            action: "NEW_MEMBER",
            details: "New member added to system",
            processed_by: selectedProcessor,
          },
        ]);

      if (auditError) {
        console.error("Audit Insert Error:", auditError);
        setFormError("Audit log failed: " + auditError.message);
        setSubmitting(false);
        return;
      }

      if (importFromDiscord && cleanDiscordId) {
        const { data: importData, error: importError } =
          await supabase.functions.invoke("discord-full-import", {
            body: {
              discord_id: cleanDiscordId,
              personnel_id: data.id,
            },
          });

        if (importError) {
          setFormError(importError.message);
          setSubmitting(false);
          return;
        }

        if (importData?.error) {
          setFormError(importData.error);
          setSubmitting(false);
          return;
        }
      }

      setSuccessMessage("✅ Personnel created successfully.");
      setRankId("");
      setBirthNumber("");
      setName("");
      setDiscordId("");
      setTeamspeakId("");
      setImportFromDiscord(false);
      setCreatedAt("");
      setProcessorSearch("");
      setNameStatus("idle");
      setBirthStatus("idle");
      setNameError("");
      setBirthError("");
      setFormError("");
    } catch (error) {
      setFormError("Something went wrong while creating personnel.");
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (hasError?: boolean, disabled?: boolean) =>
    `w-full p-4 rounded-xl transition-all duration-200 ${
      disabled
        ? "bg-black/40 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"
        : hasError
        ? "bg-black/60 border border-red-500/60 text-[#00ff66] focus:outline-none focus:border-red-400"
        : "bg-black/60 border border-[#00ff66]/30 text-[#00ff66] focus:outline-none focus:border-[#00ff66] focus:shadow-[0_0_10px_#00ff66]"
    }`;

  const helperText = (
    status: DuplicateState,
    error: string,
    successText: string
  ) => {
    if (error) {
      return <p className="mt-2 text-sm text-red-400">{error}</p>;
    }

    if (status === "checking") {
      return <p className="mt-2 text-sm text-[#00ff66]/70">Checking...</p>;
    }

    if (status === "available") {
      return <p className="mt-2 text-sm text-[#00ff66]/80">{successText}</p>;
    }

    if (status === "error") {
      return <p className="mt-2 text-sm text-red-400">Check failed.</p>;
    }

    return null;
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#eafff2] p-6 md:p-10">
      <div className="max-w-5xl mx-auto">
        <button
          onClick={() => router.push("/pcs")}
          className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
        >
          ← Return to Dashboard
        </button>

        <div className="rounded-3xl border border-[#00ff66]/20 bg-black/40 backdrop-blur-xl p-6 md:p-8 mb-6">
          <h1 className="text-3xl md:text-4xl font-bold text-[#00ff66] tracking-widest">
            Create New Personnel
          </h1>
          <p className="mt-2 text-sm md:text-base text-[#00ff66]/65">
            Intake form for creating a new personnel record, attaching audit ownership, and optionally importing Discord data.
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
            <div className={`rounded-2xl px-4 py-3 ${statusPillClass(true)}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Rank Source</div>
              <div className="mt-1 font-semibold">{rankSourceLabel}</div>
            </div>

            <div
              className={`rounded-2xl px-4 py-3 ${
                selectedProcessor ? statusPillClass(true) : statusPillClass(false)
              }`}
            >
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Audit Processor</div>
              <div className="mt-1 font-semibold">{auditStatusLabel}</div>
            </div>


            <div className={`rounded-2xl px-4 py-3 ${statusPillClass(true)}`}>
              <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">Created At</div>
              <div className="mt-1 font-semibold">{createdAtLabel}</div>
            </div>
          </div>
        </div>

        {successMessage && (
          <div className="mb-6 rounded-2xl border border-[#00ff66]/40 bg-[#00ff66]/10 px-5 py-4 text-[#00ff66]">
            <div className="font-semibold">{successMessage}</div>
            <div className="text-sm text-[#00ff66]/75 mt-1">
              The form has been cleared and is ready for another entry.
            </div>
          </div>
        )}

        {formError && (
          <div className="mb-6 rounded-2xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-red-300">
            <div className="font-semibold">Creation failed</div>
            <div className="text-sm mt-1">{formError}</div>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 p-6 md:p-8">
              <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
                Account Links
              </h2>

         <div className="mb-6">
         <label className="block mb-2 text-sm text-gray-300">
           Discord ID
           </label>
              <input
                type="text"
                 value={discordId}
                 onChange={(e) => {
                 setDiscordId(cleanDiscordValue(e.target.value));
                  setDiscordError("");
                   }}
                   onBlur={() => validateDiscordId()}
                   disabled={submitting}
                   className={fieldClass(!!discordError, submitting)}
                   placeholder="Discord user ID"
                                 />

                   {discordError && (
                  <p className="mt-2 text-sm text-red-400">{discordError}</p>
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm text-gray-300">
                  Teamspeak ID
                </label>
                <input
                  type="text"
                  value={teamspeakId}
                  onChange={(e) => setTeamspeakId(cleanTeamspeakValue(e.target.value))}
                  disabled={submitting}
                  className={fieldClass(false, submitting)}
                  placeholder="TS ID"
                />
              </div>
            </div>

            <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 p-6 md:p-8">
              <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
                Personnel Details
              </h2>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-300">
                  Rank {importFromDiscord && "(Disabled - importing from Discord)"}
                </label>

                <select
                  value={rankId}
                  onChange={(e) => setRankId(e.target.value)}
                  disabled={importFromDiscord || submitting}
                  className={fieldClass(false, importFromDiscord || submitting)}
                >
                  <option value="">-- Select Rank --</option>
                  {ranks.map((rank) => (
                    <option key={rank.id} value={rank.id}>
                      {rank.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-300">
                  Birth Number
                </label>

                <input
                  type="text"
                  value={birthNumber}
                  onChange={(e) => {
                    setBirthNumber(cleanBirthValue(e.target.value));
                    setBirthError("");
                    if (birthStatus !== "idle") setBirthStatus("idle");
                  }}
                  onBlur={() => checkBirthDuplicate()}
                  disabled={submitting}
                  className={fieldClass(!!birthError, submitting)}
                  placeholder="Unique birth number"
                />

                {helperText(
                  birthStatus,
                  birthError,
                  "Birth number is available."
                )}
              </div>

              <div>
                <label className="block mb-2 text-sm text-gray-300">
                  Name
                </label>

                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(cleanNameValue(e.target.value));
                    setNameError("");
                    if (nameStatus !== "idle") setNameStatus("idle");
                  }}
                  onBlur={() => checkNameDuplicate()}
                  disabled={submitting}
                  className={fieldClass(!!nameError, submitting)}
                  placeholder="Full personnel name"
                />

                {helperText(
                  nameStatus,
                  nameError,
                  "Name is available."
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 p-6 md:p-8">
              <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
                Record Controls
              </h2>

              <div className="space-y-4 mb-6">
                <label className="flex items-center justify-between cursor-pointer gap-4">
                  <div>
                    <div className={`font-medium ${importFromDiscord ? "text-[#00ff66]" : "text-white"}`}>
                      Import Rank + Certifications From Discord
                    </div>
                    <div className="text-xs text-[#00ff66]/60 mt-1">
                      Pull rank and certifications from Discord instead of setting rank manually.
                    </div>
                  </div>

                  <div className="relative shrink-0">
                    <input
                      type="checkbox"
                      checked={importFromDiscord}
                      onChange={(e) => setImportFromDiscord(e.target.checked)}
                      disabled={submitting}
                      className="sr-only"
                    />

                    <div
                      className={`w-12 h-6 rounded-full p-1 transition-all duration-200 ${
                        importFromDiscord
                          ? "bg-[#00ff66]"
                          : "bg-black border border-[#00ff66]"
                      } ${submitting ? "opacity-50" : ""}`}
                    >
                      <div
                        className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-200 ${
                          importFromDiscord ? "translate-x-6" : ""
                        }`}
                      />
                    </div>
                  </div>
                </label>
              </div>

              {importFromDiscord && (
                <div className="mb-4 rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-cyan-200">
                  Rank will be pulled from Discord. Manual rank selection is disabled.
                </div>
              )}

              {createdAt && (
                <div className="mb-4 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 px-4 py-3 text-yellow-200">
                  This will override the default creation timestamp.
                </div>
              )}

              <div>
                <label className="block mb-2 text-sm text-gray-300">
                  Created At
                </label>

                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    type="datetime-local"
                    value={createdAt}
                    onChange={(e) => setCreatedAt(e.target.value)}
                    disabled={submitting}
                    className={`flex-1 ${fieldClass(false, submitting)}`}
                  />

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => {
                      const now = new Date();
                      const local = new Date(
                        now.getTime() - now.getTimezoneOffset() * 60000
                      )
                        .toISOString()
                        .slice(0, 16);

                      setCreatedAt(local);
                    }}
                    className="px-6 rounded-xl bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition disabled:opacity-50"
                  >
                    Set Now
                  </button>

                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setCreatedAt("")}
                    className="px-4 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-black transition disabled:opacity-50"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 p-6 md:p-8">
              <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
                Audit Details
              </h2>

              <div>
                <label className="block mb-2 text-sm text-gray-300">
                  Who Processed This Form?
                </label>

                <p className="text-xs text-[#00ff66]/60 mb-2">
                  Required for audit tracking
                </p>

                <select
                  value={selectedProcessor}
                  onChange={(e) => {
                    setSelectedProcessor(e.target.value);
                    setProcessorError("");
                  }}
                  disabled={submitting}
                  className={fieldClass(!!processorError, submitting)}
                >
                  <option value="">-- Select Processor --</option>

                  {filteredProcessors.map((processor) => (
                    <option key={processor.id} value={processor.id}>
                      {processor.name}
                    </option>
                  ))}
                </select>

                {processorError && (
                  <p className="mt-2 text-sm text-red-400">{processorError}</p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 p-6 sticky top-6">
              <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
                New Personnel Preview
              </h2>

              <div className="space-y-4 text-sm">
                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Name</div>
                  <div className="text-white font-medium">{cleanNameValue(name) || "—"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Birth Number</div>
                  <div className="text-white font-medium">{cleanBirthValue(birthNumber) || "—"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Rank</div>
                  <div className="text-white font-medium">
                    {importFromDiscord ? "From Discord" : selectedRank?.name || "—"}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Discord ID</div>
                  <div className="text-white font-medium break-all">{discordId || "—"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Teamspeak ID</div>
                  <div className="text-white font-medium break-all">{teamspeakId || "—"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Processed By</div>
                  <div className="text-white font-medium">{selectedProcessorName || "—"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Created At</div>
                  <div className="text-white font-medium">{createdAt || "Database Default"}</div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                  <div className="text-[#00ff66]/60 text-xs uppercase tracking-[0.2em] mb-2">Role Sync</div>
                  <div className="text-white font-medium">{roleSyncLabel}</div>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  onClick={createUser}
                  disabled={submitting}
                  className={`w-full py-4 rounded-xl font-bold transition-all duration-200 ${
                    submitting
                      ? "bg-gray-700 border border-gray-600 text-gray-300 cursor-wait"
                      : "bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black hover:shadow-[0_0_25px_#00ff66]"
                  }`}
                >
                  {submitting ? "Creating Personnel..." : "Create Personnel"}
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => router.push("/pcs")}
                  className="w-full py-3 rounded-xl border border-[#00ff66]/30 text-[#00ff66]/80 hover:bg-[#00ff66]/10 transition disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>

              {(!selectedProcessor || !cleanNameValue(name) || !cleanBirthValue(birthNumber)) && (
                <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                  Required before submit: processor, birth number, and name.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}