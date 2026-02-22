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

  /* =====================================================
     FETCH PERSONNEL + RANKS
  ======================================================*/
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {

    const { data: rankData } = await supabase
      .from("ranks")
      .select("*");

    setRanks(rankData || []);

    const { data } = await supabase
      .from("personnel")
      .select("*")
      .order("name");

    setPersonnel(data || []);
  };

  /* =====================================================
     LOAD PROFILE
  ======================================================*/

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

  /* =====================================================
     HELPERS
  ======================================================*/

  const getRankName = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.name : "Unranked";
  };

  const getRankLevel = (rankId: string | null) => {
    const rank = ranks.find((r) => r.id === rankId);
    return rank ? rank.rank_level : 1;
  };

  const getRankBars = (rankId: string | null) => {
    const level = getRankLevel(rankId);
    return Math.max(level, 1);
  };

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString();
  };

  const calculateServiceYears = (date: string | null) => {
    if (!date) return 0;
    const now = new Date();
    const then = new Date(date);
    return Math.floor(
      (now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24 * 365)
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

  /* =====================================================
     FILTER
  ======================================================*/

  const filteredPersonnel = personnel.filter((p) =>
    `${getRankName(p.rank_id)} ${p.name}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  /* =====================================================
     UI
  ======================================================*/

  return (
    <div className="p-10 text-white max-w-4xl mx-auto font-mono">

      <button
        onClick={() => router.push("/")}
        className="mb-6 border border-[#004d00] px-4 py-2 hover:bg-[#002700] transition"
      >
        ← Return to Dashboard
      </button>

      <h1 className="text-2xl tracking-widest mb-6 border-b border-[#004d00] pb-4">
        PERSONNEL DOSSIER
      </h1>

      {/* SEARCH */}
      <input
        type="text"
        placeholder="Search by rank or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-black border border-[#004d00] p-3 w-full mb-6"
      />

      {/* SEARCH RESULTS */}
      {search && (
        <div className="border border-[#004d00] bg-black max-h-60 overflow-y-auto mb-6">
          {filteredPersonnel.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSearch("");
                loadProfile(p);
              }}
              className="p-3 border-b border-[#002700] cursor-pointer hover:bg-[#002700]"
            >
              {getRankName(p.rank_id)} {p.name}
            </div>
          ))}
        </div>
      )}

      {/* PROFILE */}
      {selectedPerson && (
        <div className="space-y-10">

          {/* MAIN CARD */}
          <div className="border border-[#004d00] p-8 bg-black">

            {/* RANK NAME */}
            <p className="text-sm tracking-[0.4em] text-gray-400 uppercase">
              {getRankName(selectedPerson.rank_id)}
            </p>

            {/* RANK BARS */}
            <div className="flex gap-2 mt-3 mb-4">
              {Array.from({
                length: getRankBars(selectedPerson.rank_id),
              }).map((_, i) => (
                <div key={i} className="h-1 w-10 bg-[#00ff66]" />
              ))}
            </div>

            <h2 className="text-4xl font-bold tracking-wide">
              {selectedPerson.name}
            </h2>

            <div className="border-t border-[#004d00] my-6"></div>

            {/* SERVICE */}
            <div>
              <p className="text-xs text-gray-400 mb-2 tracking-widest">
                YEARS OF SERVICE
              </p>

              <div className="w-full bg-[#001a00] h-4">
                <div
                  className="bg-[#00ff66] h-4"
                  style={{
                    width: `${Math.min(
                      calculateServiceYears(selectedPerson.created_at) * 10,
                      100
                    )}%`,
                  }}
                />
              </div>

              <p className="text-sm mt-2">
                {calculateServiceYears(selectedPerson.created_at)} Years
              </p>
            </div>

            <div className="border-t border-[#004d00] my-6"></div>

            {/* DETAILS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

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
                <p className="text-lg">
                  {getBilletFromSlot(selectedPerson.slotted_position)}
                </p>
              </div>

            </div>
          </div>

          {/* PROMOTION RECORD */}
          <div className="border border-[#004d00] p-8 bg-black">
            <h3 className="text-lg tracking-widest border-b border-[#004d00] pb-2 mb-4">
              PROMOTION RECORD
            </h3>

            {rankHistory.length === 0 ? (
              <p className="text-gray-500">
                No promotion history recorded.
              </p>
            ) : (
              rankHistory.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between py-2 border-b border-[#002700]"
                >
                  <span>
                    {getRankName(r.rank)}
                  </span>
                  <span className="text-gray-400">
                    {formatDate(r.changed_at)}
                  </span>
                </div>
              ))
            )}
          </div>

          {/* CERTIFICATIONS */}
          <div className="border border-[#004d00] p-8 bg-black">
            <h3 className="text-lg tracking-widest border-b border-[#004d00] pb-2 mb-4">
              QUALIFICATIONS
            </h3>

            {certifications.length === 0 ? (
              <p className="text-gray-500">
                No certifications recorded.
              </p>
            ) : (
              <div className="space-y-2">
                {certifications.map((c, index) => (
                  <div
                    key={index}
                    className="border-b border-[#002700] py-1"
                  >
                    {c.certification?.name}
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}