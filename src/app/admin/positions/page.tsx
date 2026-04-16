"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  name: string;
  rank_id: string | null;
  slotted_position: string | null;
  status: string | null;
};

type Rank = {
  id: string;
  name: string;
  rank_level: number;
};

type StructureRole = {
  role: string;
  slotId: string;
};

type StructureChild = {
  title: string;
  roles?: StructureRole[];
};

type StructureSection = {
  title: string;
  children?: StructureChild[];
};

export default function PositionEditor() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState("");
  const [selectedSubHeader, setSelectedSubHeader] = useState("");
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [selectedRankId, setSelectedRankId] = useState("");

  const [personSearch, setPersonSearch] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

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

      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      if (error) {
        router.replace("/");
        return;
      }

      const roleList = roles?.map((r) => r.role) || [];
      const allowedRoles = ["admin", "nco", "di"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= DATA ================= */

  const fetchData = async () => {
    const { data: personnelData, error: personnelError } = await supabase
      .from("personnel")
      .select("id, name, rank_id, slotted_position, status")
      .order("name", { ascending: true });

    const { data: rankData, error: rankError } = await supabase
      .from("ranks")
      .select("id, name, rank_level")
      .order("rank_level", { ascending: true });

    if (personnelError || rankError) {
      return;
    }

    const activePersonnel = (personnelData || []).filter((person) => {
      const status = (person.status || "").trim().toLowerCase();
      return status !== "retired" && status !== "removed";
    });

    setPersonnel((activePersonnel as Personnel[]) || []);
    setRanks((rankData as Rank[]) || []);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedPerson) return;

    const updated = personnel.find((p) => p.id === selectedPerson.id);
    if (!updated) return;

    setSelectedPerson(updated);
    setSelectedRankId(updated.rank_id || "");
  }, [personnel, selectedPerson]);

  /* ================= STRUCTURE ================= */

  const headers = useMemo(
    () => (structure as StructureSection[]).map((section) => section.title),
    []
  );

  const subHeaders = useMemo(() => {
    const section = (structure as StructureSection[]).find(
      (s) => s.title === selectedHeader
    );
    return section?.children?.map((child) => child.title) || [];
  }, [selectedHeader]);

  const roles = useMemo(() => {
    const section = (structure as StructureSection[]).find(
      (s) => s.title === selectedHeader
    );

    const sub = section?.children?.find(
      (c) => c.title === selectedSubHeader
    );

    return sub?.roles || [];
  }, [selectedHeader, selectedSubHeader]);

  /* ================= HELPERS ================= */

  const formatSlotToBillet = (slotId: string | null) => {
    if (!slotId) return "Unassigned";

    for (const section of structure as StructureSection[]) {
      for (const sub of section.children || []) {
        for (const role of sub.roles || []) {
          if (role.slotId === slotId) {
            return `${section.title} — ${sub.title} — ${role.role}`;
          }
        }
      }
    }

    return slotId;
  };

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  const filteredPersonnel = useMemo(() => {
    const search = personSearch.trim().toLowerCase();

    return personnel.filter((p) =>
      `${getRankName(p.rank_id)} ${p.name}`.toLowerCase().includes(search)
    );
  }, [personnel, personSearch, ranks]);

  const hasPositionChange =
    !!selectedPerson && selectedSlotId !== (selectedPerson.slotted_position || "");

  const hasRankChange =
    !!selectedPerson && selectedRankId !== (selectedPerson.rank_id || "");

  /* ================= ACTIONS ================= */

  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) {
      alert("Select a position first.");
      return;
    }

    setProcessing(true);

    const oldSlot = selectedPerson.slotted_position;

    const { error } = await supabase
      .from("personnel")
      .update({
        slotted_position: selectedSlotId,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      alert("Update failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("sync-slot-roles", {
      body: {
        personnelId: selectedPerson.id,
        slotId: selectedSlotId,
        oldSlotId: oldSlot,
        forceDefaultRole: false,
      },
    });

    await fetchData();
    setProcessing(false);
    alert("✅ Position Updated + Logged");
  };

  const updateRank = async () => {
    if (!selectedPerson) {
      alert("Select a person first.");
      return;
    }

    setProcessing(true);

    const oldRank = selectedPerson.rank_id;

    const { error } = await supabase
      .from("personnel")
      .update({
        rank_id: selectedRankId || null,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      alert("Rank update failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("discord-rank-sync", {
      body: {
        personnelId: selectedPerson.id,
        oldRankId: oldRank,
        newRankId: selectedRankId || null,
      },
    });

    await fetchData();
    setProcessing(false);
    alert("✅ Rank Updated + Discord Synced");
  };

  const unassignPosition = async () => {
    if (!selectedPerson) return;

    setProcessing(true);

    const oldSlot = selectedPerson.slotted_position;

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    if (error) {
      setProcessing(false);
      alert("Unassign failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("sync-slot-roles", {
      body: {
        personnelId: selectedPerson.id,
        slotId: null,
        oldSlotId: oldSlot,
        forceDefaultRole: true,
      },
    });

    await fetchData();
    setSelectedSlotId("");
    setSelectedHeader("");
    setSelectedSubHeader("");
    setProcessing(false);
    alert("✅ Unassigned + Logged");
  };

  /* ================= LOADING ================= */

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66] bg-black">
        Checking permissions...
      </div>
    );
  }

  /* ================= UI ================= */

  return (
    <div className="min-h-screen p-10 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_100%)] text-white">
      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <h1 className="text-4xl font-bold text-[#00ff66] mb-10">
        Slotting Management
      </h1>

      <div className="mb-8 relative">
        <label className="block mb-2 text-[#00ff66]">Select Person</label>

        <input
          type="text"
          placeholder="Search person..."
          className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66] outline-none"
          value={personSearch}
          onFocus={() => setShowPersonDropdown(true)}
          onChange={(e) => {
            setPersonSearch(e.target.value);
            setShowPersonDropdown(true);
          }}
        />

        {showPersonDropdown && (
          <div className="absolute w-full mt-2 bg-black/80 border border-[#00ff66]/40 rounded-2xl max-h-60 overflow-y-auto z-50">
            {filteredPersonnel.length === 0 ? (
              <div className="px-4 py-3 text-gray-400">No matches found.</div>
            ) : (
              filteredPersonnel.map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 hover:bg-[#00ff66]/20 cursor-pointer"
                  onClick={() => {
                    setSelectedPerson(p);
                    setSelectedSlotId(p.slotted_position || "");
                    setSelectedRankId(p.rank_id || "");
                    setPersonSearch(`${getRankName(p.rank_id)} ${p.name}`);
                    setSelectedHeader("");
                    setSelectedSubHeader("");
                    setShowPersonDropdown(false);
                  }}
                >
                  {getRankName(p.rank_id)} {p.name}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {selectedPerson && (
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-md">
            <p className="text-xs text-gray-400 mb-2">SELECTED PERSON</p>
            <p className="text-xl text-[#00ff66] font-semibold">
              {getRankName(selectedPerson.rank_id)} {selectedPerson.name}
            </p>
          </div>

          <div className="p-6 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-md">
            <p className="text-xs text-gray-400 mb-2">CURRENT POSITION</p>
            <p className="text-xl text-[#00ff66]">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>
        </div>
      )}

      {selectedPerson && (
        <div className="mb-10 p-8 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg">
          <h2 className="text-2xl text-[#00ff66] mb-6">Rank Management</h2>

          <select
            className="w-full p-3 mb-5 rounded-xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66]"
            value={selectedRankId}
            onChange={(e) => setSelectedRankId(e.target.value)}
          >
            <option value="">-- Select Rank --</option>
            {ranks.map((rank) => (
              <option key={rank.id} value={rank.id}>
                {rank.name}
              </option>
            ))}
          </select>

          <button
            onClick={updateRank}
            disabled={!hasRankChange || processing}
            className={`px-6 py-2 rounded-xl font-semibold transition ${
              !hasRankChange || processing
                ? "border border-[#00ff66]/20 text-gray-500 cursor-not-allowed"
                : "bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black hover:scale-105"
            }`}
          >
            {processing ? "Saving..." : "Save Rank"}
          </button>
        </div>
      )}

      {selectedPerson && (
        <div className="space-y-6">
          <select
            className="w-full p-3 rounded-xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66]"
            value={selectedHeader}
            onChange={(e) => {
              setSelectedHeader(e.target.value);
              setSelectedSubHeader("");
              setSelectedSlotId("");
            }}
          >
            <option value="">-- Select Header --</option>
            {headers.map((h) => (
              <option key={h} value={h}>
                {h}
              </option>
            ))}
          </select>

          {selectedHeader && (
            <select
              className="w-full p-3 rounded-xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66]"
              value={selectedSubHeader}
              onChange={(e) => {
                setSelectedSubHeader(e.target.value);
                setSelectedSlotId("");
              }}
            >
              <option value="">-- Select Sub Header --</option>
              {subHeaders.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}

          {selectedSubHeader && (
            <select
              className="w-full p-3 rounded-xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66]"
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
            >
              <option value="">-- Select Role --</option>
              {roles.map((r) => (
                <option key={r.slotId} value={r.slotId}>
                  {r.role}
                </option>
              ))}
            </select>
          )}

          <div className="flex gap-4 flex-wrap">
            {selectedSlotId && (
              <button
                onClick={updatePosition}
                disabled={!hasPositionChange || processing}
                className={`px-6 py-2 rounded-xl font-semibold transition ${
                  !hasPositionChange || processing
                    ? "border border-[#00ff66]/20 text-gray-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black hover:scale-105"
                }`}
              >
                {processing
                  ? "Saving..."
                  : selectedPerson.slotted_position
                  ? "Update Position"
                  : "Save Position"}
              </button>
            )}

            {selectedPerson.slotted_position && (
              <button
                onClick={unassignPosition}
                disabled={processing}
                className={`px-6 py-2 rounded-xl border transition ${
                  processing
                    ? "border-red-500/30 text-red-400/50 cursor-not-allowed"
                    : "border-red-500 text-red-400 hover:bg-red-500/20"
                }`}
              >
                {processing ? "Working..." : "Unassign"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}