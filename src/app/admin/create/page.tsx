"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function CreatePersonnel() {
  const router = useRouter();

  /* ================= AUTH ================= */

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [ranks, setRanks] = useState<any[]>([]);

  /* ================= STATES ================= */

  const [rankId, setRankId] = useState("");
  const [birthNumber, setBirthNumber] = useState("");
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [skipRoleSync, setSkipRoleSync] = useState(false);
  const [importFromDiscord, setImportFromDiscord] = useState(false);

  /* ================= AUTH + LOAD RANKS ================= */

  useEffect(() => {
    const checkAdmin = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!role || role.role !== "admin") {
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

    checkAdmin();
  }, [router]);

  /* ================= CREATE USER ================= */

  const createUser = async () => {
    if (!birthNumber || !name) {
      alert("Birth Number and Name are required!");
      return;
    }

    /* ---- Duplicate Checks ---- */

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

    /* ---- Insert Person ---- */

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

    /* =====================================================
       🔥 IMPORT FROM DISCORD (IF SELECTED)
    ======================================================*/

    if (importFromDiscord && discordId) {
  const { error: importError } = await supabase.functions.invoke(
    "discord-full-import",
    {
      body: {
        discord_id: discordId,
        personnel_id: data.id,
      },
    }
  );

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

  /* ================= LOADING ================= */

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Checking permissions...</p>
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="p-8 text-white">

      <button
        onClick={() => router.push("/")}
        className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-6">
        Create New Personnel
      </h1>

      {/* ================= DISCORD ID ================= */}

      <div className="mb-4">
        <label className="block mb-2">
          Discord ID
        </label>
        <input
          type="text"
          value={discordId}
          onChange={(e) => setDiscordId(e.target.value)}
          placeholder="Enter Discord User ID"
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= SKIP ROLE SYNC ================= */}

      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={skipRoleSync}
          onChange={(e) => setSkipRoleSync(e.target.checked)}
        />
        <label>Skip Discord Role Assignment</label>
      </div>

      {/* ================= IMPORT FROM DISCORD ================= */}

      <div className="mb-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={importFromDiscord}
          onChange={(e) => setImportFromDiscord(e.target.checked)}
        />
        <label>Import Rank + Certifications From Discord</label>
      </div>

      {/* ================= RANK ================= */}

      <div className="mb-4">
        <label className="block mb-2">Rank (Optional if importing)</label>
        <select
          value={rankId}
          onChange={(e) => setRankId(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        >
          <option value="">-- Select Rank --</option>
          {ranks.map((rank) => (
            <option key={rank.id} value={rank.id}>
              {rank.name}
            </option>
          ))}
        </select>
      </div>

      {/* ================= BIRTH NUMBER ================= */}

      <div className="mb-4">
        <label className="block mb-2">Birth Number</label>
        <input
          type="text"
          value={birthNumber}
          onChange={(e) => setBirthNumber(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= NAME ================= */}

      <div className="mb-4">
        <label className="block mb-2">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
        />
      </div>

      {/* ================= CREATE BUTTON ================= */}

      <button
        onClick={createUser}
        className="bg-[#002700] px-6 py-2 hover:bg-[#004d00]"
      >
        Create Personnel
      </button>

    </div>
  );
}