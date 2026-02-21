// Slotting Management (PROTECTED + HOOK SAFE)

"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  name: string;
  Clone_Rank: string;
  slotted_position: string | null;
};

export default function PositionEditor() {
  const router = useRouter();

  /* =====================================================
     🔐 AUTH STATE
  ======================================================*/
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedPerson, setSelectedPerson] =
    useState<Personnel | null>(null);

  const [selectedHeader, setSelectedHeader] = useState<string>("");
  const [selectedSubHeader, setSelectedSubHeader] = useState<string>("");
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");

  const [newRank, setNewRank] = useState<string>("");

  /* =====================================================
     🔐 ROLE PROTECTION (SAFE — NO HOOK BREAK)
  ======================================================*/
  useEffect(() => {
  const checkAdmin = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log("USER:", user);

  if (!user) {
    router.replace("/login");
    return;
  }

  const { data: role } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();

  console.log("ROLE QUERY RESULT:", role);

  if (!role || role.role !== "admin") {
    router.replace("/");
    return;
  }

  setLoadingAuth(false);
};

  checkAdmin();

  const { data: listener } = supabase.auth.onAuthStateChange(() => {
    checkAdmin();
  });

  return () => {
    listener.subscription.unsubscribe();
  };
}, []);

  /* =====================================================
     🔥 FETCH PERSONNEL
  ======================================================*/
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data } = await supabase
      .from("personnel")
      .select("*")
      .order("name", { ascending: true });

    setPersonnel(data || []);
  };

  /* =====================================================
     🔥 STRUCTURE DATA
  ======================================================*/
  const headers = useMemo(() => {
    return structure.map((section: any) => section.title);
  }, []);

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
     🔥 UPDATE POSITION
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
    resetSelections();
    fetchData();
  };

  /* =====================================================
     🔥 UNASSIGN
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
    resetSelections();
    fetchData();
  };

  /* =====================================================
     🔥 UPDATE RANK
  ======================================================*/
  const updateRank = async () => {
    if (!selectedPerson) return;

    const { error } = await supabase
      .from("personnel")
      .update({ Clone_Rank: newRank })
      .eq("id", selectedPerson.id);

    if (error) {
      alert("Rank update failed: " + error.message);
      return;
    }

    alert("✅ Rank Updated!");
    fetchData();
  };

  const resetSelections = () => {
    setSelectedPerson(null);
    setSelectedHeader("");
    setSelectedSubHeader("");
    setSelectedSlotId("");
  };

  /* =====================================================
     🔥 LOADING SCREEN (SAFE PLACE)
  ======================================================*/
  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <p>Checking permissions...</p>
      </div>
    );
  }

  /* =====================================================
     🔥 UI
  ======================================================*/
  return (
    <div className="p-8 text-white">
<button
    onClick={() => router.push("/")}
    className="mb-6 bg-[#002700] px-4 py-2 hover:bg-[#004d00] transition"
  >
    ← Back to Dashboard
  </button>
      <h1 className="text-3xl font-bold mb-6">
        Slotting Management
      </h1>

      {/* ================= PERSON SELECT ================= */}
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
            setNewRank(person?.Clone_Rank || "");
          }}
        >
          <option value="">-- Choose Person --</option>

          {personnel.map((p) => (
            <option key={p.id} value={p.id}>
              {p.Clone_Rank} {p.name} — (
              {p.slotted_position || "Unassigned"})
            </option>
          ))}
        </select>
      </div>

      {/* ================= RANK ================= */}
      {selectedPerson && (
        <div className="mb-10 border-b border-[#002700] pb-8">
          <h2 className="text-2xl font-bold mb-4">
            Rank Management
          </h2>

          <div className="mb-4 p-4 border border-[#002700] bg-[#0f1a0f]">
            <p>
              Current Rank:{" "}
              <span className="font-bold text-[#00ff66]">
                {selectedPerson.Clone_Rank}
              </span>
            </p>
          </div>

          <input
            type="text"
            value={newRank}
            onChange={(e) => setNewRank(e.target.value)}
            className="bg-[#0f1a0f] border border-[#002700] p-2 w-full mb-4"
          />

          <button
            onClick={updateRank}
            className="bg-[#002700] px-4 py-2 hover:bg-[#004d00]"
          >
            Save Rank
          </button>
        </div>
      )}

      {/* ================= SLOT SYSTEM ================= */}
      {selectedPerson && (
        <div className="space-y-4">

          <div className="p-4 border border-[#002700] bg-[#0f1a0f]">
            <p>
              Current Position:{" "}
              <span className="font-bold text-[#00ff66]">
                {selectedPerson.slotted_position || "Unassigned"}
              </span>
            </p>
          </div>

          {/* HEADER */}
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

          {/* SUB HEADER */}
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

          {/* ROLE */}
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

          {/* ACTIONS */}
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