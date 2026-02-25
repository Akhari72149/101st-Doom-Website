"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

type Personnel = {
  id: string;
  rank_id: string | null;
  birth_number: string;
  name: string;
  slotted_position: string;
};

export default function Roster() {
  const router = useRouter();
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);

  // Header dropdown state
  const [openSection, setOpenSection] = useState<number | null>(null);

  // Sub-header dropdown state (sectionIndex-childIndex)
  const [openSubSection, setOpenSubSection] = useState<string | null>(null);

  /* ================= FETCH ================= */

  useEffect(() => {
    async function fetchData() {
      const { data: rankData } = await supabase
        .from("ranks")
        .select("*");

      setRanks(rankData || []);

      const { data } = await supabase
        .from("personnel")
        .select("*")
        .order("rank_id", { ascending: true });

      setPersonnel(data || []);
    }

    fetchData();
  }, []);

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  /* ================= UI ================= */

  const renderStructure = () => {
    return structure.map((section, index) => {
      if (section.type !== "header") return null;

      return (
        <div key={index} className="mt-16">

          {/* HEADER */}
          <div
            onClick={() => {
              const isOpen = openSection === index;
              setOpenSection(isOpen ? null : index);
              setOpenSubSection(null); // Reset sub-sections when switching header
            }}
            className="
              px-6 py-5
              rounded-3xl
              border border-[#00ff66]/30
              bg-black/50 backdrop-blur-xl
              text-[#00ff66]
              text-2xl font-bold tracking-widest
              shadow-[0_0_60px_rgba(0,255,100,0.15)]
              cursor-pointer
              transition-all duration-200
              hover:border-[#00ff66]
              hover:shadow-[0_0_80px_rgba(0,255,100,0.35)]
            "
          >
            {section.title}
          </div>

          {/* Only render section if open */}
          {openSection === index &&
            section.children?.map((child: any, childIndex: number) => {
              if (child.type !== "sub-header") return null;

              const subKey = `${index}-${childIndex}`;
              const isSubOpen = openSubSection === subKey;

              return (
                <div key={childIndex} className="ml-10 mt-10">

                  {/* SUB HEADER */}
                  <div
                    onClick={() =>
                      setOpenSubSection(isSubOpen ? null : subKey)
                    }
                    className="
                      px-5 py-3
                      rounded-2xl
                      border border-[#00ff66]/30
                      bg-black/40 backdrop-blur-md
                      text-[#00ff66]
                      text-lg font-semibold
                      shadow-[0_0_30px_rgba(0,255,100,0.2)]
                      cursor-pointer
                      transition-all duration-200
                      hover:border-[#00ff66]
                      hover:shadow-[0_0_50px_rgba(0,255,100,0.4)]
                    "
                  >
                    {child.title}
                  </div>

                  {/* ROLES (only if sub-header open) */}
                  {isSubOpen &&
                    child.roles?.map((role: any, roleIndex: number) => {
                      const matchedPeople = personnel.filter((person) =>
                        person.slotted_position?.startsWith(role.slotId)
                      );

                      return (
                        <div
                          key={roleIndex}
                          className="
                            ml-8 mt-6
                            p-6
                            rounded-3xl
                            border border-[#00ff66]/20
                            bg-black/50 backdrop-blur-xl
                            shadow-[0_0_40px_rgba(0,255,100,0.12)]
                            transition-all duration-300
                            hover:border-[#00ff66]
                            hover:shadow-[0_0_70px_rgba(0,255,100,0.35)]
                          "
                        >

                          {/* ROLE TITLE */}
                          <div className="mb-4 text-[#00ff66] font-bold tracking-wide">
                            {role.role}
                            {role.count > 1 && (
                              <span className="text-gray-400 ml-2">
                                ×{role.count}
                              </span>
                            )}
                          </div>

                          {/* SLOTS */}
                          {Array.from({ length: role.count }).map(
                            (_, slotIndex) => {
                              const person = matchedPeople[slotIndex];

                              return (
                                <div
                                  key={slotIndex}
                                  className="
                                    px-4 py-3 mb-3
                                    rounded-xl
                                    border border-[#00ff66]/30
                                    bg-black/40
                                    transition-all duration-200
                                    hover:border-[#00ff66]
                                    hover:scale-[1.03]
                                    hover:shadow-[0_0_25px_rgba(0,255,100,0.5)]
                                  "
                                >
                                  {person ? (
                                    <>
                                      <span className="font-bold text-[#00ff66]">
                                        {getRankName(person.rank_id)}
                                      </span>{" "}
                                      <span>
                                        {person.name}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-gray-500">
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
    <main className="
      min-h-screen
      bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)]
      text-[#eafff2]
      p-10
    ">

      {/* BACK BUTTON */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-8 px-5 py-2 rounded-lg
          border border-[#00ff66]/50
          text-[#00ff66]
          font-semibold
          transition-all duration-200
          hover:bg-[#00ff66]/10
          hover:scale-105
        "
      >
        ← Return to Dashboard
      </button>

      {/* TITLE */}
      <h1 className="
        text-4xl font-bold tracking-widest
        text-[#00ff66]
        mb-12
        drop-shadow-[0_0_20px_rgba(0,255,100,0.6)]
      ">
        101ST DOOM BATTALION ROSTER
      </h1>

      {renderStructure()}

    </main>
  );
}