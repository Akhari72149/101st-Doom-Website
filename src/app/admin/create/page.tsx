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
  const [skipRoleSync, setSkipRoleSync] = useState(false);
  const [importFromDiscord, setImportFromDiscord] = useState(false);

  /* ================= AUTH + ROLE CHECK ================= */

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      // Fetch ALL roles for this user
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const roleList = roles?.map((r) => r.role) || [];

      // Allow Admin OR Recruiter
      if (!hasRole(roleList, ["recruiter", "di", "nco"])) {
        router.replace("/");
        return;
      }

      // Load ranks
      const { data: rankData } = await supabase
        .from("ranks")
        .select("*")
        .order("rank_level", { ascending: true });

      setRanks(rankData || []);
      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= CREATE USER ================= */

  const createUser = async () => {
    if (!birthNumber || !name) {
      alert("Birth Number and Name are required!");
      return;
    }

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

    const { data, error } = await supabase
      .from("personnel")
      .insert([
        {
          rank_id: rankId || null,
          birth_number: birthNumber,
          name: name,
          discord_id: discordId || null,
          auto_role_sync: !skipRoleSync && !importFromDiscord,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert("Creation failed: " + error.message);
      return;
    }

    if (importFromDiscord && discordId) {
      const { error: importError } =
        await supabase.functions.invoke("discord-full-import", {
          body: {
            discord_id: discordId,
            personnel_id: data.id,
          },
        });

      if (importError) {
        alert("Discord import failed: " + importError.message);
        return;
      }
    }

    alert("✅ Personnel Created");

    setRankId("");
    setBirthNumber("");
    setName("");
    setDiscordId("");
    setSkipRoleSync(false);
    setImportFromDiscord(false);
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05080f] text-[#00e5ff] font-orbitron">
        Checking permissions...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-[#e6faff] p-10 font-orbitron tracking-wide">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 border border-[#00e5ff] px-4 py-2 rounded-xl hover:bg-[#00e5ff] hover:text-black transition shadow-[0_0_15px_rgba(0,229,255,0.4)]"
      >
        ← Back
      </button>

      <h1 className="text-4xl font-bold mb-8 text-[#00e5ff] tracking-widest">
        Create New Personnel
      </h1>

      {/* Discord ID */}
      <div className="mb-6">
        <label className="block mb-2 text-sm tracking-widest text-gray-300">
          Discord ID
        </label>

        <input
          type="text"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder="Enter Discord User ID"
          className="bg-black border border-[#00e5ff] p-3 w-full rounded-xl focus:outline-none focus:ring-2 focus:ring-[#00e5ff]"
        />
      </div>

      {/* Checkboxes */}
      <div className="mb-4 flex flex-col gap-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={skipRoleSync}
            onChange={(e) => setSkipRoleSync(e.target.checked)}
          />
          Skip Discord Role Assignment
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={importFromDiscord}
            onChange={(e) => setImportFromDiscord(e.target.checked)}
          />
          Import Rank + Certifications From Discord
        </label>
      </div>

      {/* Rank */}
      <div className="mb-6">
        <label className="block mb-2 text-sm tracking-widest text-gray-300">
          Rank (Optional)
        </label>

        <select
          value={rankId}
          onChange={(e) => setRankId(e.target.value)}
          className="bg-black border border-[#00e5ff] p-3 w-full rounded-xl"
        >
          <option value="">-- Select Rank --</option>
          {ranks.map((rank) => (
            <option key={rank.id} value={rank.id}>
              {rank.name}
            </option>
          ))}
        </select>
      </div>

      {/* Birth Number */}
      <div className="mb-6">
        <label className="block mb-2 text-sm tracking-widest text-gray-300">
          Birth Number
        </label>

        <input
          type="text"
          value={birthNumber}
          onChange={(e) => setBirthNumber(e.target.value)}
          className="bg-black border border-[#00e5ff] p-3 w-full rounded-xl"
        />
      </div>

      {/* Name */}
      <div className="mb-6">
        <label className="block mb-2 text-sm tracking-widest text-gray-300">
          Name
        </label>

        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-black border border-[#00e5ff] p-3 w-full rounded-xl"
        />
      </div>

      {/* Create Button */}
      <button
        onClick={createUser}
        className="px-8 py-3 border border-[#00e5ff] text-[#00e5ff] rounded-xl hover:bg-[#00e5ff] hover:text-black transition"
      >
        Create Personnel
      </button>

    </div>
  );
}