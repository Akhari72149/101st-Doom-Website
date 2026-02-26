"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

/* ================= TYPES ================= */

type CategoryKey = "CERT" | "MOS" | "CSHOP";

type TabItem = {
  key: string;
  label: string;
  rank: string;
  image: string;
};

/* ================= CATEGORIES ================= */

const categories: { key: CategoryKey; label: string }[] = [
  { key: "CERT", label: "Certifications" },
  { key: "MOS", label: "MOS" },
  { key: "CSHOP", label: "C-Shop" },
];

/* ================= TAB DATA ================= */

const tabs: Record<CategoryKey, TabItem[]> = {
  CERT: [
    { key: "U3", label: "Support", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U4", label: "Anti-Tank", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U5", label: "Grenadier", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U6", label: "Marksman", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U7", label: "Combat Engineer", rank: "CST", image: "/WWA/placeholder.jpg" },
    { key: "U8", label: "IFV", rank: "CST", image: "/WWA/placeholder.jpg" },
    { key: "U9", label: "MBT", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U10", label: "IDF", rank: "CST", image: "/WWA/IDF.jpg" },
    { key: "U11", label: "AV-7", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U12", label: "Drone Operator", rank: "VCT/CI", image: "/WWA/placeholder.jpg" },
    { key: "U13", label: "Weaponised Drone", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U14", label: "Adv. Gren", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U15", label: "Adv. Support", rank: "CSP", image: "/WWA/placeholder.jpg" },
    { key: "U16", label: "Adv. Marksman", rank: "VCT", image: "/WWA/placeholder.jpg" },
  ],

  MOS: [
    { key: "U1", label: "RTO", rank: "CR-C", image: "/WWA/placeholder.jpg" },
    { key: "U2", label: "CLS", rank: "CR-C", image: "/WWA/placeholder.jpg" },
    { key: "U17", label: "Hammer", rank: "CR-C", image: "/WWA/placeholder.jpg" },
  ],

  CSHOP: [
    { key: "U18", label: "Zeus", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U19", label: "Mission Builder", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U23", label: "Recruiters", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U24", label: "Drill Instructors", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U20", label: "GC Team", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U21", label: "Mod Team", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U22", label: "Media Team", rank: "CR-C", image: "/WWA/placeholder.jpg" },
  ],
};

/* ================= UNIT CONTENT MAP ================= */

const unitContent: Record<string, string> = {
  U10: `
IDF serves as the Mortar Certification for the 101st Doom Battalion.

Focused on precision indirect fire, IDF provides versatile battlefield support capable of engaging targets at both close and extended ranges.

Operating deployable mortar systems and vehicle-mounted platforms, IDF delivers adaptable firepower — from danger-close support to long-range suppression — ensuring sustained and responsive indirect coverage wherever it is required.
`,

  U3: `
Support Certification enables operators to provide sustained automatic fire and logistical reinforcement to frontline elements.

Focused on ammunition management, suppressive fire control, and positional dominance, Support-certified soldiers ensure squad-level combat endurance and battlefield stability.
`,
};


/* ================= COMPONENT ================= */

export default function ExpandedUnitsPage() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] =
    useState<CategoryKey>("CERT");
  const [activeTab, setActiveTab] =
    useState<string>(tabs["CERT"][0].key);

  const currentTabs = tabs[activeCategory];
  const activeUnit = currentTabs.find((u) => u.key === activeTab);

  /* ================= CATEGORY RENDER ================= */

  const renderCategory = (category: { key: CategoryKey; label: string }) => {
    const isActive = activeCategory === category.key;
    const categoryTabs = tabs[category.key];

    return (
      <button
        key={category.key}
        onClick={() => {
          setActiveCategory(category.key);
          setActiveTab(categoryTabs[0].key);
        }}
        className={`px-8 py-3 rounded-xl border transition-all duration-300
          ${
            isActive
              ? "bg-[#00ff66] text-black border-[#00ff66]"
              : "bg-black/60 text-[#00ff66] border-[#00ff66]/40 hover:scale-105"
          }
        `}
      >
        {category.label}
      </button>
    );
  };

  /* ================= TAB RENDER ================= */

  const renderTab = (unit: TabItem) => {
    const isActive = activeTab === unit.key;

    return (
      <button
        key={unit.key}
        onClick={() => setActiveTab(unit.key)}
        className={`px-6 py-4 rounded-xl border transition-all duration-300 flex flex-col items-center text-sm tracking-widest
          ${
            isActive
              ? "bg-[#00ff66] text-black border-[#00ff66]"
              : "bg-black/60 text-[#00ff66] border-[#00ff66]/40 hover:scale-105"
          }
        `}
      >
        <span className="font-semibold">{unit.label}</span>

        {unit.rank && (
          <span className="text-[10px] opacity-70 mt-1">
            Available From: {unit.rank}
          </span>
        )}
      </button>
    );
  };

  /* ================= PAGE ================= */

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
      className="relative min-h-screen flex flex-col text-white font-orbitron pb-16"
    >
      {/* BACK BUTTON */}
      <div className="absolute top-8 left-8 z-50">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-[#00ff66] text-[#00ff66]
                     rounded-xl bg-black/60 hover:bg-[#00ff66]
                     hover:text-black transition-all"
        >
          ← Back
        </button>
      </div>

      {/* BACKGROUND */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]" />

      <div className="relative z-10 flex flex-col items-center w-full pt-28">

        {/* CATEGORY BUTTONS */}
        <div className="flex gap-6 mb-12">
          {categories.map(renderCategory)}
        </div>

        {/* SUB TABS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 px-6 w-full max-w-7xl">
          {currentTabs.map(renderTab)}
        </div>

        {/* CONTENT BOX */}
        <div className="w-full max-w-6xl bg-black/60 backdrop-blur-2xl border border-[#00ff66]/30 rounded-3xl p-10">
          <div className="grid md:grid-cols-2 gap-10">

            {/* TEXT (Scrollable) */}
            <div className="max-h-[500px] overflow-y-auto pr-4 text-gray-300 text-base md:text-lg leading-relaxed whitespace-pre-line">
              {unitContent[activeTab] || "Content coming soon..."}
            </div>

            {/* IMAGE */}
            <div className="flex items-center justify-center">
              <div className="w-full h-[400px] rounded-2xl border border-[#00ff66]/30 bg-black/40 flex items-center justify-center p-6">
                {activeUnit?.image && (
                  <img
                    src={activeUnit.image}
                    alt={activeUnit.label}
                    className="max-h-full object-contain drop-shadow-[0_0_30px_rgba(0,255,100,0.5)]"
                  />
                )}
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-70" />
    </motion.div>
  );
}