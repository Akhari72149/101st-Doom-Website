"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import {
  ChevronDown,
  Dice5,
  Lock,
  Save,
  Search,
  Settings2,
  Shield,
  Trash2,
  Users,
  UserPlus,
  Wand2,
} from "lucide-react";

type Signup = {
  id: string;
  operation_id: string;
  name: string;
  selected: boolean;
  weight?: number;
  level?: number;
};

type LevelRow = {
  id: string;
  name: string;
  level: number;
};

export default function SideOperationPage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [operation, setOperation] = useState<any>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [knownPeople, setKnownPeople] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsOpen, setSignupsOpen] = useState<boolean>(true);
  const [processing, setProcessing] = useState(false);
  const [name, setName] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);
  const [signupSearch, setSignupSearch] = useState("");
  const [signupError, setSignupError] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSlotCount, setEditSlotCount] = useState("1");
  const [savingOperation, setSavingOperation] = useState(false);
  const [togglingSignups, setTogglingSignups] = useState(false);

  const nameDropdownRef = useRef<HTMLDivElement | null>(null);

  const isPrivileged = roles.includes("admin") || roles.includes("logistics");

  useEffect(() => {
    const loadUser = async () => {
      const session = await getAppSession();
      setUser(session ? { id: session.user.id } : null);
      if (!session) return;
      const customAccess = hasAppPermission(session, "operations.randomiser", "edit");
      setRoles(customAccess ? [...session.roles, "logistics"] : session.roles);
    };

    loadUser();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (operation) {
      setEditTitle(operation.title ?? "");
      setEditDescription(operation.description ?? "");
      setEditSlotCount(String(operation.slot_count ?? 1));
    }
  }, [operation]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        nameDropdownRef.current &&
        !nameDropdownRef.current.contains(event.target as Node)
      ) {
        setShowNameDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const normaliseName = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, " ");

  const getWeightFromLevel = (level: number) => {
    switch (level) {
      case 2:
        return 75;
      case 3:
        return 50;
      case 4:
        return 25;
      default:
        return 100;
    }
  };

  const fetchData = async () => {
    setLoading(true);
    const response = await fetch("/api/randomiser", { cache: "no-store" });
    if (!response.ok) {
      console.error("FETCH OPERATION ERROR:", await response.text());
      setLoading(false);
      return;
    }
    const data = await response.json() as { operation: any; signups: Signup[]; knownPeople: LevelRow[] };
    const op = data.operation;
    if (!op) {
      setLoading(false);
      return;
    }
    setKnownPeople(data.knownPeople || []);
    setOperation(op);
    setSignupsOpen(op.open);
    setSignups(data.signups || []);
    setLoading(false);
  };

  const filteredKnownPeople = useMemo(() => {
    const term = normaliseName(name);

    if (!term) return knownPeople.slice(0, 12);

    return knownPeople
      .filter((person) => normaliseName(person.name).includes(term))
      .slice(0, 12);
  }, [knownPeople, name]);

  const filteredSignups = useMemo(() => {
    const term = normaliseName(signupSearch);

    const sorted = [...signups].sort((a, b) => {
      if (a.selected !== b.selected) return a.selected ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    if (!term) return sorted;

    return sorted.filter((signup) =>
      normaliseName(signup.name).includes(term)
    );
  }, [signups, signupSearch]);

  const selected = useMemo(
    () => signups.filter((s) => s.selected),
    [signups]
  );

  const availableCount = Math.max((operation?.slot_count ?? 0) - selected.length, 0);

  const stats = useMemo(() => {
    return {
      totalSignups: signups.length,
      selectedCount: selected.length,
      slotCount: operation?.slot_count ?? 0,
      status: signupsOpen ? "Open" : "Closed",
    };
  }, [signups.length, selected.length, operation?.slot_count, signupsOpen]);

  const handleSignup = async () => {
    if (!name.trim() || !operation || !signupsOpen) return;

    const cleanedName = name.trim();
    const normalised = normaliseName(cleanedName);

    const alreadySignedUp = signups.some(
      (s) => normaliseName(s.name) === normalised
    );

    if (alreadySignedUp) {
      setSignupError("That person is already signed up.");
      return;
    }

    setSignupError("");

    const response = await fetch("/api/randomiser", { method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify({ action: "signup", operationId: operation.id, name: cleanedName }) });

    if (!response.ok) {
      const body = await response.json().catch(() => null) as { error?: string } | null;
      setSignupError(body?.error || "Failed to add signup.");
      return;
    }

    setName("");
    setShowNameDropdown(false);
    fetchData();
  };

  const handleRemove = async (id: string) => {
    if (!isPrivileged) return;
    if (!confirm("Remove this signup?")) return;

    const response = await fetch(`/api/randomiser?signupId=${encodeURIComponent(id)}`, { method: "DELETE",
      credentials: "same-origin", headers: await getAppAuthHeaders() });

    if (!response.ok) {
      console.error("REMOVE SIGNUP ERROR:", await response.text());
      return;
    }

    fetchData();
  };

  const handleSaveOperationDetails = async () => {
    if (!isPrivileged || !operation) return;

    const trimmedTitle = editTitle.trim();
    const trimmedDescription = editDescription.trim();
    const parsedSlotCount = Number(editSlotCount);

    if (!trimmedTitle) {
      alert("Title cannot be empty.");
      return;
    }

    if (!trimmedDescription) {
      alert("Description cannot be empty.");
      return;
    }

    if (!Number.isInteger(parsedSlotCount) || parsedSlotCount < 1) {
      alert("Slot count must be a whole number of at least 1.");
      return;
    }

    setSavingOperation(true);

    const response = await fetch("/api/randomiser", { method: "PATCH", credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify({ action:"details", operationId:operation.id, title:trimmedTitle,
        description:trimmedDescription, slotCount:parsedSlotCount }) });

    if (!response.ok) {
      console.error("SAVE OPERATION DETAILS ERROR:", await response.text());
      setSavingOperation(false);
      return;
    }

    setOperation((prev: any) => ({
      ...prev,
      title: trimmedTitle,
      description: trimmedDescription,
      slot_count: parsedSlotCount,
    }));

    setSavingOperation(false);
  };

  const handleRandomise = async () => {
    if (!isPrivileged || !operation) return;

    setProcessing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const response = await fetch("/api/randomiser", { method:"PATCH", credentials:"same-origin",
        headers:{ "Content-Type":"application/json", ...(await getAppAuthHeaders()) },
        body:JSON.stringify({ action:"randomise", operationId:operation.id }) });
      if (!response.ok) console.error("RANDOMISE ERROR:", await response.text());
      else await fetchData();
    } catch (error) {
      console.error("RANDOMISE ERROR:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!isPrivileged || !operation) return;
    if (!confirm("Reset the current randomiser results?")) return;

    const response = await fetch("/api/randomiser", { method:"PATCH", credentials:"same-origin",
      headers:{ "Content-Type":"application/json", ...(await getAppAuthHeaders()) },
      body:JSON.stringify({ action:"reset", operationId:operation.id }) });
    if (!response.ok) {
      console.error("RESET OPERATION ERROR:", await response.text());
      return;
    }

    setOperation((prev: any) => ({
      ...prev,
      randomised: false,
    }));

    setSignups((prev) =>
      prev.map((s) => ({
        ...s,
        selected: false,
      }))
    );

    fetchData();
  };

  const handleToggleSignups = async () => {
    if (!operation) return;
    const nextState = !signupsOpen;
    const confirmed = nextState
      ? confirm("Open signups for this operation?")
      : confirm("Close signups for this operation?");

    if (!confirmed) return;

    setTogglingSignups(true);

    const response = await fetch("/api/randomiser", { method:"PATCH", credentials:"same-origin",
      headers:{ "Content-Type":"application/json", ...(await getAppAuthHeaders()) },
      body:JSON.stringify({ action:"toggle", operationId:operation.id, open:nextState }) });

    if (!response.ok) {
      console.error("TOGGLE SIGNUPS ERROR:", await response.text());
      setTogglingSignups(false);
      return;
    }

    setSignupsOpen(nextState);
    setOperation((prev: any) => ({
      ...prev,
      open: nextState,
    }));
    setTogglingSignups(false);
  };

  if (loading || !operation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Loading operation...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen text-white font-orbitron overflow-hidden">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-15"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/85 to-black/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,100,0.1)_0%,transparent_60%)]" />
        <div className="absolute inset-0 opacity-[0.05] bg-[linear-gradient(rgba(0,255,102,0.25)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.25)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative z-10 p-4 sm:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-3xl border border-[#00ff66]/25 bg-black/55 backdrop-blur-xl shadow-[0_0_60px_rgba(0,255,100,0.1)] overflow-hidden mb-8">
            <div className="p-6 sm:p-8 border-b border-[#00ff66]/10">
              <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-12 w-12 rounded-2xl border border-[#00ff66]/25 bg-[#00ff66]/10 flex items-center justify-center">
                      <Dice5 className="h-6 w-6 text-[#00ff66]" />
                    </div>
                    <div>
                      <h1 className="text-3xl sm:text-4xl text-[#00ff66] tracking-[0.18em]">
                        {operation.title}
                      </h1>
                      <p className="mt-2 text-sm sm:text-base text-gray-300 max-w-3xl font-sans">
                        {operation.description}
                      </p>
                    </div>
                  </div>

                  {!signupsOpen && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 font-sans">
                      <Lock className="h-4 w-4" />
                      Signups are currently closed
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 min-w-full xl:min-w-[420px]">
                  <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                      Signups
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.totalSignups}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                      Slots
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.slotCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                      Selected
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {stats.selectedCount}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/15 bg-black/40 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-2">
                      Status
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        signupsOpen ? "text-[#00ff66]" : "text-red-300"
                      }`}
                    >
                      {stats.status}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {isPrivileged && (
              <div className="px-6 sm:px-8 py-4 bg-black/30 border-t border-[#00ff66]/5">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-sans">
                  {[
                    { label: "Level 1", value: "100% weight" },
                    { label: "Level 2", value: "75% weight" },
                    { label: "Level 3", value: "50% weight" },
                    { label: "Level 4", value: "25% weight" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-[#00ff66]/10 bg-black/30 px-4 py-3"
                    >
                      <div className="text-xs uppercase tracking-[0.16em] text-gray-500">
                        {item.label}
                      </div>
                      <div className="text-sm text-[#00ff66] mt-1">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-8">
            <div className="space-y-8">
              <div className="rounded-3xl border border-[#00ff66]/20 bg-black/50 backdrop-blur-xl p-6 sm:p-8">
                <div className="flex items-start gap-3 mb-6">
                  <div className="h-11 w-11 rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/10 flex items-center justify-center">
                    <UserPlus className="h-5 w-5 text-[#00ff66]" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#00ff66]/70">
                      Personnel Entry
                    </div>
                    <h2 className="text-xl text-[#00ff66] mt-1">
                      Add Operator to Selection Pool
                    </h2>
                    <p className="mt-1 text-sm text-gray-400 font-sans">
                      Enter a new name or pick from known personnel already tracked in the level system.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 items-start">
                  <div className="relative flex-1 w-full" ref={nameDropdownRef}>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/70" />
                      <input
                        disabled={!signupsOpen}
                        type="text"
                        placeholder="Enter or select a name..."
                        value={name}
                        onFocus={() => setShowNameDropdown(true)}
                        onChange={(e) => {
                          setName(e.target.value);
                          setSignupError("");
                          setShowNameDropdown(true);
                        }}
                        className={`w-full pl-11 pr-10 py-3 rounded-2xl bg-black/70 border text-white placeholder:text-[#00ff66]/40 focus:outline-none focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]/40 font-sans ${
                          signupError
                            ? "border-red-500/50"
                            : "border-[#00ff66]/30"
                        } ${!signupsOpen ? "opacity-50 cursor-not-allowed" : ""}`}
                      />
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/70" />
                    </div>

                    {signupError && (
                      <div className="mt-2 text-sm text-red-300 font-sans">
                        {signupError}
                      </div>
                    )}

                    {signupsOpen && showNameDropdown && (
                      <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-[#00ff66]/20 bg-black/95 shadow-[0_0_25px_rgba(0,255,102,0.12)] backdrop-blur-xl">
                        <div className="border-b border-[#00ff66]/10 px-4 py-3 text-xs uppercase tracking-[0.22em] text-[#00ff66]/70">
                          Known Personnel
                        </div>

                        <div className="max-h-72 overflow-y-auto">
                          {filteredKnownPeople.length > 0 ? (
                            filteredKnownPeople.map((person) => {
                              const alreadySignedUp = signups.some(
                                (s) =>
                                  normaliseName(s.name) ===
                                  normaliseName(person.name)
                              );

                              return (
                                <button
                                  key={person.id}
                                  type="button"
                                  disabled={alreadySignedUp}
                                  onMouseDown={(e) => {
                                    e.preventDefault();
                                    if (alreadySignedUp) return;
                                    setName(person.name);
                                    setSignupError("");
                                    setShowNameDropdown(false);
                                  }}
                                  className={`flex w-full items-center justify-between border-b border-[#00ff66]/10 px-4 py-3 text-left transition-all ${
                                    alreadySignedUp
                                      ? "opacity-40 cursor-not-allowed"
                                      : "hover:bg-[#00ff66]/10"
                                  }`}
                                >
                                  <div className="flex flex-col">
                                    <span className="text-sm text-white font-sans">
                                      {person.name}
                                    </span>
                                    {alreadySignedUp && (
                                      <span className="text-xs text-gray-500 font-sans mt-1">
                                        Already signed up
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="rounded-full border border-[#00ff66]/25 bg-[#00ff66]/10 px-2 py-1 text-[11px] text-[#00ff66] font-sans">
                                      Level {person.level}
                                    </span>
                                    {isPrivileged && (
                                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-2 py-1 text-[11px] text-cyan-300 font-sans">
                                        {getWeightFromLevel(person.level)}%
                                      </span>
                                    )}
                                  </div>
                                </button>
                              );
                            })
                          ) : (
                            <div className="px-4 py-4 text-sm text-gray-400 font-sans">
                              No matching known personnel. Type a new name to add one.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleSignup}
                    disabled={!signupsOpen}
                    className="w-full lg:w-auto min-w-[170px] px-6 py-3 rounded-2xl border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Sign Up
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-[#00ff66]/20 bg-black/50 backdrop-blur-xl p-6 sm:p-8">
                <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-6">
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#00ff66]/70">
                      Selection Pool
                    </div>
                    <h2 className="text-xl text-[#00ff66] mt-1">
                      Current Signups
                    </h2>
                    <p className="mt-1 text-sm text-gray-400 font-sans">
                      {signups.length} total signups • {availableCount} remaining available for draw
                    </p>
                  </div>

                  <div className="relative w-full lg:w-[320px]">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#00ff66]/60" />
                    <input
                      type="text"
                      value={signupSearch}
                      onChange={(e) => setSignupSearch(e.target.value)}
                      placeholder="Search signed-up personnel..."
                      className="w-full pl-11 pr-4 py-3 rounded-2xl bg-black/70 border border-[#00ff66]/20 text-white placeholder:text-[#00ff66]/35 focus:outline-none focus:border-[#00ff66]/50 font-sans"
                    />
                  </div>
                </div>

                <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                  {filteredSignups.length === 0 ? (
                    <div className="rounded-2xl border border-[#00ff66]/10 bg-black/30 p-8 text-center">
                      <Users className="h-8 w-8 text-[#00ff66]/50 mx-auto mb-3" />
                      <div className="text-white">No signups found</div>
                      <div className="text-sm text-gray-500 mt-1 font-sans">
                        Add a signup or adjust the search above.
                      </div>
                    </div>
                  ) : (
                    filteredSignups.map((s) => (
                      <div
                        key={s.id}
                        className={`flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-2xl border transition-all ${
                          s.selected
                            ? "border-[#00ff66]/45 bg-[#00ff66]/10 shadow-[0_0_20px_rgba(0,255,102,0.08)]"
                            : "border-[#00ff66]/15 bg-black/45 hover:border-[#00ff66]/25"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-3 w-3 rounded-full ${
                              s.selected ? "bg-[#00ff66]" : "bg-gray-600"
                            }`}
                          />
                          <div>
                            <div
                              className={`text-base ${
                                s.selected ? "text-[#00ff66] font-semibold" : "text-white"
                              }`}
                            >
                              {s.name}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-2 font-sans">
                              <span className="text-xs px-2 py-1 rounded-full border border-[#00ff66]/20 text-gray-300">
                                Level {s.level ?? 1}
                              </span>
                              {isPrivileged && (
                                <span className="text-xs px-2 py-1 rounded-full border border-cyan-400/20 text-cyan-300">
                                  Weight {s.weight ?? 100}%
                                </span>
                              )}
                              {s.selected && (
                                <span className="text-xs px-2 py-1 rounded-full border border-[#00ff66]/25 text-[#00ff66]">
                                  Selected
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {isPrivileged && (
                          <button
                            onClick={() => handleRemove(s.id)}
                            className="inline-flex items-center gap-2 text-red-300 hover:text-red-200 text-sm font-sans"
                          >
                            <Trash2 className="h-4 w-4" />
                            Remove
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-6 sm:p-8">
                <div className="flex items-start gap-3 mb-6">
                  <div className="h-11 w-11 rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/10 flex items-center justify-center">
                    <Wand2 className="h-5 w-5 text-[#00ff66]" />
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.24em] text-[#00ff66]/70">
                      Results
                    </div>
                    <h2 className="text-xl text-[#00ff66] mt-1">
                      Selected Operators
                    </h2>
                    <p className="mt-1 text-sm text-gray-400 font-sans">
                      {selected.length} of {operation.slot_count} chosen for the current side operation.
                    </p>
                  </div>
                </div>

                {processing ? (
                  <div className="rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/5 py-14 text-center">
                    <div className="text-[#00ff66] animate-pulse text-lg">
                      Randomising weighted selection...
                    </div>
                    <div className="mt-2 text-sm text-gray-400 font-sans">
                      Calculating draw based on current level weighting
                    </div>
                  </div>
                ) : selected.length === 0 ? (
                  <div className="rounded-2xl border border-[#00ff66]/10 bg-black/30 p-8 text-center">
                    <Dice5 className="h-8 w-8 text-[#00ff66]/50 mx-auto mb-3" />
                    <div className="text-white">No operators selected yet</div>
                    <div className="text-sm text-gray-500 mt-1 font-sans">
                      Awaiting selection from the omnissiah...
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selected.map((s, index) => (
                      <div
                        key={s.id}
                        className="relative overflow-hidden p-5 rounded-2xl border border-[#00ff66]/35 bg-[linear-gradient(135deg,rgba(0,255,102,0.12),rgba(0,0,0,0.45))] shadow-[0_0_30px_rgba(0,255,102,0.08)]"
                      >
                        <div className="absolute -top-3 -left-3 bg-[#00ff66] text-black text-xs px-3 py-1 rounded-full font-bold">
                          #{index + 1}
                        </div>

                        <div className="text-lg text-[#00ff66] font-semibold">
                          ★ {s.name}
                        </div>

                        {isPrivileged && (
                          <div className="mt-3 flex flex-wrap gap-2 font-sans">
                            <span className="text-xs px-2 py-1 rounded-full border border-[#00ff66]/20 text-gray-200">
                              Previous Level: {s.level ?? 1}
                            </span>
                            <span className="text-xs px-2 py-1 rounded-full border border-cyan-400/20 text-cyan-300">
                              Previous Weight: {s.weight ?? 100}%
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {isPrivileged && (
                <div className="rounded-3xl border border-[#00ff66]/20 bg-black/55 backdrop-blur-xl p-6 sm:p-8 space-y-8">
                  <div>
                    <div className="flex items-start gap-3 mb-6">
                      <div className="h-11 w-11 rounded-2xl border border-cyan-400/20 bg-cyan-400/10 flex items-center justify-center">
                        <Settings2 className="h-5 w-5 text-cyan-300" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-cyan-300/70">
                          Logistics
                        </div>
                        <h3 className="text-xl text-cyan-300 mt-1">
                          Operation Settings
                        </h3>
                        <p className="mt-1 text-sm text-gray-400 font-sans">
                          Update the operation details and selection target.
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-sans">
                          Operation Title
                        </label>
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-black/70 border border-cyan-400/20 text-white focus:outline-none focus:border-cyan-300 font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-sans">
                          Operation Description
                        </label>
                        <textarea
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 rounded-2xl bg-black/70 border border-cyan-400/20 text-white focus:outline-none focus:border-cyan-300 resize-none font-sans"
                        />
                      </div>

                      <div>
                        <label className="block text-sm text-cyan-300 mb-2 font-sans">
                          Number of People to Select
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={editSlotCount}
                          onChange={(e) => setEditSlotCount(e.target.value)}
                          className="w-full px-4 py-3 rounded-2xl bg-black/70 border border-cyan-400/20 text-white focus:outline-none focus:border-cyan-300 font-sans"
                        />
                      </div>

                      <button
                        onClick={handleSaveOperationDetails}
                        disabled={savingOperation}
                        className="inline-flex items-center justify-center gap-2 px-4 py-3 border border-cyan-400 rounded-2xl text-cyan-300 hover:bg-cyan-400 hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Save className="h-4 w-4" />
                        {savingOperation ? "Saving..." : "Save Operation Details"}
                      </button>
                    </div>
                  </div>

                  <div className="border-t border-[#00ff66]/10 pt-8">
                    <div className="flex items-start gap-3 mb-6">
                      <div className="h-11 w-11 rounded-2xl border border-[#00ff66]/20 bg-[#00ff66]/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-[#00ff66]" />
                      </div>
                      <div>
                        <div className="text-xs uppercase tracking-[0.24em] text-[#00ff66]/70">
                          Operation State
                        </div>
                        <h3 className="text-xl text-[#00ff66] mt-1">
                          Signups and Randomiser
                        </h3>
                        <p className="mt-1 text-sm text-gray-400 font-sans">
                          Control whether signups are open and manage the current draw.
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button
                        onClick={handleToggleSignups}
                        disabled={togglingSignups}
                        className={`px-4 py-3 rounded-2xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                          signupsOpen
                            ? "border-red-500 text-red-300 hover:bg-red-500 hover:text-black"
                            : "border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black"
                        }`}
                      >
                        {togglingSignups
                          ? "Updating..."
                          : signupsOpen
                          ? "Close Signups"
                          : "Open Signups"}
                      </button>

                      {!operation.randomised ? (
                        <button
                          onClick={handleRandomise}
                          disabled={processing}
                          className="px-4 py-3 border border-[#00ff66] rounded-2xl text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {processing ? "Randomising..." : "Randomise"}
                        </button>
                      ) : (
                        <button
                          onClick={handleReset}
                          className="px-4 py-3 border border-red-500 rounded-2xl text-red-300 hover:bg-red-500 hover:text-black transition-all"
                        >
                          Reset Randomiser
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {!user && (
            <div className="max-w-3xl mx-auto mt-8 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200 font-sans">
              You are viewing the page without an authenticated session. Privileged controls may not appear.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
