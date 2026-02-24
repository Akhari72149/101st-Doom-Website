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
  const [selectedPerson, setSelectedPerson] = useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState<string>("");
  const [selectedSubHeader, setSelectedSubHeader] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [selectedRankId, setSelectedRankId] = useState<string>("");

  const [personSearch, setPersonSearch] = useState("");
  const [showPersonDropdown, setShowPersonDropdown] = useState(false);

  /* ===================================================== */
  /* AUTH */
  /* ===================================================== */

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

      const allowed = ["admin", "nco", "di"];
      const hasAccess = roles?.some((r) =>
        allowed.includes(r.role)
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

  /* ===================================================== */
  /* STRUCTURE */
  /* ===================================================== */

  const headers = useMemo(
    () => structure.map((section: any) => section.title),
    []
  );

  const subHeaders = useMemo(() => {
    const section = structure.find(
      (s: any) => s.title === selectedHeader
    );
    return section?.children?.map((c: any) => c.title) || [];
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

  /* ===================================================== */
  /* HELPERS */
  /* ===================================================== */

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
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

  /* ===================================================== */
  /* ACTIONS */
  /* ===================================================== */

  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) {
      alert("Select a position first.");
      return;
    }

    await supabase
      .from("personnel")
      .update({ slotted_position: selectedSlotId })
      .eq("id", selectedPerson.id);

    fetchData();
  };

  const updateRank = async () => {
    if (!selectedPerson) return;

    await supabase
      .from("personnel")
      .update({ rank_id: selectedRankId || null })
      .eq("id", selectedPerson.id);

    fetchData();
  };

  const unassignPosition = async () => {
    if (!selectedPerson) return;

    await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    fetchData();
  };

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00ff66]">
        Checking permissions...
      </div>
    );
  }

  /* ===================================================== */
  /* UI */
  /* ===================================================== */

  return (
    <div className="
      min-h-screen
      bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]
      text-white
      p-10
    ">

      {/* BACK */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-8 px-4 py-2 rounded-lg
          border border-[#00ff66]/50
          text-[#00ff66]
          backdrop-blur-md
          transition-all duration-200
          hover:bg-[#00ff66]/10
          hover:scale-105
        "
      >
        ← Back
      </button>

      <h1 className="
        text-4xl font-bold mb-10
        text-[#00ff66]
        tracking-[0.4em]
      ">
        SLOT MANAGEMENT
      </h1>

      {/* ================= PERSON SELECT ================= */}

      <div className="relative mb-8">

        <label className="text-xs text-gray-400 tracking-widest">
          SELECT PERSON
        </label>

        <input
          className="
            w-full p-4 mt-2 rounded-xl
            bg-black/40 backdrop-blur-md
            border border-[#00ff66]/40
            text-[#00ff66]
            placeholder:text-[#00ff66]/40
            focus:border-[#00ff66]
            focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
            transition-all duration-300
          "
          placeholder="Search personnel..."
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
            absolute z-50 w-full mt-2
            max-h-64 overflow-y-auto
            rounded-xl
            bg-black/60 backdrop-blur-xl
            border border-[#00ff66]/30
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
                  onClick={() => {
                    setSelectedPerson(p);
                    setSelectedSlotId(p.slotted_position || "");
                    setSelectedRankId(p.rank_id || "");
                    setPersonSearch(
                      `${getRankName(p.rank_id)} ${p.name}`
                    );
                    setShowPersonDropdown(false);
                  }}
                  className="
                    px-4 py-3
                    cursor-pointer
                    border-b border-[#00ff66]/10
                    hover:bg-[#00ff66]/10
                    hover:text-[#00ff66]
                    hover:pl-6
                    transition-all duration-200
                  "
                >
                  {getRankName(p.rank_id)} {p.name}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* ================= EDIT PANELS ================= */}

      {selectedPerson && (
        <div className="space-y-8">

          {/* CURRENT POSITION */}
          <div className="
            p-6 rounded-2xl
            bg-black/50 backdrop-blur-xl
            border border-[#00ff66]/30
            shadow-[0_0_40px_rgba(0,255,100,0.15)]
          ">
            <p className="text-xs text-gray-400 tracking-widest">
              CURRENT POSITION
            </p>

            <p className="text-lg text-[#00ff66] mt-2">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>

          {/* RANK */}
          <div className="
            p-6 rounded-2xl
            bg-black/50 backdrop-blur-xl
            border border-[#00ff66]/30
            shadow-[0_0_40px_rgba(0,255,100,0.15)]
          ">
            <h2 className="text-xl text-[#00ff66] mb-4">
              Rank Management
            </h2>

            <select
              className="
                w-full p-3 rounded-lg
                bg-black/40
                border border-[#00ff66]/40
                text-[#00ff66]
                focus:border-[#00ff66]
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
                mt-4 px-4 py-2 rounded-lg
                border border-[#00ff66]
                text-[#00ff66]
                hover:bg-[#00ff66]/10
                transition-all duration-200
              "
            >
              Save Rank
            </button>
          </div>

          {/* POSITION SELECT */}
          <div className="
            p-6 rounded-2xl
            bg-black/50 backdrop-blur-xl
            border border-[#00ff66]/30
            shadow-[0_0_40px_rgba(0,255,100,0.15)]
          ">
            <h2 className="text-xl text-[#00ff66] mb-4">
              Position Assignment
            </h2>

            <select
              className="
                w-full p-3 rounded-lg
                bg-black/40
                border border-[#00ff66]/40
                text-[#00ff66]
              "
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
                className="
                  w-full p-3 mt-3 rounded-lg
                  bg-black/40
                  border border-[#00ff66]/40
                  text-[#00ff66]
                "
                value={selectedSubHeader}
                onChange={(e) => {
                  setSelectedSubHeader(e.target.value);
                  setSelectedSlotId("");
                }}
              >
                <option value="">-- Select Sub Header --</option>
                {subHeaders.map((s: string) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

            {selectedSubHeader && (
              <select
                className="
                  w-full p-3 mt-3 rounded-lg
                  bg-black/40
                  border border-[#00ff66]/40
                  text-[#00ff66]
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

            {selectedSlotId && (
              <div className="flex gap-4 mt-4">

                <button
                  onClick={updatePosition}
                  className="
                    px-4 py-2 rounded-lg
                    border border-[#00ff66]
                    text-[#00ff66]
                    hover:bg-[#00ff66]/10
                    transition-all duration-200
                  "
                >
                  Save Position
                </button>

                <button
                  onClick={unassignPosition}
                  className="
                    px-4 py-2 rounded-lg
                    border border-red-500
                    text-red-500
                    hover:bg-red-500/10
                    transition-all duration-200
                  "
                >
                  Unassign
                </button>

              </div>
            )}

          </div>

        </div>
      )}
    </div>
  );
}