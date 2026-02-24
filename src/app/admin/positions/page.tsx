"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  name: string;
  rank_id: string | null;
  slotted_position: string | null;
};

export default function PositionEditor() {
  const router = useRouter();

  const [loadingAuth, setLoadingAuth] = useState(true);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState<string>("");
  const [selectedSubHeader, setSelectedSubHeader] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");

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

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: personnelData } = await supabase
      .from("personnel")
      .select("*")
      .order("name", { ascending: true });

    const { data: rankData } = await supabase
      .from("ranks")
      .select("*")
      .order("rank_level", { ascending: true });

    setPersonnel(personnelData || []);
    setRanks(rankData || []);
  };

  /* ================= STRUCTURE ================= */

  const headers = useMemo(
    () => structure.map((section: any) => section.title),
    []
  );

  const subHeaders = useMemo(() => {
    const section = structure.find(
      (s: any) => s.title === selectedHeader
    );
    return section?.children?.map((child: any) => child.title) || [];
  }, [selectedHeader]);

  const roles = useMemo(() => {
    const section = structure.find(
      (s: any) => s.title === selectedHeader
    );

    const sub = section?.children?.find(
      (c: any) => c.title === selectedSubHeader
    );

    return sub?.roles || [];
  }, [selectedHeader, selectedSubHeader]);

  /* ================= HELPERS ================= */

  const resolveSlotMetadata = (slotId: string) => {
    for (const section of structure) {
      for (const sub of section.children || []) {
        for (const role of sub.roles || []) {
          if (role.slotId === slotId) {
            return {
              label: role.role,
              section: section.title,
              subsection: sub.title,
            };
          }
        }
      }
    }
    return null;
  };

  const formatSlotToBillet = (slotId: string | null) => {
    if (!slotId) return "Unassigned";

    for (const section of structure) {
      for (const sub of section.children || []) {
        for (const role of sub.roles || []) {
          if (role.slotId === slotId) {
            return `${section.title} — ${role.role}`;
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

  /* ================= ACTIONS ================= */

  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) {
      alert("Select a position first.");
      return;
    }

    const metadata = resolveSlotMetadata(selectedSlotId);

    const { error } = await supabase
      .from("personnel")
      .update({
        slotted_position: selectedSlotId,
      })
      .eq("id", selectedPerson.id);

    if (error) {
      alert("Update failed: " + error.message);
      return;
    }

    await supabase.functions.invoke("sync-slot-roles", {
      body: {
        personnelId: selectedPerson.id,
        slotId: selectedSlotId,
        forceDefaultRole: false,
      },
    });

    alert("✅ Position Assigned + Logged");
    fetchData();
  };

  const updateRank = async () => {
    if (!selectedPerson) {
      alert("Select a person first.");
      return;
    }

    const { error } = await supabase
      .from("personnel")
      .update({ rank_id: selectedRankId || null })
      .eq("id", selectedPerson.id);

    if (error) {
      alert("Rank update failed: " + error.message);
      return;
    }

    alert("✅ Rank Updated!");
    fetchData();
  };

  const unassignPosition = async () => {
    if (!selectedPerson) return;

    const oldSlot = selectedPerson.slotted_position;

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    if (error) {
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

    alert("✅ Unassigned + Logged");
    fetchData();
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
        className="mb-6 px-5 py-2 rounded-xl border border-[#00ff66]/50 text-[#00ff66] hover:bg-[#00ff66]/10 transition"
      >
        ← Back
      </button>

      <h1 className="text-4xl font-bold text-[#00ff66] mb-10">
        Slotting Management
      </h1>

      {/* PERSON SEARCH */}
      <div className="mb-8 relative">
        <label className="block mb-2 text-[#00ff66]">
          Select Person
        </label>

        <input
          type="text"
          placeholder="Search person..."
          className="w-full px-4 py-3 rounded-2xl bg-black/50 border border-[#00ff66]/40 text-[#00ff66]"
          value={personSearch}
          onFocus={() => setShowPersonDropdown(true)}
          onChange={(e) => {
            setPersonSearch(e.target.value);
            setShowPersonDropdown(true);
          }}
        />

        {showPersonDropdown && (
          <div className="absolute w-full mt-2 bg-black/80 border border-[#00ff66]/40 rounded-2xl max-h-60 overflow-y-auto z-50">
            {personnel
              .filter((p) =>
                `${getRankName(p.rank_id)} ${p.name}`
                  .toLowerCase()
                  .includes(personSearch.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  className="px-4 py-3 hover:bg-[#00ff66]/20 cursor-pointer"
                  onClick={() => {
                    setSelectedPerson(p);
                    setSelectedSlotId(p.slotted_position || "");
                    setSelectedRankId(p.rank_id || "");
                    setPersonSearch(
                      `${getRankName(p.rank_id)} ${p.name}`
                    );
                    setShowPersonDropdown(false);
                  }}
                >
                  {getRankName(p.rank_id)} {p.name}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* RANK */}
      {selectedPerson && (
        <div className="mb-10 p-8 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-lg">
          <h2 className="text-2xl text-[#00ff66] mb-6">
            Rank Management
          </h2>

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
            className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black font-semibold hover:scale-105 transition"
          >
            Save Rank
          </button>
        </div>
      )}

      {/* POSITION */}
      {selectedPerson && (
        <div className="space-y-6">

          {/* Position Display */}
          <div className="p-6 rounded-3xl border border-[#00ff66]/30 bg-black/60 backdrop-blur-md">
            <p className="text-xs text-gray-400 mb-2">
              CURRENT POSITION
            </p>
            <p className="text-xl text-[#00ff66]">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>

          {/* Slot Selection */}
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
              {roles.map((r: any) => (
                <option key={r.slotId} value={r.slotId}>
                  {r.role}
                </option>
              ))}
            </select>
          )}

          {/* ✅ BUTTONS FIXED */}
          {selectedPerson && (
            <div className="flex gap-4">

              {/* Save ONLY if unassigned + slot selected */}
              {!selectedPerson.slotted_position && selectedSlotId && (
                <button
                  onClick={updatePosition}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-[#00ff66] to-[#00cc44] text-black font-semibold hover:scale-105 transition"
                >
                  Save Position
                </button>
              )}

              {/* Unassign ONLY if assigned */}
              {selectedPerson.slotted_position && (
                <button
                  onClick={unassignPosition}
                  className="px-6 py-2 rounded-xl border border-red-500 text-red-400 hover:bg-red-500/20 transition"
                >
                  Unassign
                </button>
              )}

            </div>
          )}

        </div>
      )}
    </div>
  );
}