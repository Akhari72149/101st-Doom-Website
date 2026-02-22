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
     UI
  ======================================================*/

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-[#00e5ff] font-orbitron">
        Checking permissions...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-white p-10 font-orbitron">

      <button
        onClick={() => router.push("/")}
        className="mb-6 border border-[#00e5ff] px-4 py-2 rounded-lg hover:bg-[#00e5ff] hover:text-black transition shadow-[0_0_15px_rgba(0,229,255,0.4)]"
      >
        ← Back
      </button>

      <h1 className="text-4xl tracking-widest text-[#00e5ff] mb-8">
        Slotting Management
      </h1>

      {/* PERSON SELECT */}
      <div className="mb-6">
        <label className="block mb-2 text-[#00e5ff]">
          Select Person
        </label>

        <select
          className="bg-black border border-[#00e5ff] p-2 rounded-lg w-full text-white"
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

      {/* RANK */}
      {selectedPerson && (
        <div className="mb-10 border border-[#00e5ff] p-6 rounded-2xl bg-black/60 shadow-[0_0_30px_rgba(0,229,255,0.2)]">
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

          <button className="border border-[#00e5ff] px-4 py-2 rounded-lg hover:bg-[#00e5ff] hover:text-black transition">
            Save Rank
          </button>
        </div>
      )}

      {/* POSITION */}
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

          {/* STRUCTURE SELECTORS */}
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

        </div>
      )}
    </div>
  );
}