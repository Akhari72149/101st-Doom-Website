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
  const [activeTab, setActiveTab] = useState<"qual" | "trainer">("qual");

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
  /* CERT FILTERS FOR TABS */
  /* ===================================================== */

  const trainerCerts = certifications.filter((c: any) =>
    c.certification?.name?.toLowerCase().includes("trainer")
  );

  const normalCerts = certifications.filter(
    (c: any) =>
      !c.certification?.name?.toLowerCase().includes("trainer")
  );

  /* ===================================================== */
  /* UI */
  /* ===================================================== */

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_center,#001f0f_0%,#000a06_100%)] text-[#eafff2] p-10">

      <button
        onClick={() => router.push("/pcs")}
        className="mb-6 px-4 py-2 rounded-lg border border-[#00ff66]/50 text-[#00ff66] font-semibold hover:bg-[#00ff66]/10 hover:scale-105 transition"
      >
        ← Return to Dashboard
      </button>

      <h1 className="text-4xl font-bold mb-8 text-[#00ff66] tracking-widest">
        PERSONNEL DOSSIER
      </h1>

      <input
        type="text"
        placeholder="Search by rank or name..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-6 p-4 rounded-xl bg-black/40 border border-[#00ff66]/40 text-[#00ff66] placeholder:text-[#00ff66]/40"
      />

      {search && (
        <div className="border border-[#00ff66]/40 bg-black/50 rounded-xl max-h-60 overflow-y-auto mb-6">
          {filteredPersonnel.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                setSearch("");
                loadProfile(p);
              }}
              className="p-3 border-b border-[#00ff66]/20 cursor-pointer hover:bg-[#00ff66]/10 hover:text-[#00ff66] transition"
            >
              {getRankName(p.rank_id)} {p.name}
            </div>
          ))}
        </div>
      )}

      {selectedPerson && (
        <div className="space-y-10">

          {/* PROFILE CARD */}
          <div className="p-10 rounded-3xl bg-black/50 border border-[#00ff66]/30">

            <p className="text-sm tracking-[0.4em] text-gray-400 uppercase">
              {getRankName(selectedPerson.rank_id)}
            </p>

            <div className="flex gap-2 mt-3 mb-4">
              {Array.from({
                length: getRankBars(selectedPerson.rank_id),
              }).map((_, i) => (
                <div
                  key={i}
                  className="h-1 w-10 bg-[#00ff66]"
                />
              ))}
            </div>

            <h2 className="text-5xl font-bold text-[#00ff66]">
              {selectedPerson.name}
            </h2>

            <div className="border-t border-[#00ff66]/40 my-8" />

            {/* ✅ CURRENT BILLET + TEAMSPEAK + YEARS STILL HERE */}

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
                  CURRENT BILLET
                </p>
                <p className="text-lg text-[#00ff66]">
                  {getBilletFromSlot(selectedPerson.slotted_position)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 tracking-widest">
                  TEAMSPEAK ID
                </p>
                <p className="text-lg text-[#00ff66]">
                  {selectedPerson.ts_id || "Not Set"}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-400 tracking-widest">
                  YEARS OF SERVICE
                </p>
                <div className="w-full bg-[#001a0a] h-5 rounded-xl overflow-hidden mt-2">
                  <div
                    className="bg-[#00ff66] h-full"
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

            </div>
          </div>

          {/* TAB SECTION — ONLY ADDITION IS TRAINER TAB */}

          <div className="p-8 rounded-2xl bg-black/50 border border-[#00ff66]/30">

            <div className="flex gap-6 border-b border-[#00ff66]/40 pb-3 mb-6">

              <button
                onClick={() => setActiveTab("qual")}
                className={`tracking-widest text-sm ${
                  activeTab === "qual"
                    ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                    : "text-gray-400"
                }`}
              >
                QUALIFICATIONS
              </button>

              <button
                onClick={() => setActiveTab("trainer")}
                className={`tracking-widest text-sm ${
                  activeTab === "trainer"
                    ? "text-[#00ff66] border-b-2 border-[#00ff66]"
                    : "text-gray-400"
                }`}
              >
                TRAINER QUAL
              </button>

            </div>

            {activeTab === "qual" ? (
              normalCerts.length === 0 ? (
                <p className="text-gray-400">
                  No certifications recorded.
                </p>
              ) : (
                <div className="space-y-3">
                  {normalCerts.map((c: any, i: number) => (
                    <div
                      key={i}
                      className="border-b border-[#00ff66]/20 py-2"
                    >
                      {c.certification?.name}
                    </div>
                  ))}
                </div>
              )
            ) : trainerCerts.length === 0 ? (
              <p className="text-gray-400">
                No trainer certifications recorded.
              </p>
            ) : (
              <div className="space-y-3">
                {trainerCerts.map((c: any, i: number) => (
                  <div
                    key={i}
                    className="border-b border-[#00ff66]/20 py-2"
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