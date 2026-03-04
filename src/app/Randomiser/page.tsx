"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function SideOperationPage() {
  const [user, setUser] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [operation, setOperation] = useState<any>(null);
  const [signups, setSignups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [signupsOpen, setSignupsOpen] = useState<boolean>(true);
  

  /* ✅ Processing State (Replaces Animation) */
  const [processing, setProcessing] = useState(false);

  /* ✅ Name Input */
  const [name, setName] = useState("");

  const isPrivileged =
    roles.includes("admin") || roles.includes("logistics");

  /* ================= AUTH ================= */

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

  /* ================= LOAD OPERATION ================= */

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: op } = await supabase
      .from("side_operations")
      .select("*")
      .limit(1)
      .single();

    if (!op) return;

    const { data: signupData } = await supabase
      .from("side_operation_signups")
      .select("*")
      .eq("operation_id", op.id);

    setOperation(op);
    setSignupsOpen(op.open);
    setSignups(signupData || []);
    setLoading(false);
  };

  /* ================= SIGN UP ================= */

  const handleSignup = async () => {
    if (!name.trim() || !operation || !signupsOpen) return;

    await supabase.from("side_operation_signups").insert({
      operation_id: operation.id,
      name: name.trim(),
      selected: false,
    });

    setName("");
    fetchData();
  };

  /* ================= REMOVE (ADMIN ONLY) ================= */

  const handleRemove = async (id: string) => {
    if (!isPrivileged) return;

    await supabase
      .from("side_operation_signups")
      .delete()
      .eq("id", id);

    fetchData();
  };

  /* ================= RANDOMISE ================= */

  const handleRandomise = async () => {
    if (!isPrivileged || !operation) return;

    setProcessing(true);

    const { data: latestSignups } = await supabase
      .from("side_operation_signups")
      .select("*")
      .eq("operation_id", operation.id);

    const freshSignups = latestSignups || [];

    const available = freshSignups.filter((s) => !s.selected);

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const chosen = shuffled.slice(0, operation.slot_count);

    /* 🔥 Fake processing delay */
    await new Promise((resolve) => setTimeout(resolve, 1500));

    /* ✅ Update DB */
    for (const person of chosen) {
      await supabase
        .from("side_operation_signups")
        .update({ selected: true })
        .eq("id", person.id);
    }

    await supabase
      .from("side_operations")
      .update({ randomised: true })
      .eq("id", operation.id);

    setProcessing(false);
    fetchData();
  };

  /* ================= RESET ================= */

  const handleReset = async () => {
    if (!isPrivileged || !operation) return;

    await supabase
      .from("side_operation_signups")
      .update({ selected: false })
      .eq("operation_id", operation.id);

    await supabase
      .from("side_operations")
      .update({ randomised: false })
      .eq("id", operation.id);

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

      {/* ================= BACKGROUND ================= */}

      <div className="fixed inset-0 -z-10">
        <div
          className="absolute inset-0 bg-center bg-cover opacity-15"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/95 via-black/85 to-black/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,100,0.08)_0%,transparent_70%)]" />
      </div>

      {/* ================= HEADER ================= */}

      <div className="max-w-4xl mx-auto mb-10 p-6 rounded-2xl border border-[#00ff66]/40 bg-black/60 backdrop-blur-xl">
        <h1 className="text-3xl text-[#00ff66] tracking-widest">
          {operation.title}
        </h1>

        <p className="mt-4 text-gray-300">
  {operation.description}
</p>
{/* ✅ Signups Status (OUTSIDE P TAG) */}
{!signupsOpen && (
  <div className="mt-3 text-red-400 text-sm font-semibold">
    🚫 Signups are currently closed.
  </div>
)}
      </div>

      {/* ================= SIGNUP SECTION ================= */}

      <div className="max-w-4xl mx-auto p-6 rounded-2xl border border-[#00ff66]/30 bg-black/50 backdrop-blur-md">

        <div className="flex gap-4 mb-6">
          <input
            disabled={!signupsOpen}
            type="text"
            placeholder="Enter your name..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`flex-1 px-4 py-2 rounded-lg bg-black/70 border border-[#00ff66]/40 text-[#00ff66] focus:outline-none focus:border-[#00ff66]
  ${!signupsOpen ? "opacity-50 cursor-not-allowed" : ""}`}
          />

          <button
            onClick={handleSignup}
            className="px-6 py-2 border border-[#00ff66] rounded-lg text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition-all"
          >
            Sign Up
          </button>
        </div>

        <h2 className="text-[#00ff66] mb-4 tracking-wider">
          Volunteers ({signups.length})
        </h2>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {signups.map((s) => (
            <div
              key={s.id}
              className="flex justify-between items-center p-3 rounded-xl bg-black/60 border border-[#00ff66]/20"
            >
              <span className={s.selected ? "text-[#00ff66] font-semibold" : ""}>
                {s.name}
              </span>

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

      {/* ================= SELECTED OPERATORS ================= */}

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
              Awaiting selection from the omnisiah...
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
              </div>
            ))
          )}

        </div>
      </div>

      {/* ================= ADMIN CONTROLS ================= */}

      {isPrivileged && (
        <div className="max-w-4xl mx-auto mt-10 p-6 rounded-2xl border border-[#00ff66]/40 bg-black/60 backdrop-blur-xl">

          <h3 className="text-[#00ff66] mb-4 tracking-wider">
            Logistics Control Panel
          </h3>

          <div className="flex gap-4">

            {/* ✅ Toggle Signups Open/Closed */}
<button
  onClick={async () => {
    if (!operation) return;

    const newState = !signupsOpen;

    await supabase
      .from("side_operations")
      .update({ open: newState })
      .eq("id", operation.id);

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