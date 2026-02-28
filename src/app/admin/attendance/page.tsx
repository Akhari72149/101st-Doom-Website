"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

/* ================= TYPES ================= */

type Member = {
  id: string;
  name: string;
  rank: string;
  slot: string;
  status: string;
};

const assignmentOptions = ["Y", "N", "Excused", "LOA"];

export default function AttendancePage() {

  const router = useRouter();

  /* ================= AUTH ================= */

  const [loadingAuth, setLoadingAuth] = useState(true);

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

      const roleList = roles?.map((r: any) => r.role) || [];
      const allowedRoles = ["admin", "nco"];

      if (!roleList.some((role) => allowedRoles.includes(role))) {
        router.replace("/");
        return;
      }

      setLoadingAuth(false);
    };

    checkAccess();
  }, [router]);

  /* ================= STATE ================= */

  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState("February");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedType, setSelectedType] = useState("Training");

  /* ================================================= */
  /* ================= FETCH DATA ===================== */
  /* ================================================= */

  const fetchRoster = useCallback(async () => {

    if (!activeTab || loadingAuth) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("attendance_records")
        .select(`
          id,
          status,
          personnel (
            id,
            name,
            ranks ( name )
          ),
          platoon_slots (
            slot_id,
            platoon_name,
            squad_name,
            role_name
          )
        `)
        .eq("attendance_month", selectedMonth)
        .eq("week_number", selectedWeek)
        .eq("type", selectedType);

      if (error || !data) {
        console.error(error);
        setRoster([]);
        return;
      }

      const filtered = data.filter((row: any) => {
        if (!row.platoon_slots) return false;

        const matchesPlatoon =
          row.platoon_slots.platoon_name === activeTab;

        const matchesSquad =
          activeSquad
            ? row.platoon_slots.squad_name === activeSquad
            : true;

        return matchesPlatoon && matchesSquad;
      });

      const formatted: Member[] = filtered.map((row: any) => ({
        id: row.personnel?.id,
        name: row.personnel?.name,
        rank: row.personnel?.ranks?.name ?? "Unknown",
        slot: row.platoon_slots?.slot_id ?? "Unassigned",
        status: row.status ?? "Y",
      }));

      setRoster(formatted);

    } catch (err) {
      console.error(err);
      setRoster([]);
    } finally {
      setLoading(false);
    }

  }, [activeTab, activeSquad, selectedMonth, selectedWeek, selectedType, loadingAuth]);

  useEffect(() => {
    if (!loadingAuth) {
      fetchRoster();
    }
  }, [fetchRoster, loadingAuth]);

  /* ================================================= */
  /* ================= UPDATE STATUS ================== */
  /* ================================================= */

  const updateAssignment = async (personnelId: string, value: string) => {

    await supabase
      .from("attendance_records")
      .update({ status: value })
      .eq("attendance_month", selectedMonth)
      .eq("week_number", selectedWeek)
      .eq("type", selectedType)
      .eq("personnel_id", personnelId);

    fetchRoster();
  };

  /* ================================================= */
  /* ================= UI STRUCTURE ================== */
  /* ================================================= */

  const tabs = ["Company Command", "Tomahawk 1", "Claymore 2", "Broadsword 3", "Dagger"];

  const platoons: Record<string, string[]> = {
    Company: ["Company"],
    "Tomahawk 1": ["Tomahawk Platoon", "1-1", "1-2", "1-3", "Scimitar", "Hammer 1"],
    "Claymore 2": ["Claymore Platoon", "2-1", "2-2", "2-3", "Hammer 2"],
    "Broadsword 3": ["Broadsword Platoon", "3-1", "3-2", "3-3", "Halberd", "Hammer 3"],
    Dagger: ["Dagger Platoon", "1-1", "1-2", "1-3", "Hammer 4"],
  };

  const Filters = () => (
    <div className="flex gap-4 justify-center mb-8">
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="bg-black border border-green-500 text-white px-4 py-2 rounded-lg"
      >
        {["January","February","March","April","May","June",
          "July","August","September","October","November","December"
        ].map((m) => (
          <option key={m}>{m}</option>
        ))}
      </select>

      <select
        value={selectedWeek}
        onChange={(e) => setSelectedWeek(Number(e.target.value))}
        className="bg-black border border-green-500 text-white px-4 py-2 rounded-lg"
      >
        {[1,2,3,4,5].map((w) => (
          <option key={w} value={w}>
            Week {w}
          </option>
        ))}
      </select>

      <select
        value={selectedType}
        onChange={(e) => setSelectedType(e.target.value)}
        className="bg-black border border-green-500 text-white px-4 py-2 rounded-lg"
      >
        <option value="Training">Training</option>
        <option value="MainOp">MainOp</option>
      </select>
    </div>
  );

  /* ================= AUTH LOADING ================= */

  if (loadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-green-400 bg-black">
        Checking permissions...
      </div>
    );
  }

  /* ================= RENDER ================= */

  return (
    <motion.div className="min-h-screen text-white p-12">


      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <h1 className="text-4xl text-green-400 text-center mb-10">
        ROSTER ATTENDANCE
      </h1>

      <Filters />

      <div className="flex flex-col items-center gap-4 mb-12">
        {tabs.map((tab) => {
          const isOpen = expandedTab === tab;

          return (
            <div key={tab} className="w-full max-w-4xl">
              <button
                onClick={() => {
                  setExpandedTab(isOpen ? null : tab);
                  setActiveTab(tab);
                  setActiveSquad(null);
                }}
                className="w-full px-6 py-4 bg-black border border-green-500 text-green-400 rounded-xl"
              >
                {tab}
              </button>

              {isOpen && platoons[tab]?.length > 0 && (
                <div className="mt-3 ml-6 flex flex-col gap-2">
                  {platoons[tab].map((squad) => (
                    <button
                      key={squad}
                      onClick={() => {
                        setActiveTab(tab);
                        setActiveSquad(squad);
                      }}
                      className={`px-5 py-2 rounded-lg border text-sm text-left ${
                        activeSquad === squad
                          ? "bg-green-500 text-black"
                          : "bg-black text-green-400"
                      }`}
                    >
                      {squad}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {loading ? (
        <p className="text-center text-gray-400">
          Loading roster...
        </p>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {roster.map((member) => (
            <div
              key={member.id}
              className="bg-black border border-green-500 rounded-2xl p-6"
            >
              <h2 className="text-xl text-green-400">
                {member.name}
              </h2>

              <p className="text-gray-400">
                {member.rank}
              </p>

              <p className="text-sm mt-1">
                Slot: <span className="text-white">{member.slot}</span>
              </p>

              <select
                value={member.status}
                onChange={(e) =>
                  updateAssignment(member.id, e.target.value)
                }
                className="mt-4 w-full bg-black border border-green-500 text-white p-2 rounded-lg"
              >
                {assignmentOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

    </motion.div>
  );
}