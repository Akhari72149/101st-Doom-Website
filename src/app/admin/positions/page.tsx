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

  /* =====================================================
     AUTH STATE
  ======================================================*/
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState<string>("");
  const [selectedSubHeader, setSelectedSubHeader] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [selectedRankId, setSelectedRankId] = useState<string>("");

  /* =====================================================
     AUTH CHECK
  ======================================================*/
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

      setLoadingAuth(false);
    };

    checkAdmin();
  }, []);

  /* =====================================================
     FETCH DATA
  ======================================================*/
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

  const getRankLevel = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.rank_level : 1;
  };

  /* =====================================================
     UPDATE POSITION
  ======================================================*/
  const updatePosition = async () => {
    if (!selectedPerson || !selectedSlotId) return;

    const roleInfo = roles.find(
      (r: any) => r.slotId === selectedSlotId
    );

    if (!roleInfo) {
      alert("Invalid role selected");
      return;
    }

    const { data: slotUsers } = await supabase
      .from("personnel")
      .select("id")
      .like("slotted_position", `${selectedSlotId}%`);

    const occupied = slotUsers?.length || 0;

    if (occupied >= roleInfo.count) {
      alert("❌ Slot is already full!");
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

    alert("✅ Position Updated!");
    fetchData();
  };

  /* =====================================================
     UNASSIGN
  ======================================================*/
  const unassign = async () => {
    if (!selectedPerson) return;

    const { error } = await supabase
      .from("personnel")
      .update({ slotted_position: null })
      .eq("id", selectedPerson.id);

    if (error) {
      alert("Unassign failed: " + error.message);
      return;
    }

    alert("✅ Person Unassigned!");
    fetchData();
  };

  /* =====================================================
     UPDATE RANK (NOW USES rank_id)
  ======================================================*/
  const updateRank = async () => {
    if (!selectedPerson || !selectedRankId) return;

    if (selectedRankId === selectedPerson.rank_id) {
      alert("No rank change detected.");
      return;
    }

    const { error: updateError } = await supabase
      .from("personnel")
      .update({ rank_id: selectedRankId })
      .eq("id", selectedPerson.id);

    if (updateError) {
      alert("Rank update failed: " + updateError.message);
      return;
    }

    await supabase.from("rank_history").insert({
      personnel_id: selectedPerson.id,
      rank: selectedRankId,
    });

    alert("✅ Rank Updated & Logged!");
    fetchData();
  };


  const resetSelections = () => {
    setSelectedPerson(null);
    setSelectedHeader("");
    setSelectedSubHeader("");
    setSelectedSlotId("");
    setSelectedRankId("");
  };

  /* =====================================================
     LOADING
  ======================================================*/
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Checking permissions...</p>
      </div>
    );
  }

  /* =====================================================
     UI
  ======================================================*/

  return (
    <div className="p-8 text-white">

      <button
        onClick={() => router.push("/")}
        className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
      >
        ← Back
      </button>

      <h1 className="text-3xl font-bold mb-6">
        Slotting Management
      </h1>

      {/* PERSON SELECT */}
      <div className="mb-6">
        <label className="block mb-2">Select Person</label>

        <select
          className="bg-[#0f1a0f] border border-[#002700] p-2"
          onChange={(e) => {
            const person = personnel.find(
              (p) => p.id === e.target.value
            );

            setSelectedPerson(person || null);
            setSelectedSlotId(person?.slotted_position || "");
            setSelectedRankId(person?.rank_id || "");
          }}
        >
          <option value="">-- Choose Person --</option>

          {personnel.map((p) => (
            <option key={p.id} value={p.id}>
              {getRankName(p.rank_id)} {p.name}
            </option>
          ))}
        </select>
      </div>

      {/* RANK DROPDOWN */}
      {selectedPerson && (
        <div className="mb-10 border-b border-[#002700] pb-8">
          <h2 className="text-2xl font-bold mb-4">
            Rank Management
          </h2>

          <select
            className="bg-[#0f1a0f] border border-[#002700] p-2 w-full mb-4"
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
            className="bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
          >
            Save Rank
          </button>
        </div>
      )}

      {/* POSITION SYSTEM */}
      {selectedPerson && (
        <div className="space-y-4">

          <div className="p-4 border border-[#002700] bg-[#0f1a0f]">
            <p className="text-xs text-gray-400 mb-2">
              CURRENT POSITION
            </p>

            <p className="text-lg font-semibold text-[#00ff66]">
              {formatSlotToBillet(selectedPerson.slotted_position)}
            </p>
          </div>

          {/* HEADER / SUBHEADER / ROLE */}
          <select
            className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
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
              className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
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
              className="bg-[#0f1a0f] border border-[#002700] p-2 w-full"
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
                onClick={updatePosition}
                className="bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
              >
                Save Position
              </button>

              <button
                onClick={unassign}
                className="bg-red-800 px-4 py-2 hover:bg-red-600"
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