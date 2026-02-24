"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { structure } from "@/data/structure";
import { useRouter } from "next/navigation";

export default function PersonnelProfile() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [ranks, setRanks] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [certifications, setCertifications] = useState<any[]>([]);
  const [rankHistory, setRankHistory] = useState<any[]>([]);
  const router = useRouter();

  /* ===================================================== */
  /* DATA */
  /* ===================================================== */

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: rankData } = await supabase.from("ranks").select("*");
    setRanks(rankData || []);

    const { data } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    setPersonnel(data || []);
  };

  const loadProfile = async (person: any) => {
    setSelectedPerson(person);

    const { data: certs } = await supabase
      .from("personnel_certifications")
      .select(`certification:certification_id ( name )`)
      .eq("personnel_id", person.id);

    setCertifications(certs || []);

    const { data: history } = await supabase
      .from("rank_history")
      .select("*")
      .eq("personnel_id", person.id)
      .order("changed_at", { ascending: false });

    setRankHistory(history || []);
  };

  /* ===================================================== */
  /* HELPERS */
  /* ===================================================== */

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  const getRankLevel = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.rank_level : 1;
  };

  const getRankBars = (rankId: string | null) =>
    Math.max(getRankLevel(rankId), 1);

  const formatDate = (date: string | null) =>
    date ? new Date(date).toLocaleDateString() : "N/A";

  const calculateServiceYears = (date: string | null) => {
    if (!date) return 0;
    const now = new Date();
    const then = new Date(date);
    return Math.floor(
      (now.getTime() - then.getTime()) /
        (1000 * 60 * 60 * 24 * 365)
    );
  };

  const timeSince = (date: string | null) => {
    if (!date) return "N/A";
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) return `${years} year(s) ago`;
    if (months > 0) return `${months} month(s) ago`;
    return `${days} day(s) ago`;
  };

  const getBilletFromSlot = (slotId: string | null) => {
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

    return "Unassigned";
  };

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p.rank_id)} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* ===================================================== */
  /* UI */
  /* ===================================================== */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#eafff2] p-10">

      {/* BACK */}
      <button
        onClick={() => router.push("/pcs")}
        className="
          mb-6 px-4 py-2 rounded-lg
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

      <h1 className="text-4xl font-bold mb-8 text-[#00ff66] tracking-widest">
        PERSONNEL DOSSIER
      </h1>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search by rank or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="
          w-full mb-6 p-4 rounded-xl
          bg-black/40 backdrop-blur-md
          border border-[#00ff66]/40
          text-[#00ff66]
          placeholder:text-[#00ff66]/40
          focus:border-[#00ff66]
          focus:shadow-[0_0_15px_rgba(0,255,100,0.4)]
          transition-all duration-300
        "
      />

      {/* SEARCH RESULTS */}
      {search && (
        <div className="
          border border-[#00ff66]/40
          bg-black/50 backdrop-blur-md
          rounded-xl max-h-60 overflow-y-auto mb-6
        ">
          {filteredPersonnel.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSearch("");
                loadProfile(p);
              }}
              className="
                p-3 border-b border-[#00ff66]/20
                cursor-pointer
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

      {/* PROFILE */}
      {selectedPerson && (
        <div className="space-y-10">

          {/* MAIN PROFILE CARD */}
          <div className="
            p-10 rounded-3xl
            bg-black/50 backdrop-blur-xl
            border border-[#00ff66]/30
            shadow-[0_0_60px_rgba(0,255,100,0.15)]
          ">

            <p className="text-sm tracking-[0.4em] text-gray-400 uppercase">
              {getRankName(selectedPerson.rank_id)}
            </p>

            {/* RANK BARS */}
            <div className="flex gap-2 mt-3 mb-4">
              {Array.from({
                length: getRankBars(selectedPerson.rank_id),
              }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-10 bg-[#00ff66] shadow-[0_0_8px_rgba(0,255,100,0.8)]"
                />
              ))}
            </div>

            <h2 className="text-5xl font-bold text-[#00ff66]">
              {selectedPerson.name}
            </h2>

            <div className="border-t border-[#00ff66]/40 my-8" />

            {/* SERVICE */}
            <div>
              <p className="text-xs text-gray-400 mb-2 tracking-widest">
                YEARS OF SERVICE
              </p>

              <div className="w-full bg-[#001a0a] h-5 rounded-xl overflow-hidden">
                <div
                  className="bg-[#00ff66] h-full shadow-[0_0_10px_rgba(0,255,100,0.8)]"
                  style={{
                    width: `${Math.min(
                      calculateServiceYears(selectedPerson.created_at) * 10,
                      100
                    )}%`,
                  }}
                />
              </div>

              <p className="text-sm mt-2 text-[#00ff66]">
                {calculateServiceYears(selectedPerson.created_at)} Years
              </p>
            </div>

            <div className="border-t border-[#00ff66]/40 my-8" />

            {/* DETAILS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

              <div>
                <p className="text-xs text-gray-400 tracking-widest">
                  JOIN DATE
                </p>
                <p className="text-lg">
                  {formatDate(selectedPerson.created_at)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 tracking-widest">
                  LAST PROMOTION
                </p>
                <p className="text-lg">
                  {rankHistory.length > 0
                    ? timeSince(rankHistory[0].changed_at)
                    : "No promotions recorded"}
                </p>
              </div>

              <div className="md:col-span-2">
                <p className="text-xs text-gray-400 tracking-widest">
                  CURRENT BILLET
                </p>
                <p className="text-lg text-[#00ff66]">
                  {getBilletFromSlot(selectedPerson.slotted_position)}
                </p>
              </div>

            </div>
          </div>

          {/* PROMOTION + CERT CARDS */}
          {[
            {
              title: "PROMOTION RECORD",
              data: rankHistory,
              empty: "No promotion history recorded.",
              render: (r: any) => (
                <>
                  <span>{getRankName(r.rank)}</span>
                  <span className="text-gray-400">
                    {formatDate(r.changed_at)}
                  </span>
                </>
              ),
            },
            {
              title: "QUALIFICATIONS",
              data: certifications,
              empty: "No certifications recorded.",
              render: (c: any) => <span>{c.certification?.name}</span>,
            },
          ].map((section, idx) => (
            <div
              key={idx}
              className="
                p-8 rounded-2xl
                bg-black/50 backdrop-blur-xl
                border border-[#00ff66]/30
                shadow-[0_0_40px_rgba(0,255,100,0.15)]
              "
            >
              <h3 className="text-lg tracking-widest border-b border-[#00ff66]/40 pb-3 mb-4">
                {section.title}
              </h3>

              {section.data.length === 0 ? (
                <p className="text-gray-400">{section.empty}</p>
              ) : (
                <div className="space-y-3">
                  {section.data.map((item: any, i: number) => (
                    <div
                      key={i}
                      className="flex justify-between border-b border-[#00ff66]/20 py-2"
                    >
                      {section.render(item)}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

        </div>
      )}
    </div>
  );
}