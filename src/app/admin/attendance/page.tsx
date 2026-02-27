"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { createClient } from "@supabase/supabase-js";
import { structure } from "@/data/structure";

/* ================= TYPES ================= */

type Member = {
  id: string;
  name: string;
  rank: string;
  slot: string;
  status: string;
};

/* ================= SUPABASE ================= */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const assignmentOptions = ["Y", "N", "Excused", "LOA"];

export default function AttendancePage() {

  /* ================= STATE ================= */

  const [roster, setRoster] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [activeSquad, setActiveSquad] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);

  /* ✅ RESTORED FILTERS */
  const [selectedMonth, setSelectedMonth] = useState("February");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedType, setSelectedType] = useState("Training");

  /* ================================================= */
  /* ================= FETCH DATA ===================== */
  /* ================================================= */

  const fetchRoster = useCallback(async () => {

    // ✅ Only require a tab selected
    if (!activeTab) return;

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

      if (error) {
        console.error(error);
        setRoster([]);
        return;
      }

      if (!data) {
        setRoster([]);
        return;
      }

      /* ================= FILTER ================= */

      const filtered = data.filter((row: any) => {

  if (!row.platoon_slots) return false;

  const matchesPlatoon =
    row.platoon_slots.platoon_name === activeTab;

  const matchesSquad =
    activeSquad
      ? row.platoon_slots.squad_name === activeSquad
      : true; // 🔥 Allow all squads if none selected

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

  }, [activeTab, activeSquad, selectedMonth, selectedWeek, selectedType]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

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
    "Tomahawk 1": ["Tomahawk Platoon", "1-1", "1-2", "1-3", "Scimitar",  "Hammer 1"],
    "Claymore 2": ["Claymore Platoon", "2-1", "2-2", "2-3", "Hammer 2"],
    "Broadsword 3": ["Broadsword Platoon", "3-1", "3-2", "3-3", "Halberd", "Hammer 3"],
    Dagger: ["Dagger Platoon", "1-1", "1-2", "1-3", "Hammer 4"],
  };

  /* ================================================= */
  /* ================= FILTERS ======================= */
  /* ================================================= */

  const Filters = () => (
    <div className="flex gap-4 justify-center mb-8">

      {/* Month */}
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

      {/* Week */}
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

      {/* Type */}
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

  /* ================================================= */
  /* ================= RENDER ======================== */
  /* ================================================= */

  return (
    <motion.div className="min-h-screen text-white p-12">

      <h1 className="text-4xl text-green-400 text-center mb-10">
        ROSTER ATTENDANCE
      </h1>

      <Filters />

      {/* ================= PLATOON SELECT ================= */}

      <div className="flex flex-col items-center gap-4 mb-12">

        {tabs.map((tab) => {

          const isOpen = expandedTab === tab;

          return (
            <div key={tab} className="w-full max-w-4xl">

              {/* 🔥 ONLY EXPANDS — DOES NOT FILTER */}
              <button
                onClick={() => {
                    const nextTab = isOpen ? null : tab;
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

      {/* ================= ROSTER ================= */}

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