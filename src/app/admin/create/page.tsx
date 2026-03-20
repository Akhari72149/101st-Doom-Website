"use client";

import { useEffect, useState } from "react";
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

export default function CreatePersonnel() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [ranks, setRanks] = useState<RankRow[]>([]);

  const [rankId, setRankId] = useState("");
  const [birthNumber, setBirthNumber] = useState("");
  const [name, setName] = useState("");
  const [discordId, setDiscordId] = useState("");
  const [teamspeakId, setTeamspeakId] = useState("");

  const [skipRoleSync, setSkipRoleSync] = useState(false);
  const [importFromDiscord, setImportFromDiscord] = useState(false);
  const [createdAt, setCreatedAt] = useState<string>("");

  const PROCESSOR_CERT_IDS = [
    "079827bf-8b8f-4f37-9b6c-664942689a0a",
    "c579ef59-7010-4bcc-bcd4-9cd448ac5bf5",
    "8eff73b9-9793-452a-b77d-c16cde5b9b4c",
  ];

  const [processors, setProcessors] = useState<ProcessorRow[]>([]);
  const [selectedProcessor, setSelectedProcessor] = useState("");

  useEffect(() => {
    const loadProcessors = async () => {
      const { data: certPersonnel, error: certError } = await supabase
        .from("personnel_certifications")
        .select("personnel_id")
        .in("certification_id", PROCESSOR_CERT_IDS);

      if (certError) {
        console.error("Failed to load processor certifications:", certError);
        setProcessors([]);
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
        setProcessors([]);
        return;
      }

      const activeProcessors = (personnelData || []).filter((person) => {
        const status = (person.status || "").trim().toLowerCase();
        return status !== "removed" && status !== "retired";
      });

      setProcessors(activeProcessors);
    };

    loadProcessors();
  }, [importFromDiscord]);

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

      const { data: rankData, error: rankError } = await supabase
        .from("ranks")
        .select("*")
        .order("rank_level", { ascending: true });

      if (rankError) {
        console.error("Failed to load ranks:", rankError);
        setRanks([]);
      } else {
        setRanks(rankData || []);
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  const isInactiveStatus = (status: string | null | undefined) => {
    const clean = (status || "").trim().toLowerCase();
    return clean === "removed" || clean === "retired";
  };

  const createUser = async () => {
    if (!selectedProcessor) {
      alert("You must select who processed this form.");
      return;
    }

    if (!birthNumber.trim() || !name.trim()) {
      alert("Birth Number and Name are required!");
      return;
    }

    const cleanName = name.trim();
    const cleanBirthNumber = birthNumber.trim();
    const cleanDiscordId = discordId.trim();
    const cleanTeamspeakId = teamspeakId.trim();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    /* ================= DUPLICATE CHECKS ================= */

    const { data: matchingNames, error: nameCheckError } = await supabase
      .from("personnel")
      .select("id, status")
      .eq("name", cleanName);

    if (nameCheckError) {
      alert("Failed to check existing names: " + nameCheckError.message);
      return;
    }

    const activeNameDuplicate = (matchingNames || []).find(
      (row: PersonnelDuplicateRow) => !isInactiveStatus(row.status)
    );

    if (activeNameDuplicate) {
      alert("❌ Name already exists on an active personnel record");
      return;
    }

    const { data: matchingBirthNumbers, error: birthCheckError } = await supabase
      .from("personnel")
      .select("id, status")
      .eq("birth_number", cleanBirthNumber);

    if (birthCheckError) {
      alert("Failed to check existing birth numbers: " + birthCheckError.message);
      return;
    }

    const activeBirthDuplicate = (matchingBirthNumbers || []).find(
      (row: PersonnelDuplicateRow) => !isInactiveStatus(row.status)
    );

    if (activeBirthDuplicate) {
      alert("❌ Birth number already exists on an active personnel record");
      return;
    }

    /* ================= CREATE PERSONNEL ================= */

    const { data, error } = await supabase
      .from("personnel")
      .insert([
        {
          rank_id: rankId || null,
          birth_number: cleanBirthNumber,
          name: cleanName,
          discord_id: cleanDiscordId || null,
          ts_id: cleanTeamspeakId || null,
          auto_role_sync: !skipRoleSync && !importFromDiscord,
          created_at: createdAt ? new Date(createdAt).toISOString() : null,
          status: null,
        },
      ])
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    /* ================= AUDIT LOG ================= */

    const { data: processorExists } = await supabase
      .from("personnel")
      .select("id")
      .eq("id", selectedProcessor)
      .maybeSingle();

    if (!processorExists) {
      alert("Selected processor does not exist.");
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
          processed_by: selectedProcessor || null,
        },
      ]);

    if (auditError) {
      console.error("Audit Insert Error:", auditError);
      alert("Audit log failed: " + auditError.message);
      return;
    }

    /* ================= DISCORD IMPORT ================= */

    if (importFromDiscord && cleanDiscordId) {
      const { data: importData, error: importError } =
        await supabase.functions.invoke("discord-full-import", {
          body: {
            discord_id: cleanDiscordId,
            personnel_id: data.id,
          },
        });

      if (importError) {
        alert(importError.message);
        return;
      }

      if (importData?.error) {
        alert(importData.error);
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
    setSelectedProcessor("");
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
          Create New Personnel
        </h1>

        <h2 className="text-sm uppercase tracking-widest text-[#00ff66]/70 mb-4 border-b border-[#00ff66]/20 pb-2">
          Basic Information
        </h2>

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

        <div className="mb-6 flex flex-col gap-4">
          <label className="flex items-center justify-between cursor-pointer">
            <span className={importFromDiscord ? "text-[#00ff66]" : ""}>
              Import Rank + Certifications From Discord
            </span>

            <div className="relative">
              <input
                type="checkbox"
                checked={importFromDiscord}
                onChange={(e) => setImportFromDiscord(e.target.checked)}
                className="sr-only"
              />

              <div
                className={`w-12 h-6 rounded-full p-1 transition-all duration-200
                  ${
                    importFromDiscord
                      ? "bg-[#00ff66]"
                      : "bg-black border border-[#00ff66]"
                  }
                `}
              >
                <div
                  className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-all duration-200
                    ${importFromDiscord ? "translate-x-6" : ""}
                  `}
                />
              </div>
            </div>
          </label>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Rank {importFromDiscord && "(Disabled - importing from Discord)"}
          </label>

          <select
            value={rankId}
            onChange={(e) => setRankId(e.target.value)}
            disabled={importFromDiscord}
            className={`w-full p-4 rounded-xl text-[#00ff66] transition-all duration-200
              ${
                importFromDiscord
                  ? "bg-black/40 border border-gray-700 text-gray-500 cursor-not-allowed opacity-60"
                  : "bg-black/60 border border-[#00ff66]/30 focus:outline-none focus:border-[#00ff66] focus:shadow-[0_0_10px_#00ff66]"
              }
            `}
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
            Birth Number (If taken on an active record you will get a popup)
          </label>

          <input
            type="text"
            value={birthNumber}
            onChange={(e) => setBirthNumber(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        <div className="mb-8">
          <label className="block mb-2 text-sm text-gray-300">
            Name (If taken on an active record you will get a popup)
          </label>

          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
          />
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Created At
          </label>

          <div className="flex gap-3">
            <input
              type="datetime-local"
              value={createdAt}
              onChange={(e) => setCreatedAt(e.target.value)}
              className="flex-1 p-4 rounded-xl bg-black/60 border border-[#00ff66]/30 text-[#00ff66]"
            />

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const local = new Date(
                  now.getTime() - now.getTimezoneOffset() * 60000
                )
                  .toISOString()
                  .slice(0, 16);

                setCreatedAt(local);
              }}
              className="px-6 rounded-xl bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black"
            >
              Set Now
            </button>

            <button
              type="button"
              onClick={() => setCreatedAt("")}
              className="px-4 rounded-xl border border-red-500 text-red-400 hover:bg-red-500 hover:text-black"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mb-6">
          <label className="block mb-2 text-sm text-gray-300">
            Who Processed This Form?
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
          onClick={createUser}
          disabled={!selectedProcessor}
          className={`w-full py-4 rounded-xl font-bold transition-all duration-200
            ${
              selectedProcessor
                ? "bg-[#00ff66]/10 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black hover:shadow-[0_0_25px_#00ff66]"
                : "bg-gray-700 border border-gray-600 text-gray-400 cursor-not-allowed"
            }`}
        >
          Create Personnel
        </button>
      </div>
    </div>
  );
}