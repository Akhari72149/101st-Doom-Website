"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

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
    { key: "U3", label: "Support", rank: "CT", image: "/WWA/support.jpg" },
    { key: "U4", label: "Anti-Tank", rank: "CT", image: "/WWA/at.jpg" },
    { key: "U5", label: "Grenadier", rank: "CT", image: "/WWA/gren.jpg" },
    { key: "U6", label: "Marksman", rank: "CT", image: "/WWA/Mark.jpg" },
    { key: "U7", label: "Combat Engineer", rank: "CST", image: "/WWA/ce.jpg" },
    { key: "U8", label: "IFV", rank: "CST", image: "/WWA/placeholder.jpg" },
    { key: "U9", label: "MBT", rank: "VCT", image: "/WWA/mbt.jpg" },
    { key: "U10", label: "IDF", rank: "CST", image: "/WWA/IDF.jpg" },
    { key: "U11", label: "AV-7", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U12", label: "Drone Operator", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U13", label: "Weaponised Drone", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U23", label: "Forge", rank: "VCT", image: "/WWA/forge.jpg" },
    { key: "U14", label: "Adv. Gren", rank: "VCT", image: "/WWA/placeholder.jpg" },
    { key: "U15", label: "Adv. Support", rank: "CSP", image: "/WWA/placeholder.jpg" },
    { key: "U16", label: "Adv. Marksman", rank: "VCT", image: "/WWA/placeholder.jpg" },
  ],
  MOS: [
    { key: "U1", label: "RTO", rank: "CR-C", image: "/WWA/rto.jpg" },
    { key: "U2", label: "CLS", rank: "CR-C", image: "/WWA/sus.jpg" },
    { key: "U17", label: "Hammer", rank: "CR-C", image: "/WWA/hammer.jpg" },
  ],
  CSHOP: [
    { key: "U18", label: "Zeus", rank: "CT", image: "/WWA/zeus.jpg" },
    { key: "U19", label: "Mission Builder", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U23", label: "Recruiters", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U24", label: "Drill Instructors", rank: "CT", image: "/WWA/DI.jpg" },
    { key: "U20", label: "GC Team", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U21", label: "Mod Team", rank: "CT", image: "/WWA/placeholder.jpg" },
    { key: "U22", label: "Media Team", rank: "CR-C", image: "/WWA/media.jpg" },
    { key: "U25", label: "Server Maintenance", rank: "N/A", image: "/WWA/server.jpg" },
  ],
};

/* ================= SOFT GLOW RANK STYLES ================= */

const getRankStyles = (rank?: string) => {
  if (!rank) return "bg-gray-600/20 text-white border-gray-600";

  if (rank === "CT") {
    return "bg-green-500/10 border-green-400 text-green-400 shadow-[0_0_20px_rgba(0,255,100,0.4)]";
  }

  if (rank === "VCT") {
    return "bg-purple-600/10 border-purple-500 text-purple-400 shadow-[0_0_20px_rgba(140,0,255,0.4)]";
  }

  if (rank === "CSP") {
    return "bg-yellow-500/10 border-yellow-500 text-yellow-400 shadow-[0_0_20px_rgba(255,200,0,0.4)]";
  }

  return "bg-gray-700/20 text-white border-gray-700";
};

/* ================= TRANSITIONS ================= */

const tabTransitions: Record<string, string> = {
  U3: "U15",
  U5: "U14",
  U6: "U16",
  U8: "U9",
  U10: "U11",
  U12: "U13",
};

const reverseTransitions: Record<string, string> = Object.fromEntries(
  Object.entries(tabTransitions).map(([k, v]) => [v, k])
);

const hiddenFromGrid = new Set(Object.values(tabTransitions));

/* ================= COMPONENT ================= */

export default function ExpandedUnitsPage() {
  const router = useRouter();

  const [activeCategory, setActiveCategory] =
    useState<CategoryKey>("CERT");

  const [activeTab, setActiveTab] =
    useState<string>(tabs["CERT"][0].key);

  const [direction, setDirection] = useState(1);
  const [modalImage, setModalImage] = useState<string | null>(null);

  const currentTabs = tabs[activeCategory];
  const visibleTabs = currentTabs.filter(
    (tab) => !hiddenFromGrid.has(tab.key)
  );

  const activeUnit = currentTabs.find((u) => u.key === activeTab);
  const nextTabKey = tabTransitions[activeTab];
  const nextUnit = currentTabs.find((u) => u.key === nextTabKey);
  const previousTabKey = reverseTransitions[activeTab];
  const previousUnit = currentTabs.find((u) => u.key === previousTabKey);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && nextUnit) {
        setDirection(1);
        setActiveTab(nextUnit.key);
      }

      if (e.key === "ArrowLeft" && previousUnit) {
        setDirection(-1);
        setActiveTab(previousUnit.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextUnit, previousUnit]);

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
          className="px-6 py-2 border border-[#00ff66]/40 text-[#00ff66]
                     rounded-xl bg-black/60
                     hover:bg-[#00ff66]/10 hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]
                     transition-all"
        >
          ← Back
        </button>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full pt-28">

        {/* CATEGORY BUTTONS */}
        <div className="flex gap-6 mb-12">
          {categories.map((category) => {
            const isActive = activeCategory === category.key;

            return (
              <button
                key={category.key}
                onClick={() => {
                  setActiveCategory(category.key);
                  setActiveTab(tabs[category.key][0].key);
                }}
                className={`px-8 py-3 rounded-xl border transition-all relative
                  ${
                    isActive
                      ? "bg-transparent text-[#00ff66] border-[#00ff66]/60 shadow-[0_0_20px_rgba(0,255,100,0.4)]"
                      : "bg-black/60 text-[#00ff66] border-[#00ff66]/30 hover:scale-105"
                  }
                `}
              >
                {category.label}

                {isActive && (
                  <motion.div
                    layoutId="categoryUnderline"
                    className="absolute -bottom-2 left-0 right-0 h-1 bg-[#00ff66]/60 rounded-full"
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* SUB TABS WITH FOLLOWING GRADIENT GLOW */}
<div className="relative w-full max-w-7xl px-6 mb-12">

  {/* TAB GRID */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
    {visibleTabs.map((unit) => {
      const isActive = activeTab === unit.key;

      return (
        <button
          key={unit.key}
          onClick={() => setActiveTab(unit.key)}
          className={`px-6 py-4 rounded-xl border transition-all text-center relative
            ${
              isActive
                ? "border-[#00ff66]/60 bg-[#00ff66]/5 text-[#00ff66] shadow-[0_0_25px_rgba(0,255,100,0.35)]"
                : "bg-black/60 text-[#00ff66] border-[#00ff66]/30 hover:scale-105"
            }
          `}
        >
          <div className="font-semibold">{unit.label}</div>

          {unit.rank && (
            <div className="text-[10px] opacity-70 mt-1">
              Available at: {unit.rank}
            </div>
          )}

          {/* ACTIVE TAB GLOW */}
          {isActive && (
            <motion.div
              layoutId="tabGlow"
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-transparent via-[#00ff66]/20 to-transparent blur-xl -z-10"
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
            />
          )}
        </button>
      );
    })}
  </div>

</div>

        {/* CONTENT BOX */}
        <div className="w-full max-w-6xl bg-gradient-to-br from-black/80 via-black/60 to-[#001f11]/40 backdrop-blur-2xl border border-[#00ff66]/20 shadow-[0_0_80px_rgba(0,255,100,0.05)] rounded-3xl p-10">

          {/* NAVIGATION ROW */}
          <div className="grid grid-cols-3 items-center mb-6 min-h-[40px]">

            <div className="flex justify-start">
              {previousUnit && (
                <button
                  onClick={() => {
                    setDirection(-1);
                    setActiveTab(previousUnit.key);
                  }}
                  className="px-4 py-2 border border-[#00ff66]/40
                             text-[#00ff66] rounded-xl
                             hover:bg-[#00ff66]/10 hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]
                             transition-all"
                >
                  ← {previousUnit.label}
                </button>
              )}
            </div>

            {/* CENTER BADGE */}
            <div className="flex justify-center items-center">
              <AnimatePresence mode="wait">
                {activeUnit?.rank && (
                  <motion.div
                    key={activeTab}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span className="opacity-70">Available at:</span>

                    <motion.div
                      initial={{ boxShadow: "0 0 0px rgba(0,0,0,0)" }}
                      animate={{
                        boxShadow: [
                          "0 0 0px rgba(0,0,0,0)",
                          "0 0 20px currentColor",
                          "0 0 0px rgba(0,0,0,0)",
                        ],
                      }}
                      transition={{ duration: 0.8 }}
                      className={`px-4 py-1 rounded-full font-bold tracking-wide border ${getRankStyles(
                        activeUnit.rank
                      )}`}
                    >
                      {activeUnit.rank}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex justify-end">
              {nextUnit && (
                <button
                  onClick={() => {
                    setDirection(1);
                    setActiveTab(nextUnit.key);
                  }}
                  className="px-4 py-2 bg-[#00ff66]/10 text-[#00ff66]
                             rounded-xl border border-[#00ff66]/40
                             hover:scale-105 hover:shadow-[0_0_15px_rgba(0,255,100,0.3)]
                             transition-all"
                >
                  {nextUnit.label} →
                </button>
              )}
            </div>

          </div>

          {/* DIVIDER */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-[#00ff66]/20 to-transparent mb-8" />

          {/* CONTENT */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={activeTab}
              custom={direction}
              initial={{ x: direction > 0 ? 300 : -300, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction > 0 ? -300 : 300, opacity: 0 }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
              className="grid md:grid-cols-2 gap-10"
            >
              <div className="max-h-[500px] overflow-y-auto pr-4 text-gray-300 whitespace-pre-line">
                {"Content coming soon..."}
              </div>

              <div className="flex items-center justify-center">
                <div className="w-full h-[400px] rounded-2xl border border-[#00ff66]/20 bg-black/40 flex items-center justify-center p-6">
                  {activeUnit?.image && (
                    <img
                      src={activeUnit.image}
                      alt={activeUnit.label}
                      onClick={() => setModalImage(activeUnit.image)}
                      className="max-h-full object-contain cursor-pointer
                                 hover:scale-105 transition-transform
                                 drop-shadow-[0_0_30px_rgba(0,255,100,0.4)]"
                    />
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

        </div>
      </div>

      {/* IMAGE MODAL */}
      <AnimatePresence>
        {modalImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setModalImage(null)}
            className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50"
          >
            <motion.img
              src={modalImage}
              alt="Zoomed"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="max-w-[90%] max-h-[90%] rounded-3xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}