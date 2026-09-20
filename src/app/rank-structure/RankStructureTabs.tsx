"use client";

import type { ReactNode } from "react";
import { Layers3, Plane } from "lucide-react";
import { useState } from "react";

type RankStructureTabsProps = {
  overall: ReactNode;
  mos: ReactNode;
  overallRankCount: number;
  mosRankCount: number;
};

export default function RankStructureTabs({
  overall,
  mos,
  overallRankCount,
  mosRankCount,
}: RankStructureTabsProps) {
  const [activeTab, setActiveTab] = useState<"overall" | "mos">("overall");

  return (
    <>
      <div className="border-b border-[#00ff66]/20 bg-black/90">
        <div
          role="tablist"
          aria-label="Rank structure views"
          className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:px-12"
        >
          <button
            type="button"
            role="tab"
            id="rank-tab-overall"
            aria-controls="rank-panel-overall"
            aria-selected={activeTab === "overall"}
            onClick={() => setActiveTab("overall")}
            className={`flex min-h-16 items-center justify-center gap-3 border-x border-t px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition sm:text-sm ${
              activeTab === "overall"
                ? "border-[#00ff66]/60 bg-[#00ff66]/10 text-[#00ff66]"
                : "border-white/10 bg-black text-[#8ca095] hover:border-[#00ff66]/35 hover:text-white"
            }`}
          >
            <Layers3 size={18} aria-hidden="true" />
            <span>Overall</span>
            <span className="hidden text-[10px] font-medium text-current/70 sm:inline">{overallRankCount} ranks</span>
          </button>
          <button
            type="button"
            role="tab"
            id="rank-tab-mos"
            aria-controls="rank-panel-mos"
            aria-selected={activeTab === "mos"}
            onClick={() => setActiveTab("mos")}
            className={`flex min-h-16 items-center justify-center gap-3 border-x border-t px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition sm:text-sm ${
              activeTab === "mos"
                ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-300"
                : "border-white/10 bg-black text-[#8ca095] hover:border-cyan-300/35 hover:text-white"
            }`}
          >
            <Plane size={18} aria-hidden="true" />
            <span>MOS</span>
            <span className="hidden text-[10px] font-medium text-current/70 sm:inline">{mosRankCount} ranks</span>
          </button>
        </div>
      </div>

      <div
        role="tabpanel"
        id={`rank-panel-${activeTab}`}
        aria-labelledby={`rank-tab-${activeTab}`}
      >
        {activeTab === "overall" ? overall : mos}
      </div>
    </>
  );
}
