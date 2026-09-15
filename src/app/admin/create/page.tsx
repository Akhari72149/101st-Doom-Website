"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Hash,
  Link2,
  Loader2,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type RankRow = { id: string; name: string; rank_level: number };
type ProcessorRow = { id: string; name: string | null; status: string | null };
type DuplicateState = "idle" | "checking" | "available" | "duplicate" | "error";

const fieldBase =
  "h-11 w-full border bg-black/50 px-3 text-sm text-white outline-none transition placeholder:text-[#668075] disabled:cursor-not-allowed disabled:border-white/10 disabled:text-white/35";

export default function CreatePersonnel() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [canEdit, setCanEdit] = useState(false);
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

  const cleanName = (value: string) => value.replace(/\s+/g, " ").trim();
  const cleanBirth = (value: string) => value.replace(/\s+/g, "").trim();
  const selectedRank = useMemo(() => ranks.find((rank) => rank.id === rankId), [rankId, ranks]);
  const selectedProcessorName = useMemo(
    () => processors.find((processor) => processor.id === selectedProcessor)?.name || "",
    [processors, selectedProcessor],
  );
  const filteredProcessors = useMemo(() => {
    const query = processorSearch.trim().toLowerCase();
    return query
      ? processors.filter((processor) => (processor.name || "").toLowerCase().includes(query))
      : processors;
  }, [processorSearch, processors]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await getAppSession();
      if (!session) {
        router.replace("/login");
        return;
      }
      if (!hasAppPermission(session, "admin.create", "read")) {
        router.replace("/");
        return;
      }
      const response = await fetch("/api/admin/personnel-operations?scope=create", {
        cache: "no-store",
        credentials: "same-origin",
        headers: await getAppAuthHeaders(),
      });
      if (cancelled) return;
      if (!response.ok) {
        setLoadError("Personnel setup data could not be loaded. Refresh the page to try again.");
        setLoadingAuth(false);
        return;
      }
      const data = await response.json() as { ranks?: RankRow[]; processors?: ProcessorRow[] };
      setCanEdit(hasAppPermission(session, "admin.create", "edit"));
      setRanks(data.ranks || []);
      setProcessors(data.processors || []);
      setLoadingAuth(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  function selectMode(importMode: boolean) {
    if (!canEdit || submitting) return;
    setImportFromDiscord(importMode);
    setDiscordError("");
    if (importMode) setRankId("");
  }

  function validateDiscord(value = discordId) {
    const clean = value.trim();
    setDiscordError("");
    if (!clean) {
      setDiscordError("Discord ID is required.");
      return false;
    }
    if (!/^\d{17,20}$/.test(clean)) {
      setDiscordError("Enter a valid 17-20 digit Discord user ID.");
      return false;
    }
    return true;
  }

  async function checkDuplicate(field: "name" | "birth_number", rawValue: string) {
    const value = field === "name" ? cleanName(rawValue) : cleanBirth(rawValue);
    const setState = field === "name" ? setNameStatus : setBirthStatus;
    const setError = field === "name" ? setNameError : setBirthError;
    setError("");
    if (!value) {
      setState("idle");
      return false;
    }
    setState("checking");
    try {
      const response = await fetch(
        `/api/admin/personnel-operations?scope=create&duplicate=${field}&value=${encodeURIComponent(value)}`,
        { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() },
      );
      if (!response.ok) throw new Error("Duplicate check failed");
      const data = await response.json() as { duplicate?: boolean };
      if (data.duplicate) {
        setState("duplicate");
        setError(field === "name"
          ? "An active record already uses this name."
          : "An active record already uses this service number.");
        return true;
      }
      setState("available");
      return false;
    } catch {
      setState("error");
      setError("Could not check existing records. The server will check again on submission.");
      return false;
    }
  }

  function validateForm() {
    let valid = true;
    setFormError("");
    setNameError("");
    setBirthError("");
    setProcessorError("");
    if (!cleanName(name)) {
      setNameError("Name is required.");
      valid = false;
    }
    if (!cleanBirth(birthNumber)) {
      setBirthError("Service number is required.");
      valid = false;
    }
    if (!selectedProcessor) {
      setProcessorError("Select who processed this intake.");
      valid = false;
    }
    if (!validateDiscord()) valid = false;
    return valid;
  }

  function resetForm() {
    setRankId("");
    setBirthNumber("");
    setName("");
    setDiscordId("");
    setTeamspeakId("");
    setImportFromDiscord(false);
    setCreatedAt("");
    setProcessorSearch("");
    setSelectedProcessor("");
    setNameStatus("idle");
    setBirthStatus("idle");
    setNameError("");
    setBirthError("");
    setDiscordError("");
    setProcessorError("");
    setFormError("");
  }

  async function createPersonnel() {
    if (!canEdit || submitting || !validateForm()) return;
    setSuccessMessage("");
    const normalizedName = cleanName(name);
    const normalizedBirth = cleanBirth(birthNumber);
    const [duplicateName, duplicateBirth] = await Promise.all([
      checkDuplicate("name", normalizedName),
      checkDuplicate("birth_number", normalizedBirth),
    ]);
    if (duplicateName || duplicateBirth) {
      setFormError("Resolve the duplicate record before continuing.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/admin/personnel-operations", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({
          scope: "create",
          action: "create",
          rankId: rankId || null,
          birthNumber: normalizedBirth,
          name: normalizedName,
          discordId: discordId.trim(),
          teamspeakId: teamspeakId.trim(),
          importFromDiscord,
          createdAt: createdAt ? new Date(createdAt).toISOString() : null,
          processorId: selectedProcessor,
        }),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) {
        setFormError(body?.error || "Failed to create personnel.");
        return;
      }
      setSuccessMessage(importFromDiscord
        ? `${normalizedName} was created. Discord rank and certification import is queued.`
        : `${normalizedName} was created successfully.`);
      resetForm();
    } catch (error) {
      console.error(error);
      setFormError("The request could not reach the server. No confirmed record was created.");
    } finally {
      setSubmitting(false);
    }
  }

  function statusIcon(status: DuplicateState) {
    if (status === "checking") return <Loader2 size={14} className="animate-spin text-cyan-300" />;
    if (status === "available") return <CheckCircle2 size={14} className="text-[#00ff66]" />;
    return null;
  }

  function inputClass(hasError = false) {
    return `${fieldBase} ${hasError
      ? "border-red-500/70 focus:border-red-400"
      : "border-[#00ff66]/25 focus:border-[#00ff66] focus:shadow-[0_0_0_1px_rgba(0,255,102,0.16)]"}`;
  }

  if (loadingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#000805] text-[#00ff66]">
        <div className="flex items-center gap-3 text-sm uppercase tracking-[0.16em]">
          <Loader2 size={18} className="animate-spin" /> Checking access
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#000805] px-4 py-6 text-[#e8f5ee] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-5 flex flex-col gap-4 border-b border-[#00ff66]/25 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => router.push("/pcs")}
              className="mb-3 inline-flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-[#8da99a] transition hover:text-[#00ff66]"
            >
              <ArrowLeft size={15} /> Personnel control
            </button>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center border border-[#00ff66]/40 bg-[#00ff66]/8 text-[#00ff66]">
                <UserPlus size={20} />
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-[#00ff66]/65">Personnel administration</p>
                <h1 className="text-2xl font-semibold text-white sm:text-3xl">Personnel Intake</h1>
              </div>
            </div>
          </div>
          <div className={`inline-flex h-9 items-center gap-2 border px-3 text-xs uppercase tracking-[0.12em] ${canEdit
            ? "border-[#00ff66]/35 bg-[#00ff66]/8 text-[#00ff66]"
            : "border-amber-400/35 bg-amber-400/8 text-amber-200"}`}>
            <ShieldCheck size={15} /> {canEdit ? "Edit access" : "View only"}
          </div>
        </header>

        {loadError && <Alert tone="error" icon={<X size={18} />}>{loadError}</Alert>}
        {successMessage && <Alert tone="success" icon={<CheckCircle2 size={18} />}>{successMessage}</Alert>}
        {formError && <Alert tone="error" icon={<X size={18} />}>{formError}</Alert>}

        <div className="border border-[#00ff66]/25 bg-[#020b07]/90">
          <div className="flex flex-col gap-3 border-b border-[#00ff66]/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-white">Creation mode</h2>
              <p className="mt-0.5 text-xs text-[#759184]">Choose where the initial rank and certifications come from.</p>
            </div>
            <div className="grid grid-cols-2 border border-[#00ff66]/30 bg-black/40 p-1">
              <ModeButton active={!importFromDiscord} disabled={!canEdit || submitting} onClick={() => selectMode(false)}>
                Manual rank
              </ModeButton>
              <ModeButton active={importFromDiscord} accent="cyan" disabled={!canEdit || submitting} onClick={() => selectMode(true)}>
                Discord import
              </ModeButton>
            </div>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="divide-y divide-[#00ff66]/15">
              <section className="p-4 sm:p-5">
                <SectionTitle icon={<Users size={17} />}>Personnel details</SectionTitle>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <Field label="Name" required error={nameError} status={statusIcon(nameStatus)}>
                    <input
                      aria-label="Name"
                      value={name}
                      maxLength={100}
                      disabled={!canEdit || submitting}
                      onChange={(event) => { setName(event.target.value); setNameError(""); setNameStatus("idle"); }}
                      onBlur={() => void checkDuplicate("name", name)}
                      className={inputClass(Boolean(nameError))}
                      placeholder="Personnel name"
                    />
                  </Field>
                  <Field label="Service number" required error={birthError} status={statusIcon(birthStatus)}>
                    <div className="relative">
                      <Hash size={15} className="absolute left-3 top-3.5 text-[#648075]" />
                      <input
                        aria-label="Service number"
                        value={birthNumber}
                        maxLength={50}
                        disabled={!canEdit || submitting}
                        onChange={(event) => { setBirthNumber(event.target.value.replace(/\s+/g, "")); setBirthError(""); setBirthStatus("idle"); }}
                        onBlur={() => void checkDuplicate("birth_number", birthNumber)}
                        className={`${inputClass(Boolean(birthError))} pl-9`}
                        placeholder="72149"
                      />
                    </div>
                  </Field>
                  <Field label="Initial rank" hint={importFromDiscord ? "Selected automatically from Discord" : "Optional"}>
                    <select
                      aria-label="Initial rank"
                      value={rankId}
                      disabled={!canEdit || submitting || importFromDiscord}
                      onChange={(event) => setRankId(event.target.value)}
                      className={inputClass()}
                    >
                      <option value="">No rank selected</option>
                      {ranks.map((rank) => <option key={rank.id} value={rank.id}>{rank.name}</option>)}
                    </select>
                  </Field>
                </div>
              </section>

              <section className="p-4 sm:p-5">
                <SectionTitle icon={<Link2 size={17} />}>Connected identities</SectionTitle>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field
                    label="Discord user ID"
                    required
                    hint={importFromDiscord ? "Used to read rank and certification roles" : "Used to assign initial server roles"}
                    error={discordError}
                  >
                    <input
                      aria-label="Discord user ID"
                      inputMode="numeric"
                      value={discordId}
                      maxLength={20}
                      disabled={!canEdit || submitting}
                      onChange={(event) => { setDiscordId(event.target.value.replace(/\D/g, "")); setDiscordError(""); }}
                      onBlur={() => validateDiscord()}
                      className={inputClass(Boolean(discordError))}
                      placeholder="17-20 digit Discord ID"
                    />
                  </Field>
                  <Field label="TeamSpeak ID" hint="Optional">
                    <input
                      aria-label="TeamSpeak ID"
                      value={teamspeakId}
                      maxLength={200}
                      disabled={!canEdit || submitting}
                      onChange={(event) => setTeamspeakId(event.target.value)}
                      className={inputClass()}
                      placeholder="TeamSpeak unique ID"
                    />
                  </Field>
                </div>
              </section>

              <section className="p-4 sm:p-5">
                <SectionTitle icon={<ShieldCheck size={17} />}>Processing and audit</SectionTitle>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
                  <Field label="Processed by" required error={processorError} hint="Only certified processors are listed">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
                      <div className="relative">
                        <Search size={15} className="absolute left-3 top-3.5 text-[#648075]" />
                        <input
                          aria-label="Filter processors"
                          value={processorSearch}
                          disabled={!canEdit || submitting}
                          onChange={(event) => setProcessorSearch(event.target.value)}
                          className={`${inputClass()} pl-9`}
                          placeholder="Filter processors"
                        />
                      </div>
                      <select
                        aria-label="Processed by"
                        value={selectedProcessor}
                        disabled={!canEdit || submitting}
                        onChange={(event) => { setSelectedProcessor(event.target.value); setProcessorError(""); }}
                        className={inputClass(Boolean(processorError))}
                      >
                        <option value="">Select processor</option>
                        {filteredProcessors.map((processor) => (
                          <option key={processor.id} value={processor.id}>{processor.name}</option>
                        ))}
                      </select>
                    </div>
                  </Field>
                  <Field label="Record date and time" hint="Leave blank to use the current database time">
                    <div className="grid grid-cols-[minmax(0,1fr)_44px_44px] gap-2">
                      <input
                        aria-label="Record date and time"
                        type="datetime-local"
                        value={createdAt}
                        disabled={!canEdit || submitting}
                        onChange={(event) => setCreatedAt(event.target.value)}
                        className={inputClass()}
                      />
                      <IconButton title="Set current time" disabled={!canEdit || submitting} onClick={() => {
                        const now = new Date();
                        setCreatedAt(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
                      }}>
                        <Clock3 size={17} />
                      </IconButton>
                      <IconButton title="Use database default" muted disabled={!canEdit || submitting || !createdAt} onClick={() => setCreatedAt("")}>
                        <X size={17} />
                      </IconButton>
                    </div>
                  </Field>
                </div>
              </section>
            </div>

            <aside className="border-t border-[#00ff66]/20 bg-black/25 p-4 lg:border-l lg:border-t-0 lg:p-5">
              <div className="lg:sticky lg:top-5">
                <SectionTitle icon={<CalendarClock size={17} />}>Intake summary</SectionTitle>
                <dl className="divide-y divide-white/8 border-y border-white/10 text-sm">
                  <Summary label="Personnel" value={cleanName(name) || "Not entered"} />
                  <Summary label="Service no." value={cleanBirth(birthNumber) || "Not entered"} />
                  <Summary label="Rank source" value={importFromDiscord ? "Discord import" : selectedRank?.name || "No rank"} />
                  <Summary label="Discord" value={discordId || "Not linked"} mono />
                  <Summary label="TeamSpeak" value={teamspeakId.trim() || "Not linked"} />
                  <Summary label="Processed by" value={selectedProcessorName || "Not selected"} />
                  <Summary label="Record time" value={createdAt ? createdAt.replace("T", " ") : "Current time"} />
                </dl>

                <div className="mt-4 border border-[#00ff66]/20 bg-[#00ff66]/5 p-3 text-xs leading-5 text-[#9ab5a7]">
                  {importFromDiscord
                    ? "The record is created immediately. The bot then imports the highest matching rank and all matching certifications."
                    : "The record and audit entry are created together, then initial Discord server roles are queued."}
                </div>

                <button
                  type="button"
                  onClick={() => void createPersonnel()}
                  disabled={!canEdit || submitting || Boolean(loadError)}
                  className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 bg-[#00ff66] px-4 text-sm font-bold uppercase tracking-[0.1em] text-black transition hover:bg-[#5bff98] disabled:cursor-not-allowed disabled:bg-[#193326] disabled:text-white/35"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {submitting ? "Creating record" : "Create personnel"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={!canEdit || submitting}
                  className="mt-2 inline-flex h-10 w-full items-center justify-center gap-2 border border-white/15 text-xs font-semibold uppercase tracking-[0.1em] text-[#9ab5a7] transition hover:border-white/30 hover:text-white disabled:opacity-40"
                >
                  <X size={15} /> Clear form
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </main>
  );
}

function Alert({ tone, icon, children }: { tone: "success" | "error"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className={`mb-4 flex items-start gap-3 border px-4 py-3 text-sm ${tone === "success"
      ? "border-[#00ff66]/40 bg-[#00ff66]/8 text-[#caffdf]"
      : "border-red-500/45 bg-red-950/30 text-red-200"}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>{children}
    </div>
  );
}

function ModeButton({ active, accent = "green", disabled, onClick, children }: {
  active: boolean;
  accent?: "green" | "cyan";
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`h-9 px-4 text-xs font-semibold uppercase tracking-[0.1em] transition disabled:cursor-not-allowed disabled:opacity-50 ${active
        ? accent === "cyan" ? "bg-cyan-300 text-black" : "bg-[#00ff66] text-black"
        : "text-[#8da99a] hover:text-white"}`}
    >
      {children}
    </button>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-[#00ff66]">
      {icon}<h2 className="text-sm font-semibold uppercase tracking-[0.14em]">{children}</h2>
    </div>
  );
}

function Field({ label, required, hint, error, status, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  status?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block min-w-0">
      <span className="mb-1.5 flex min-h-5 items-center gap-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#b3c8bd]">
        {label} {required && <span className="text-[#00ff66]">Required</span>} {status}
      </span>
      {children}
      <span className={`mt-1.5 block min-h-4 text-[11px] ${error ? "text-red-300" : "text-[#648075]"}`}>
        {error || hint || " "}
      </span>
    </div>
  );
}

function IconButton({ title, muted = false, disabled, onClick, children }: {
  title: string;
  muted?: boolean;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-11 place-items-center border transition disabled:opacity-30 ${muted
        ? "border-white/15 text-[#8da99a] hover:border-red-400/50 hover:text-red-300"
        : "border-[#00ff66]/30 text-[#00ff66] hover:bg-[#00ff66]/10"}`}
    >
      {children}
    </button>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-3 py-2.5">
      <dt className="text-[11px] uppercase tracking-[0.1em] text-[#648075]">{label}</dt>
      <dd className={`truncate text-right text-[#dcebe3] ${mono ? "font-mono text-xs" : ""}`} title={value}>{value}</dd>
    </div>
  );
}
