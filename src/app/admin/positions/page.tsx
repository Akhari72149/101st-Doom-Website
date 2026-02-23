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

  /* =====================================================
     🔐 AUTH CHECK
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
     🔥 POSITION UPDATE
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

    alert("✅ Position Updated");
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

    alert("✅ Rank Updated");
    fetchData();
  };

  const unassignPosition = async () => {
    if (!selectedPerson) return;

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    if (error) {
      alert("Unassign failed: " + error.message);
      return;
    }

    alert("✅ Unassigned");
    fetchData();
  };

  useEffect(() => {
    const handleClickOutside = () => {
      setShowPersonDropdown(false);
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff4c] font-orbitron">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="
      min-h-screen
      bg-gradient-to-br from-[#001200] via-[#002700] to-[#000a00]
      text-white
      p-10
      font-orbitron
    ">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-6
          border border-[#00ff4c]
          px-4 py-2
          rounded-lg
          transition-all duration-300
          shadow-[0_0_15px_rgba(0,255,80,0.3)]
          hover:bg-[#003d14]
          hover:text-[#00ff4c]
          hover:scale-105
          hover:shadow-[0_0_25px_rgba(0,255,80,0.6)]
        "
      >
        ← Back
      </button>

      <h1 className="text-4xl tracking-widest text-[#00ff4c] mb-8">
        Slotting Management
      </h1>

      {/* PERSON SEARCH */}
      <div className="mb-6 relative">
        <label className="block mb-2 text-[#00ff4c]">
          Select Person
        </label>

        <input
          type="text"
          placeholder="Search person..."
          className="
            bg-black
            border border-[#00ff4c]
            p-2
            rounded-lg
            w-full
            text-white
            focus:ring-2 focus:ring-[#00ff4c]
            transition-all duration-300
            shadow-[0_0_15px_rgba(0,255,80,0.2)]
          "
          value={personSearch}
          onFocus={() => setShowPersonDropdown(true)}
          onChange={(e) => {
            setPersonSearch(e.target.value);
            setShowPersonDropdown(true);
          }}
          onClick={(e) => e.stopPropagation()}
        />

        {showPersonDropdown && (
          <div className="
            absolute z-50 w-full
            bg-black
            border border-[#00ff4c]
            rounded-lg
            mt-1
            max-h-60
            overflow-y-auto
          ">
            {personnel
              .filter((p) =>
                `${getRankName(p.rank_id)} ${p.name}`
                  .toLowerCase()
                  .includes(personSearch.toLowerCase())
              )
              .map((p) => (
                <div
                  key={p.id}
                  className="
                    p-2
                    transition-all duration-300
                    hover:bg-[#003d14]
                    hover:text-[#00ff4c]
                    cursor-pointer
                  "
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

      {/* RANK SECTION */}
      {selectedPerson && (
        <div className="
          mb-10
          border border-[#00ff4c]
          p-6
          rounded-2xl
          bg-black/60
          shadow-[0_0_40px_rgba(0,255,80,0.2)]
        ">
          <h2 className="text-2xl text-[#00ff4c] mb-4">
            Rank Management
          </h2>

          <select
            className="
              bg-black
              border border-[#00ff4c]
              p-2
              w-full
              rounded-lg
              mb-4
              focus:ring-2 focus:ring-[#00ff4c]
              transition-all
            "
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
            className="
              border border-[#00ff4c]
              px-4 py-2
              rounded-lg
              transition-all duration-300
              hover:bg-[#003d14]
              hover:text-[#00ff4c]
              hover:scale-105
              hover:shadow-[0_0_20px_rgba(0,255,80,0.6)]
            "
          >
            Save Rank
          </button>
        </div>
      )}

      {/* POSITION SECTION */}
      {selectedPerson && (
        <div className="space-y-6">

          <div className="
            p-4
            border border-[#00ff4c]
            rounded-xl
            bg-black/60
          ">
            <p className="text-xs text-gray-400 mb-2">
              CURRENT POSITION
            </p>
            <p className="text-lg text-[#00ff4c]">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>

          {/* HEADER */}
          <select
            className="
              bg-black
              border border-[#00ff4c]
              p-2
              w-full
              rounded-lg
              focus:ring-2 focus:ring-[#00ff4c]
            "
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

          {/* SUB HEADER */}
          {selectedHeader && (
            <select
              className="
                bg-black
                border border-[#00ff4c]
                p-2
                w-full
                rounded-lg
                focus:ring-2 focus:ring-[#00ff4c]
              "
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

          {/* ROLE */}
          {selectedSubHeader && (
            <select
              className="
                bg-black
                border border-[#00ff4c]
                p-2
                w-full
                rounded-lg
                focus:ring-2 focus:ring-[#00ff4c]
              "
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

          {/* ACTION BUTTONS */}
          {selectedSlotId && (
            <div className="flex gap-4">

              <button
                onClick={updatePosition}
                className="
                  border border-[#00ff4c]
                  px-4 py-2
                  rounded-lg
                  transition-all duration-300
                  hover:bg-[#003d14]
                  hover:text-[#00ff4c]
                  hover:scale-105
                  hover:shadow-[0_0_20px_rgba(0,255,80,0.6)]
                "
              >
                Save Position
              </button>

              <button
                onClick={unassignPosition}
                className="
                  border border-red-500
                  px-4 py-2
                  rounded-lg
                  transition-all duration-300
                  hover:bg-red-600
                  hover:scale-105
                "
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