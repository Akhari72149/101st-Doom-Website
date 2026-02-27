"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

type TabKey = "DB" | "T1" | "C2" | "B3" | "H" | "D";

const mainTab = {
  key: "DB",
  label: "101st Doom Battalion",
  icon: "/icons/DBLogo.jpg",
  logo: "/WWA/DBLogo.jpg",
};

const unitTabs = [
  {
    key: "T1",
    label: "Tomahawk 1",
    icon: "/icons/tank.png",
    logo: "/WWA/T1.jpg",
    content: `
Tomahawk 1 is our armored spearhead unit.
Specializes in ground dominance and heavy assault operations.
Core focus: Break enemy lines and secure objectives.
    `,
  },
  {
    key: "C2",
    label: "Claymore 2",
    icon: "/icons/helicopter.png",
    logo: "/WWA/C2.jpg",
    content: `
Claymore 2 provides aerial superiority and rapid response.
Focus on mobility, air support, and tactical deployment.
    `,
  },
  {
    key: "B3",
    label: "Broadsword 3",
    icon: "/icons/mortar.png",
    logo: "/WWA/B3.jpg",
    content: `
Broadsword 3 specializes in indirect fire support.
Provides strategic suppression and battlefield control.
    `,
  },
  {
    key: "D",
    label: "Dagger",
    icon: "/icons/jetpack.png",
    logo: "/WWA/Dagger.jpg",
    content: `
Specializing in precision strikes, Dagger targets high-value enemy assets, infrastructure, and command elements to degrade enemy capability and secure strategic dominance for the wider campaign.

Built for deep operations, Dagger can detach to reinforce allied platoons or execute independent missions as needed, excelling behind enemy lines and operating most effectively in a target-rich environment surrounded by hostile forces.
    `,
  },
  {
    key: "H",
    label: "Hammer",
    icon: "/icons/Plane.png",
    logo: "/WWA/Hammer.jpg",
    content: `
Hammer functions as the elite aviation element of the 101st, specializing in air superiority, rapid insertion, and tactical aerial support.

It provides precision overwatch, battlefield mobility, and decisive control of the skies to ensure mission success across all operations.
    `,
  },
];

export default function WhoWeArePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("DB");

  /* ================= TAB BUTTON ================= */

  const renderTabButton = (
    tab: { key: string; label: string; icon: string },
    isPrimary = false
  ) => {
    const isActive = activeTab === tab.key;

    return (
      <button
        key={tab.key}
        onClick={() => setActiveTab(tab.key as TabKey)}
        className={`relative flex items-center gap-3 rounded-xl border transition-all duration-300
          ${
            isActive
              ? "bg-[#00ff66] text-black border-[#00ff66] shadow-[0_0_25px_rgba(0,255,100,0.8)]"
              : "bg-black/60 text-[#00ff66] border-[#00ff66]/40 hover:border-[#00ff66] hover:scale-105"
          }
          ${isPrimary ? "px-10 py-4 text-lg tracking-widest" : "px-6 py-3"}
        `}
      >
        <img
          src={tab.icon}
          alt={tab.label}
          className={`${isPrimary ? "w-24 h-24" : "w-14 h-14"} object-contain shrink-0`}
        />

        <span className="tracking-widest text-sm md:text-base">
          {tab.label}
        </span>
      </button>
    );
  };

  /* ================= CURRENT DATA ================= */

  const currentLabel =
    activeTab === "DB"
      ? mainTab.label
      : unitTabs.find((t) => t.key === activeTab)?.label;

  const currentLogo =
    activeTab === "DB"
      ? mainTab.logo
      : unitTabs.find((t) => t.key === activeTab)?.logo;

  const currentContent =
    activeTab === "DB"
      ? "The 101st Doom Battalion serves as the command authority overseeing all operational units."
      : unitTabs.find((t) => t.key === activeTab)?.content;

  /* ================= PAGE ================= */

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative min-h-screen flex flex-col text-white font-orbitron pb-16"
    >

      {/* ================= BACK BUTTON (✅ NEW) ================= */}
      <div className="absolute top-8 left-8 z-50">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-[#00ff66] text-[#00ff66] rounded-xl bg-black/60 backdrop-blur-lg hover:bg-[#00ff66] hover:text-black hover:scale-105 transition-all duration-300 shadow-lg"
        >
          ← Back
        </button>
      </div>

      {/* ================= BACKGROUND ================= */}
      <div
        className="absolute inset-0 bg-center bg-no-repeat bg-cover opacity-20 pointer-events-none z-0"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)] z-0" />

      <div className="relative z-10 flex flex-col w-full">

        {/* ================= HEADER ================= */}
        <div className="text-center pt-24 pb-12">
          <h1 className="text-4xl md:text-6xl font-bold tracking-[0.4em] text-[#00ff66]">
            WHO WE ARE
          </h1>
        </div>

        {/* ================= MAIN TAB ================= */}
        <div className="flex justify-center mb-6">
          <div className="bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 rounded-2xl p-4">
            {renderTabButton(mainTab, true)}
          </div>
        </div>

        {/* ================= UNIT TAB BAR ================= */}
        <div className="flex justify-center mb-12">
          <div className="flex gap-6 bg-black/50 backdrop-blur-xl border border-[#00ff66]/30 rounded-2xl p-4">
            {unitTabs.map((tab) => renderTabButton(tab))}
          </div>
        </div>

        {/* ================= CONTENT AREA ================= */}
        <div className="flex justify-center px-6 pb-20">
          <div className="relative w-full max-w-6xl bg-black/60 backdrop-blur-2xl border border-[#00ff66]/30 rounded-3xl p-10 shadow-[0_0_40px_rgba(0,255,100,0.2)]">

            <div className="absolute inset-0 pointer-events-none opacity-5 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ff66_3px)] rounded-3xl" />

            <h2 className="text-3xl text-[#00ff66] tracking-widest mb-6 relative">
              <div className="h-px w-32 bg-[#00ff66]/30 mb-4" />
              {currentLabel}
            </h2>

            {activeTab === "DB" && (
              <div className="inline-block px-4 py-1 mb-6 text-xs tracking-[0.4em] bg-gradient-to-r from-yellow-500 to-amber-400 text-black rounded-full shadow-[0_0_15px_rgba(255,215,0,0.7)]">
                HIGH COMMAND
              </div>
            )}

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="grid md:grid-cols-2 gap-10"
            >
              <div className="space-y-6 text-gray-300 leading-relaxed text-base md:text-lg whitespace-pre-line">
                {currentContent}
              </div>

              <div className="flex items-center justify-center">
                <div className="relative w-full h-[400px] rounded-2xl border border-[#00ff66]/30 bg-black/40 flex items-center justify-center p-6 overflow-hidden">
                  {currentLogo && (
                    <img
                      src={currentLogo}
                      alt="Unit Logo"
                      className="max-h-full max-w-full object-contain transition-all duration-500 drop-shadow-[0_0_30px_rgba(0,255,100,0.5)]"
                    />
                  )}
                </div>
              </div>
            </motion.div>

          </div>
        </div>
      </div>

      {/* ================= BOTTOM ACCENT ================= */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-70" />

    </motion.div>
  );
}