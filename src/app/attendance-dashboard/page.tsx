"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AttendanceDashboard() {

  /* ================= STATE ================= */

  const [selectedMonth, setSelectedMonth] = useState("February");
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedPlatoon, setSelectedPlatoon] = useState<string | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);


  /* ================= FETCH ================= */

  const fetchData = async () => {

    setLoading(true);

    const { data } = await supabase
      .from("attendance_records")
      .select(`
        id,
        type,
        status,
        attendance_month,
        week_number,
        personnel (
          id,
          name,
          ranks(name)
        ),
        platoon_slots (
          platoon_name
        )
      `)
      .eq("attendance_month", selectedMonth)
      .eq("week_number", selectedWeek);

    setRecords(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [selectedMonth, selectedWeek]);

  /* ================= GROUP DATA ================= */

  const filteredRecords = selectedPlatoon
    ? records.filter(
        r => r.platoon_slots?.platoon_name === selectedPlatoon
      )
    : records;

  const grouped = filteredRecords.reduce((acc: any, row: any) => {

    const type = row.type || "Unknown";
    const platoon = row.platoon_slots?.platoon_name || "Unknown";

    if (!acc[type]) acc[type] = {};
    if (!acc[type][platoon]) acc[type][platoon] = [];

    acc[type][platoon].push(row);

    return acc;

  }, {});

    const total = filteredRecords.length;

const presentCount = filteredRecords.filter(r => r.status === "Y").length;
const absentCount = filteredRecords.filter(r => r.status === "N").length;

const presentPercent = total ? ((presentCount / total) * 100).toFixed(1) : 0;
const absentPercent = total ? ((absentCount / total) * 100).toFixed(1) : 0;

  /* ================= UNIQUE PLATOONS ================= */

  const platoonList = Array.from(
    new Set(
      records
        .map(r => r.platoon_slots?.platoon_name)
        .filter(Boolean)
    )
  );

  /* ================= RENDER ================= */

  return (
    <div className="relative min-h-screen flex text-white font-orbitron">

      {/* ================= BACKGROUND ================= */}

      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      <div className="relative z-10 flex w-full">

        {/* ================= LEFT PANEL ================= */}

        <div className="w-[320px] border-r border-[#00ff66]/30 p-6 bg-black/40 backdrop-blur-xl">

          <h2 className="text-xl text-[#00ff66] mb-6 tracking-widest">
            Filters
          </h2>

          {/* Month */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="w-full mb-4 px-3 py-2 bg-black/60 border border-[#00ff66]/40 rounded-lg text-[#00ff66]"
          >
            {["January","February","March","April","May","June",
              "July","August","September","October","November","December"
            ].map(m => (
              <option key={m}>{m}</option>
            ))}
          </select>

          {/* Week */}
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(Number(e.target.value))}
            className="w-full px-3 py-2 bg-black/60 border border-[#00ff66]/40 rounded-lg text-[#00ff66]"
          >
            {[1,2,3,4,5].map(w => (
              <option key={w} value={w}>
                Week {w}
              </option>
            ))}
          </select>

          {/* ================= PLATOON FILTER ================= */}

          <div className="mt-6">
            <h3 className="text-[#00ff66] text-sm mb-3 tracking-widest">
              Platoons
            </h3>

            <div className="flex flex-wrap gap-2">

              {/* ALL BUTTON */}
              <button
                onClick={() => setSelectedPlatoon(null)}
                className={`px-3 py-1 rounded-lg text-xs border ${
                  !selectedPlatoon
                    ? "bg-[#00ff66] text-black"
                    : "border-[#00ff66]/40 text-[#00ff66]"
                }`}
              >
                All
              </button>

              {platoonList.map((platoon) => (
                <button
                  key={platoon}
                  onClick={() => setSelectedPlatoon(platoon)}
                  className={`px-3 py-1 rounded-lg text-xs border ${
                    selectedPlatoon === platoon
                      ? "bg-[#00ff66] text-black"
                      : "border-[#00ff66]/40 text-[#00ff66]"
                  }`}
                >
                  {platoon}
                </button>
              ))}

            </div>
          </div>

          <div className="mt-6 text-sm text-gray-400">
            Total Records: {records.length}
          </div>

        </div>

        {/* ================= CENTER PANEL ================= */}

        <div className="flex-1 p-10">

          <h1 className="text-4xl font-bold text-[#00ff66] tracking-widest mb-10">
            Attendance Dashboard
          </h1>

          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-gray-400">
              No attendance records found.
            </p>
          ) : (
            Object.entries(grouped).map(([type, platoons]: any) => (
              <div key={type} className="mb-12">

                {/* TYPE HEADER */}
                <h2 className="text-2xl text-[#00ff66] tracking-widest mb-6">
                  {type}
                </h2>

                {Object.entries(platoons).map(([platoon, members]: any) => (

                  <div key={platoon} className="mb-8">

                    {/* PLATOON HEADER */}
                    <h3 className="text-lg text-gray-300 mb-4">
                      {platoon}
                    </h3>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">

                      {members.map((row: any) => (

                        <div
                          key={row.id}
                          className="
                            p-5 rounded-2xl
                            border border-[#00ff66]/30
                            bg-black/60 backdrop-blur-md
                            hover:border-[#00ff66]
                            transition-all duration-300
                          "
                        >

                          <div className="text-lg">
                            {row.personnel?.name || "Unknown"}
                          </div>

                          <div className="text-xs text-gray-400">
                            {row.personnel?.ranks?.name || "Unranked"}
                          </div>

                          {/* STATUS BADGE */}
                          <div className="mt-4">
                            <span className={`
                              px-3 py-1 rounded-full text-xs font-semibold
                              ${row.status === "Y"
                                ? "bg-green-500/20 text-green-400"
                                : row.status === "N"
                                ? "bg-red-500/20 text-red-400"
                                : "bg-yellow-500/20 text-yellow-400"}
                            `}>
                              {row.status}
                            </span>
                          </div>

                        </div>

                      ))}

                    </div>

                  </div>

                ))}

              </div>
            ))
          )}

        </div>

        {/* ================= RIGHT PANEL ================= */}

        <div className="w-[320px] border-l border-[#00ff66]/30 p-6 bg-black/50 backdrop-blur-xl">

          <h2 className="text-xl text-[#00ff66] mb-6 tracking-widest">
            Summary
          </h2>

          <div className="space-y-4 text-sm">

  <div>
    Total Records:
    <span className="text-[#00ff66] ml-2">
      {total}
    </span>
  </div>

  <div>
    Present:
    <span className="text-green-400 ml-2">
      {presentCount} ({presentPercent}%)
    </span>
  </div>

  <div>
    Absent:
    <span className="text-red-400 ml-2">
      {absentCount} ({absentPercent}%)
    </span>
  </div>

</div>

        </div>

      </div>
    </div>
  );
}