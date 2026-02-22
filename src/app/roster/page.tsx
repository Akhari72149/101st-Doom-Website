"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";

type Personnel = {
  id: string;
  rank_id: string | null;
  birth_number: string;
  name: string;
  slotted_position: string;
};

export default function Home() {
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);

  /* =====================================================
     FETCH DATA
  ======================================================*/

  useEffect(() => {
    async function fetchData() {
      const { data: rankData } = await supabase
        .from("ranks")
        .select("*");

      setRanks(rankData || []);

      const { data, error } = await supabase
        .from("personnel")
        .select("*, ranks(name, rank_level)")
        .order("rank_id", { ascending: true });

      if (!error) {
        setPersonnel(data || []);
      }
    }

    fetchData();
  }, []);

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  /* =====================================================
     UI (BLUE HOLO + ORBITRON)
  ======================================================*/

  const renderStructure = () => {
    return structure.map((section, index) => {
      if (section.type !== "header") return null;

      return (
        <div key={index} className="mt-10 font-orbitron">

          {/* HEADER */}
          <div className="bg-[#05080f] border border-[#00e5ff] text-[#00e5ff] px-6 py-4 text-2xl font-bold tracking-widest rounded-xl shadow-[0_0_20px_rgba(0,229,255,0.4)]">
            {section.title}
          </div>

          {section.children?.map((child: any, childIndex: number) => {
            if (child.type !== "sub-header") return null;

            return (
              <div key={childIndex} className="ml-6 mt-6">

                {/* SUB HEADER */}
                <div className="bg-[#05080f] border border-[#00e5ff] text-[#00e5ff] px-4 py-3 text-lg font-semibold rounded-lg shadow-[0_0_15px_rgba(0,229,255,0.3)]">
                  {child.title}
                </div>

                {/* ROLES */}
                {child.roles?.map((role: any, roleIndex: number) => {
                  const matchedPeople = personnel.filter((person) =>
                    person.slotted_position?.startsWith(role.slotId)
                  );

                  return (
                    <div
                      key={roleIndex}
                      className="ml-6 mt-4 border border-[#00e5ff] bg-black/60 p-4 rounded-2xl shadow-[0_0_30px_rgba(0,229,255,0.15)]"
                    >
                      <div className="font-bold text-[#00e5ff] mb-3 tracking-wide">
                        {role.role}

                        {role.count > 1 && (
                          <span className="text-gray-400 ml-2">
                            ×{role.count}
                          </span>
                        )}
                      </div>

                      {/* SLOT LIST */}
                      {Array.from({ length: role.count }).map(
                        (_, slotIndex) => {
                          const person = matchedPeople[slotIndex];

                          return (
                            <div
                              key={slotIndex}
                              className="border border-[#00e5ff]/40 bg-[#05080f] px-4 py-3 mt-3 rounded-xl hover:border-[#00e5ff] transition"
                            >
                              {person ? (
                                <>
                                  <span className="font-bold text-[#00e5ff]">
                                    {getRankName(person.rank_id)}
                                  </span>{" "}
                                  <span className="text-white">
                                    {person.name}
                                  </span>
                                </>
                              ) : (
                                <span className="text-gray-400">
                                  Empty Slot
                                </span>
                              )}
                            </div>
                          );
                        }
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      );
    });
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[#05080f] via-[#0b0f1a] to-black text-white p-10">

      <h1 className="text-5xl font-bold tracking-widest text-[#00e5ff] mb-8 font-orbitron">
        101st Doom Battalion Roster
      </h1>

      <div>{renderStructure()}</div>

    </main>
  );
}