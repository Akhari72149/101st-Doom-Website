"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [operation, setOperation] = useState<any>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [knownPeople, setKnownPeople] = useState<LevelRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsOpen, setSignupsOpen] = useState<boolean>(true);
  const [processing, setProcessing] = useState(false);
  const [name, setName] = useState("");
  const [showNameDropdown, setShowNameDropdown] = useState(false);

  const nameDropdownRef = useRef<HTMLDivElement | null>(null);

  const isPrivileged =
    roles.includes("admin") || roles.includes("logistics");

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      if (data.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        setRoles(roleData?.map((r) => r.role) || []);
      }
    };

    loadUser();
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

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

  const fetchKnownPeople = async () => {
    const { data, error } = await supabase
      .from("side_operation_levels")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      console.error("FETCH KNOWN PEOPLE ERROR:", error);
      return [];
    }

    return (data || []) as LevelRow[];
  };

  const fetchLevelsMap = async (names: string[]) => {
    if (names.length === 0) return new Map<string, LevelRow>();

    const uniqueNames = Array.from(new Set(names.map((n) => n.trim())));

    const { data, error } = await supabase
      .from("side_operation_levels")
      .select("*")
      .in("name", uniqueNames);

    if (error) {
      console.error("FETCH LEVELS ERROR:", error);
      return new Map<string, LevelRow>();
    }

    return new Map(
      (data || []).map((row) => [normaliseName(row.name), row as LevelRow])
    );
  };

  const fetchData = async () => {
    setLoading(true);

    const { data: op, error: opError } = await supabase
      .from("side_operations")
      .select("*")
      .limit(1)
      .single();

    if (opError) {
      console.error("FETCH OPERATION ERROR:", opError);
      setLoading(false);
      return;
    }

    if (!op) {
      setLoading(false);
      return;
    }

    const { data: signupData, error: signupError } = await supabase
      .from("side_operation_signups")
      .select("*")
      .eq("operation_id", op.id);

    if (signupError) {
      console.error("FETCH SIGNUPS ERROR:", signupError);
      setLoading(false);
      return;
    }

    const rawSignups: Signup[] = signupData || [];
    const levelsMap = await fetchLevelsMap(rawSignups.map((s) => s.name));
    const people = await fetchKnownPeople();

    const enrichedSignups = rawSignups.map((signup) => {
      const matchedLevel = levelsMap.get(normaliseName(signup.name));
      const level = matchedLevel?.level ?? 1;

      return {
        ...signup,
        level,
        weight: getWeightFromLevel(level),
      };
    });

    setKnownPeople(people);
    setOperation(op);
    setSignupsOpen(op.open);
    setSignups(enrichedSignups);
    setLoading(false);
  };

  const filteredKnownPeople = useMemo(() => {
    const term = normaliseName(name);

    if (!term) return knownPeople.slice(0, 12);

    return knownPeople
      .filter((person) => normaliseName(person.name).includes(term))
      .slice(0, 12);
  }, [knownPeople, name]);

  const handleSignup = async () => {
    if (!name.trim() || !operation || !signupsOpen) return;

    const cleanedName = name.trim();
    const normalised = normaliseName(cleanedName);

    const alreadySignedUp = signups.some(
      (s) => normaliseName(s.name) === normalised
    );

    if (alreadySignedUp) {
      alert("You are already signed up.");
      return;
    }

    const { error } = await supabase.from("side_operation_signups").insert({
      operation_id: operation.id,
      name: cleanedName,
      selected: false,
    });

    if (error) {
      console.error("SIGNUP INSERT ERROR:", error);
      return;
    }

    setName("");
    setShowNameDropdown(false);
    fetchData();
  };

  const handleRemove = async (id: string) => {
    if (!isPrivileged) return;

    const { error } = await supabase
      .from("side_operation_signups")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("REMOVE SIGNUP ERROR:", error);
      return;
    }

    fetchData();
  };

  function weightedPick<T extends { id: string; weight: number }>(
    items: T[]
  ): T | null {
    const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
    if (totalWeight <= 0) return null;

    let random = Math.random() * totalWeight;

    for (const item of items) {
      random -= item.weight;
      if (random <= 0) return item;
    }

    return items[items.length - 1] || null;
  }

  function pickMultipleWeighted<T extends { id: string; weight: number }>(
    items: T[],
    count: number
  ): T[] {
    const pool = [...items];
    const chosen: T[] = [];

    while (chosen.length < count && pool.length > 0) {
      const picked = weightedPick(pool);
      if (!picked) break;

      chosen.push(picked);

      const index = pool.findIndex((p) => p.id === picked.id);
      if (index !== -1) pool.splice(index, 1);
    }

    return chosen;
  }

  const incrementLevelsForChosen = async (chosen: Signup[]) => {
    for (const person of chosen) {
      const { data: existing, error: fetchError } = await supabase
        .from("side_operation_levels")
        .select("*")
        .eq("name", person.name)
        .maybeSingle();

      if (fetchError) {
        console.error("FETCH PERSON LEVEL ERROR:", fetchError);
        continue;
      }

      if (!existing) {
        const { error: insertError } = await supabase
          .from("side_operation_levels")
          .insert({
            name: person.name,
            level: 2,
          });

        if (insertError) {
          console.error("INSERT PERSON LEVEL ERROR:", insertError);
        }

        continue;
      }

      const newLevel = Math.min((existing.level ?? 1) + 1, 4);

      const { error: updateError } = await supabase
        .from("side_operation_levels")
        .update({ level: newLevel })
        .eq("id", existing.id);

      if (updateError) {
        console.error("UPDATE PERSON LEVEL ERROR:", updateError);
      }
    }
  };

  const handleRandomise = async () => {
    if (!isPrivileged || !operation) return;

    setProcessing(true);

    try {
      const { data: latestSignups, error: signupFetchError } = await supabase
        .from("side_operation_signups")
        .select("*")
        .eq("operation_id", operation.id);

      if (signupFetchError) {
        console.error("FETCH LATEST SIGNUPS ERROR:", signupFetchError);
        return;
      }

      const freshSignups: Signup[] = latestSignups || [];
      const available = freshSignups.filter((s) => !s.selected);

      if (available.length === 0) {
        return;
      }

      const levelsMap = await fetchLevelsMap(available.map((s) => s.name));

      const weightedPool: (Signup & { level: number; weight: number })[] =
        available.map((signup) => {
          const matchedLevel = levelsMap.get(normaliseName(signup.name));
          const level = matchedLevel?.level ?? 1;
          const weight = getWeightFromLevel(level);

          return {
            ...signup,
            level,
            weight,
          };
        });

      const chosen = pickMultipleWeighted(weightedPool, operation.slot_count);

      await new Promise((resolve) => setTimeout(resolve, 1500));

      for (const person of chosen) {
        const { error } = await supabase
          .from("side_operation_signups")
          .update({ selected: true })
          .eq("id", person.id);

        if (error) {
          console.error("SIGNUP UPDATE ERROR:", error);
          return;
        }
      }

      const { error: opUpdateError } = await supabase
        .from("side_operations")
        .update({ randomised: true })
        .eq("id", operation.id);

      if (opUpdateError) {
        console.error("OPERATION UPDATE ERROR:", opUpdateError);
        return;
      }

      await incrementLevelsForChosen(chosen);

      fetchData();
    } catch (error) {
      console.error("RANDOMISE ERROR:", error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReset = async () => {
    if (!isPrivileged || !operation) return;

    const { error: resetSignupError } = await supabase
      .from("side_operation_signups")
      .update({ selected: false })
      .eq("operation_id", operation.id);

    if (resetSignupError) {
      console.error("RESET SIGNUPS ERROR:", resetSignupError);
      return;
    }

    const { error: resetOpError } = await supabase
      .from("side_operations")
      .update({ randomised: false })
      .eq("id", operation.id);

    if (resetOpError) {
      console.error("RESET OPERATION ERROR:", resetOpError);
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

  if (loading || !operation) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading operation...
      </div>
    );
  }

  const selected = signups.filter((s) => s.selected);

  return (
    <div className="relative min-h-screen text-white font-orbitron p-10">
      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-15"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/85 to-black/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,100,0.08)_0%,transparent_70%)]" />
      </div>

      <div className="max-w-4xl mx-auto mb-10 p-6 rounded-2xl border border-[#00ff66]/40 bg-black/60 backdrop-blur-xl">
        <h1 className="text-3xl text-[#00ff66] tracking-widest">
          {operation.title}
        </h1>

        <p className="mt-4 text-gray-300">{operation.description}</p>

        {!signupsOpen && (
          <div className="mt-3 text-red-400 text-sm font-semibold">
            🚫 Signups are currently closed.
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50 backdrop-blur-md">
        <div className="flex gap-4 mb-6 items-start">
          <div className="relative flex-1" ref={nameDropdownRef}>
            <input
              disabled={!signupsOpen}
              type="text"
              placeholder="Enter or select a name..."
              value={name}
              onFocus={() => setShowNameDropdown(true)}
              onChange={(e) => {
                setName(e.target.value);
                setShowNameDropdown(true);
              }}
              className={`w-full px-4 py-2 rounded-lg bg-black/70 border border-[#00ff66]/40 text-[#00ff66] placeholder:text-[#00ff66]/45 focus:outline-none focus:border-[#00ff66] focus:ring-1 focus:ring-[#00ff66]/40
                ${!signupsOpen ? "opacity-50 cursor-not-allowed" : ""}`}
            />

            {signupsOpen && showNameDropdown && (
              <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-[#00ff66]/30 bg-black/95 shadow-[0_0_25px_rgba(0,255,102,0.12)] backdrop-blur-xl">
                <div className="border-b border-[#00ff66]/15 px-3 py-2 text-xs uppercase tracking-[0.2em] text-[#00ff66]/70">
                  Personnel Registry
                </div>

                <div className="max-h-64 overflow-y-auto">
                  {filteredKnownPeople.length > 0 ? (
                    filteredKnownPeople.map((person) => (
                      <button
                        key={person.id}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setName(person.name);
                          setShowNameDropdown(false);
                        }}
                        className="flex w-full items-center justify-between border-b border-[#00ff66]/10 px-4 py-3 text-left transition-all hover:bg-[#00ff66]/10"
                      >
                        <span className="text-sm text-white">
                          {person.name}
                        </span>
                        <span className="rounded-full border border-[#00ff66]/30 bg-[#00ff66]/10 px-2 py-1 text-[11px] text-[#00ff66]">
                          Level {person.level}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-4 text-sm text-gray-400">
                      No matching known personnel. Type a new name to add one.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleSignup}
            className="px-6 py-2 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all"
          >
            Sign Up
          </button>
        </div>

        <h2 className="text-[#00ff66] mb-4 tracking-wider">
          Current Sign-Up Count ({signups.length})
        </h2>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {signups.map((s) => (
            <div
              key={s.id}
              className="flex justify-between items-center p-3 rounded-xl bg-black/60 border border-[#00ff66]/20"
            >
              <div className="flex items-center gap-3">
                <span className={s.selected ? "text-[#00ff66] font-semibold" : ""}>
                  {s.name}
                </span>

                {isPrivileged && (
                  <span className="text-xs px-2 py-1 rounded-full border border-[#00ff66]/30 text-gray-300">
                    Level {s.level ?? 1}
                  </span>
                )}
              </div>

              {isPrivileged && (
                <button
                  onClick={() => handleRemove(s.id)}
                  className="text-red-400 hover:text-red-500 text-xs"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto mt-8 p-6 rounded-2xl border border-[#00ff66]/40 bg-black/60 backdrop-blur-xl">
        <h2 className="text-[#00ff66] mb-6 tracking-widest text-xl flex justify-between items-center">
          <span>Selected Operators</span>

          <span className="text-xs text-gray-400">
            {selected.length} / {operation.slot_count}
          </span>
        </h2>

        <div className="space-y-4">
          {processing ? (
            <div className="text-center text-[#00ff66] animate-pulse py-10 text-lg">
              🔄 Randomising Selection...
            </div>
          ) : selected.length === 0 ? (
            <div className="text-gray-500 text-sm">
              Awaiting selection from the omnissiah...
            </div>
          ) : (
            selected.map((s, index) => (
              <div
                key={s.id}
                className="relative p-4 rounded-xl border border-[#00ff66] bg-[#00ff66]/10"
              >
                <div className="absolute -top-3 -left-3 bg-[#00ff66] text-black text-xs px-3 py-1 rounded-full font-bold">
                  #{index + 1}
                </div>

                <div className="text-lg text-[#00ff66] font-semibold">
                  ★ {s.name}
                </div>

                {isPrivileged && (
                  <div className="mt-2 text-xs text-gray-300">
                    Previous Level: {s.level ?? 1}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {isPrivileged && (
        <div className="max-w-4xl mx-auto mt-10 p-6 rounded-2xl border border-[#00ff66]/40 bg-black/60 backdrop-blur-xl">
          <h3 className="text-[#00ff66] mb-4 tracking-wider">
            Logistics Control Panel
          </h3>

          <div className="flex gap-4">
            <button
              onClick={async () => {
                if (!operation) return;

                const newState = !signupsOpen;

                const { error } = await supabase
                  .from("side_operations")
                  .update({ open: newState })
                  .eq("id", operation.id);

                if (error) {
                  console.error("TOGGLE SIGNUPS ERROR:", error);
                  return;
                }

                setSignupsOpen(newState);
                setOperation((prev: any) => ({
                  ...prev,
                  open: newState,
                }));
              }}
              className={`flex-1 px-4 py-2 rounded-lg border transition-all
                ${
                  signupsOpen
                    ? "border-red-500 text-red-400 hover:bg-red-500 hover:text-black"
                    : "border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black"
                }`}
            >
              {signupsOpen ? "Close Signups" : "Open Signups"}
            </button>

            {!operation.randomised && (
              <button
                onClick={handleRandomise}
                className="flex-1 px-4 py-2 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all"
              >
                Randomise
              </button>
            )}

            {operation.randomised && (
              <button
                onClick={handleReset}
                className="flex-1 px-4 py-2 border border-red-500 rounded-lg text-red-400 hover:bg-red-500 hover:text-black transition-all"
              >
                Reset Randomiser
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}