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
          name,
          discord_id: discordId || null,
          auto_role_sync: !skipRoleSync && !importFromDiscord,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
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
        alert(importError.message);
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
        className="
          mb-10 px-5 py-2 rounded-lg
          border border-[#00ff66]/50
          text-[#00ff66]
          font-semibold
          transition-all duration-200
          hover:bg-[#00ff66]/10
          hover:scale-105
        "
      >
        ← Back
      </button>

      {/* MAIN CARD */}
      <div className="
        max-w-3xl mx-auto
        p-10 rounded-3xl
        bg-black/50 backdrop-blur-xl
        border border-[#00ff66]/30
        shadow-[0_0_60px_rgba(0,255,100,0.15)]
      ">

        <h1 className="text-3xl font-bold text-[#00ff66] mb-8 tracking-widest">
          Create New Personnel
        </h1>

        {/* DISCORD */}
        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Discord ID
          </label>

          <input
            type="text"
            value={discordId}
            onChange={(e) => setDiscordId(e.target.value)}
            placeholder="Enter Discord User ID"
            className="
              w-full p-4 rounded-xl
              bg-black/60
              border border-[#00ff66]/30
              text-[#00ff66]
              placeholder:text-[#00ff66]/30
              focus:border-[#00ff66]
              focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
              transition-all
            "
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
            className="
              w-full p-4 rounded-xl
              bg-black/60
              border border-[#00ff66]/30
              text-[#00ff66]
              focus:border-[#00ff66]
              transition-all
            "
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
            className="
              w-full p-4 rounded-xl
              bg-black/60
              border border-[#00ff66]/30
              text-[#00ff66]
              focus:border-[#00ff66]
              transition-all
            "
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
            className="
              w-full p-4 rounded-xl
              bg-black/60
              border border-[#00ff66]/30
              text-[#00ff66]
              focus:border-[#00ff66]
              transition-all
            "
          />
        </div>

        {/* CREATE BUTTON */}
        <button
          onClick={createUser}
          className="
            w-full py-4 rounded-xl
            bg-[#00ff66]/10
            border border-[#00ff66]
            text-[#00ff66]
            font-bold
            tracking-wide
            transition-all duration-300
            hover:bg-[#00ff66]
            hover:text-black
            hover:scale-105
            hover:shadow-[0_0_30px_rgba(0,255,100,0.7)]
          "
        >
          Create Personnel
        </button>

      </div>
    </div>
  );
}