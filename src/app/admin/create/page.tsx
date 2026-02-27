"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { hasRole } from "@/lib/permissions";

export default function CreatePersonnel() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [ranks, setRanks] = useState<any[]>([]);

  const [rankId, setRankId] = useState("");
  const [birthNumber, setBirthNumber] = useState("");
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [teamspeakId, setTeamspeakId] = useState(""); // ✅ NEW

  const [skipRoleSync, setSkipRoleSync] = useState(false);
  const [importFromDiscord, setImportFromDiscord] = useState(false);
  const [createdAt, setCreatedAt] = useState<string>(""); 

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

      if (!hasRole(roleList, ["recruiter", "di", "nco"])) {
        router.replace("/");
        return;
      }

      const { data: rankData } = await supabase
        .from("ranks")
        .select("*")
        .order("rank_level", { ascending: true });

      setRanks(rankData || []);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= CREATE ================= */

  const createUser = async () => {
    if (!birthNumber || !name) {
      alert("Birth Number and Name are required!");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    /* ================= DUPLICATE CHECKS ================= */

    const { data: nameCheck } = await supabase
      .from("personnel")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (nameCheck) {
      alert("❌ Name already exists");
      return;
    }

    const { data: birthCheck } = await supabase
      .from("personnel")
      .select("id")
      .eq("birth_number", birthNumber)
      .maybeSingle();

    if (birthCheck) {
      alert("❌ Birth number already exists");
      return;
    }

    

    /* ================= CREATE PERSONNEL ================= */

    const { data, error } = await supabase
      .from("personnel")
      .insert([
        {
          rank_id: rankId || null,
          birth_number: birthNumber,
          name,
          discord_id: discordId || null,
          ts_id: teamspeakId || null, // ✅ NEW COLUMN
          auto_role_sync: !skipRoleSync && !importFromDiscord,
          created_at: createdAt || null,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    /* ================= 🔥 AUDIT LOG ================= */

    await supabase.from("audit_logs").insert([
      {
        user_id: user.id,
        target_personnel_id: data.id,
        action: "NEW_MEMBER",
        details: "New member added to system",
      },
    ]);

    /* ================= DISCORD IMPORT ================= */

    if (importFromDiscord && discordId) {
      const { error: importError } =
        await supabase.functions.invoke("discord-full-import", {
          body: {
            discord_id: discordId,
            personnel_id: data.id,
          },
        });

      if (importError) {
        alert(importError.message);
        return;
      }
    }

    alert("✅ Personnel Created");

    setRankId("");
    setBirthNumber("");
    setName("");
    setDiscordId("");
    setTeamspeakId("");
    setSkipRoleSync(false);
    setImportFromDiscord(false);
    setCreatedAt("");
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#eafff2] p-10">

      {/* BACK */}
      <button
        onClick={() => router.push("/pcs")}
        className="mb-10 px-5 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10"
      >
        ← Back
      </button>

      <div className="max-w-3xl mx-auto p-10 rounded-3xl bg-black/50 backdrop-blur-xl border border-[#00ff66]/30">

        <h1 className="text-3xl font-bold text-[#00ff66] mb-8 tracking-widest">
          Create New Personnel
        </h1>

        {/* DISCORD ID */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Discord ID
          </label>
          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        {/* ✅ TEAMSPEAK ID (NEW) */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Teamspeak ID (Optional for now, will be required soon)
          </label>
          <input
            type="text"
            value={teamspeakId}
            onChange={(e) => setTeamspeakId(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        {/* CHECKBOXES */}
        <div className="mb-6 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={skipRoleSync}
              onChange={(e) => setSkipRoleSync(e.target.checked)}
              className="accent-[#00ff66]"
            />
            Skip Discord Role Assignment
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={importFromDiscord}
              onChange={(e) => setImportFromDiscord(e.target.checked)}
              className="accent-[#00ff66]"
            />
            Import Rank + Certifications From Discord
          </label>
        </div>

        {/* RANK */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Rank (Don't select if importing)
          </label>

          <select
            value={rankId}
            onChange={(e) => setRankId(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          >
            <option value="">-- Select Rank --</option>
            {ranks.map((rank) => (
              <option key={rank.id} value={rank.id}>
                {rank.name}
              </option>
            ))}
          </select>
        </div>

        {/* BIRTH NUMBER */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Birth Number
          </label>

          <input
            type="text"
            value={birthNumber}
            onChange={(e) => setBirthNumber(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        {/* NAME */}
        <div className="mb-8">
          <label className="block mb-2 text-sm text-gray-300">
            Name
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        {/* CREATED AT */}
<div className="mb-6">
  <label className="block mb-2 text-sm text-gray-300">
    Created At
  </label>

  <div className="flex gap-3">
    <input
      type="text"
      placeholder="Blank until set..."
      value={createdAt}
      readOnly
      className="flex-1 p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
    />

    <button
      type="button"
      onClick={() => setCreatedAt(new Date().toISOString())}
      className="px-6 rounded-xl bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black"
    >
      Set Now
    </button>
  </div>
</div>

        {/* CREATE BUTTON */}
        <button
          onClick={createUser}
          className="w-full py-4 rounded-xl bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] font-bold hover:bg-[#00ff66] hover:text-black"
        >
          Create Personnel
        </button>

      </div>
    </div>
  );
}