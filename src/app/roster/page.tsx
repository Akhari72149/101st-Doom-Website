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
      /* 🔥 Load ranks first */
      const { data: rankData } = await supabase
        .from("ranks")
        .select("*");

      setRanks(rankData || []);

      /* 🔥 Fetch personnel + join rank table */
      const { data, error } = await supabase
        .from("personnel")
        .select("*, ranks(name, rank_level)")
        .order("rank_id", { ascending: true });

      if (error) {
        console.error("Supabase Error:", error.message);
      } else {
        setPersonnel(data || []);
      }
    }

    fetchData();
  }, []);

  /* =====================================================
     RESOLVE RANK NAME
  ======================================================*/

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  /* =====================================================
     RENDER STRUCTURE
  ======================================================*/

  const renderStructure = () => {
    return structure.map((section, index) => {
      if (section.type !== "header") return null;

      return (
        <div key={index} className="mt-8">

          {/* HEADER */}
          <div className="bg-[#002700] text-white px-4 py-3 text-xl font-bold">
            {section.title}
          </div>

          {section.children?.map((child: any, childIndex: number) => {
            if (child.type !== "sub-header") return null;

            return (
              <div key={childIndex} className="ml-6 mt-4">

                {/* SUB HEADER */}
                <div className="bg-[#003d00] text-white px-3 py-2 text-lg font-semibold">
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
                      className="ml-6 mt-3 border border-[#002700] p-3"
                    >
                      <div className="font-bold text-[#00ff66] mb-2">
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
                              className="border border-[#002700] bg-[#0f1a0f] px-3 py-2 mt-2"
                            >
                              {person ? (
                                <>
                                  <span className="font-bold">
                                    {getRankName(person.rank_id)}
                                  </span>{" "}
                                  {person.name}
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

  /* =====================================================
     UI
  ======================================================*/

  return (
    <main className="p-8">
      <h1 className="text-4xl font-bold tracking-widest text-[#002700] mb-6">
        101st Doom Battalion Roster
      </h1>

      <div>{renderStructure()}</div>
    </main>
  );
}