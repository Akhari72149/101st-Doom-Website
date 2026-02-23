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

  /* ================= SEARCH STATES ================= */

  const [personSearch, setPersonSearch] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  /* =====================================================
     🔐 AUTH CHECK (UPDATED)
  ======================================================*/

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

      const hasAccess = roleList.some((role) =>
        allowedRoles.includes(role)
      );

      if (!hasAccess) {
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

  /* =====================================================
     STRUCTURE
  ======================================================*/

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

  /* =====================================================
     HELPERS
  ======================================================*/

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

  /* =====================================================
     🔥 POSITION UPDATE + DISCORD SYNC
  ======================================================*/

  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) {
      alert("Select a position first.");
      return;
    }

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: selectedSlotId })
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

    alert("✅ Position Updated + Discord Synced!");
    fetchData();
  };

  /* ✅ RANK UPDATE */
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

    alert("✅ Unassigned + Discord Updated!");
    fetchData();
  };

  /* ================= CLOSE DROPDOWN ================= */

  useEffect(() => {
    const handleClickOutside = () => {
      setShowPersonDropdown(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  /* =====================================================
     LOADING
  ======================================================*/

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00e5ff] font-orbitron">
        Checking permissions...
      </div>
    );
  }

  /* =====================================================
     UI
  ======================================================*/

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-white p-10 font-orbitron">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="mb-6 border border-[#00e5ff] px-4 py-2 rounded-lg hover:bg-[#00e5ff] hover:text-black transition"
      >
        ← Back
      </button>

      <h1 className="text-4xl tracking-widest text-[#00e5ff] mb-8">
        Slotting Management
      </h1>

      {/* ================= PERSON SEARCH ================= */}

      <div className="mb-6 relative">
        <label className="block mb-2 text-[#00e5ff]">
          Select Person
        </label>

        <input
          type="text"
          placeholder="Search person..."
          className="bg-black border border-[#00e5ff] p-2 rounded-lg w-full text-white"
          value={personSearch}
          onFocus={() => setShowPersonDropdown(true)}
          onChange={(e) => {
            setPersonSearch(e.target.value);
            setShowPersonDropdown(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {showPersonDropdown && (
          <div className="absolute z-50 w-full bg-black border border-[#00e5ff] rounded-lg mt-1 max-h-60 overflow-y-auto">
            {personnel
              .filter((p) =>
                `${getRankName(p.rank_id)} ${p.name}`
                  .toLowerCase()
                  .includes(personSearch.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  className="p-2 hover:bg-[#00e5ff] hover:text-black cursor-pointer"
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

            {personnel.filter((p) =>
              `${getRankName(p.rank_id)} ${p.name}`
                .toLowerCase()
                .includes(personSearch.toLowerCase())
            ).length === 0 && (
              <div className="p-2 text-gray-400">No results</div>
            )}
          </div>
        )}
      </div>

      {/* ================= RANK SECTION ================= */}

      {selectedPerson && (
        <div className="mb-10 border border-[#00e5ff] p-6 rounded-2xl bg-black/60">
          <h2 className="text-2xl text-[#00e5ff] mb-4">
            Rank Management
          </h2>

          <select
            className="bg-black border border-[#00e5ff] p-2 w-full rounded-lg mb-4"
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
            type="button"
            onClick={updateRank}
            className="border border-[#00e5ff] px-4 py-2 rounded-lg"
          >
            Save Rank
          </button>
        </div>
      )}

      {/* ================= POSITION SECTION ================= */}

      {selectedPerson && (
        <div className="space-y-6">
          <div className="p-4 border border-[#00e5ff] rounded-xl bg-black/60">
            <p className="text-xs text-gray-400 mb-2">
              CURRENT POSITION
            </p>
            <p className="text-lg text-[#00e5ff]">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>

          <select
            className="bg-black border border-[#00e5ff] p-2 w-full rounded-lg"
            value={selectedHeader}
            onChange={(e) => {
              setSelectedHeader(e.target.value);
              setSelectedSubHeader("");
              setSelectedSlotId("");
            }}
          >
            <option value="">-- Select Header --</option>
            {headers.map((header) => (
              <option key={header} value={header}>
                {header}
              </option>
            ))}
          </select>

          {selectedHeader && (
            <select
              className="bg-black border border-[#00e5ff] p-2 w-full rounded-lg"
              value={selectedSubHeader}
              onChange={(e) => {
                setSelectedSubHeader(e.target.value);
                setSelectedSlotId("");
              }}
            >
              <option value="">-- Select Sub Header --</option>
              {subHeaders.map((sub: string) => (
                <option key={sub} value={sub}>
                  {sub}
                </option>
              ))}
            </select>
          )}

          {selectedSubHeader && (
            <select
              className="bg-black border border-[#00e5ff] p-2 w-full rounded-lg"
              value={selectedSlotId}
              onChange={(e) => setSelectedSlotId(e.target.value)}
            >
              <option value="">-- Select Role --</option>
              {roles.map((role: any) => (
                <option key={role.slotId} value={role.slotId}>
                  {role.role}
                </option>
              ))}
            </select>
          )}

          {selectedSlotId && (
            <div className="flex gap-4">
              <button
                type="button"
                onClick={updatePosition}
                className="border border-[#00e5ff] px-4 py-2 rounded-lg"
              >
                Save Position
              </button>

              <button
                type="button"
                onClick={unassignPosition}
                className="border border-red-500 px-4 py-2 rounded-lg"
              >
                Unassign
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}