"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

type TabKey = "DB" | "T1" | "C2" | "B3" | "D";

type TabItem = {
  key: TabKey;
  label: string;
  icon: string;
  logo: string;
  content?: string;
  badge?: string;
};

const mainTab: TabItem = {
  key: "DB",
  label: "101st Doom Battalion",
  icon: "/icons/DBLogo.jpg",
  logo: "/WWA/DBLogo.jpg",
  badge: "HIGH COMMAND",
};

const unitTabs: TabItem[] = [
  {
    key: "T1",
    label: "Tomahawk 1",
    icon: "/icons/tank.png",
    logo: "/WWA/T1.jpg",
    content: `Tomahawk 1 meets every challenge with unbreakable force. Our vehicle crews, Scimitar, carry the firepower to answer any threat, while Tomahawk infantry adapt and overcome on the ground.

Together, no enemy can withstand the will of steel and lead.

Breach in steel. Dismount in fire.
Doctrine: Shock. Roll. Dismount. Dominate.`,
  },
  {
    key: "C2",
    label: "Claymore 2",
    icon: "/icons/helicopter.png",
    logo: "/WWA/C2.jpg",
    content: `Claymore 2 specializes in Air Assault operations, executing rapid deployments to overwhelm and dismantle enemy defenses with speed and precision. Acting as the Galactic Marine spearhead of the 101st, the platoon breaches fortified positions and disrupts enemy coordination to create decisive openings for follow-on forces.

After securing objectives, the unit swiftly re-embarks and prepares for immediate redeployment to the next target — maintaining constant pressure and operational momentum.

Doctrine: Strike. Break. Advance.`,
  },
  {
    key: "B3",
    label: "Broadsword 3",
    icon: "/icons/mortar.png",
    logo: "/WWA/B3.jpg",
    content: `Forged in the legacy of the Clone Wars, this elite unit specializes in high-velocity orbital insertions and rapid planetary assaults. Deploying from armored drop pods, they strike contested zones with speed and precision, seizing the initiative before the enemy can mount a response.

Upon landing, they transition immediately into heavy fire support operations. Equipped with rotary cannons, missile systems, and deployable artillery, they suppress fortified positions and dismantle armored threats while forward observers coordinate devastating indirect fire support.

Doctrine: Shock. Establish. Overwhelm.

When the pods hit the ground, the battle is already decided.`,
  },
  {
    key: "D",
    label: "Dagger",
    icon: "/icons/jetpack.png",
    logo: "/WWA/Dagger.jpg",
    content: `Specializing in precision strikes, Dagger targets high-value enemy assets, infrastructure, and command elements to degrade enemy capability and secure strategic dominance for the wider campaign.

Built for deep operations, Dagger can detach to reinforce allied platoons or execute independent missions as needed, excelling behind enemy lines and operating most effectively in a target-rich environment surrounded by hostile forces.`,
  },
];

const tabs: TabItem[] = [mainTab, ...unitTabs];

function TabButton({
  tab,
  active,
  isPrimary = false,
  onClick,
}: {
  tab: TabItem;
  active: boolean;
  isPrimary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-xl border transition-all duration-300 ${
        active
          ? "border-[#00ff66] bg-[#00ff66] text-black shadow-[0_0_20px_rgba(0,255,100,0.45)]"
          : "border-[#00ff66]/30 bg-black/60 text-[#00ff66] hover:border-[#00ff66] hover:bg-[#00ff66]/8 hover:scale-[1.02]"
      } ${isPrimary ? "px-5 py-3" : "px-4 py-3"}`}
    >
      <img
        src={tab.icon}
        alt={tab.label}
        className={`shrink-0 object-contain ${
          isPrimary ? "h-14 w-14" : "h-10 w-10"
        }`}
      />
      <span className={`${isPrimary ? "text-sm md:text-base" : "text-xs md:text-sm"} tracking-widest`}>
        {tab.label}
      </span>
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

export default function WhoWeArePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>("DB");

  const activeTabData = useMemo(() => {
    return tabs.find((tab) => tab.key === activeTab) ?? mainTab;
  }, [activeTab]);

  const currentContent =
    activeTab === "DB"
      ? "The 101st Doom Battalion serves as the command authority overseeing all operational units."
      : activeTabData.content || "";

  const currentLogo = activeTabData.logo;
  const currentLabel = activeTabData.label;
  const currentBadge = activeTabData.badge;

  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
      className="relative min-h-screen overflow-x-hidden pb-10 text-white"
    >
      <div className="absolute inset-0 -z-10">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('/background/bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]" />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-[96rem] flex-col px-4 py-6 sm:px-6 lg:px-10">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="mb-5 inline-flex w-fit items-center rounded-xl border border-[#00ff66]/40 px-4 py-2 font-semibold text-[#00ff66] transition hover:scale-105 hover:bg-[#00ff66]/10"
        >
          ← Return Home
        </button>

        <section className="mb-6 rounded-3xl border border-[#00ff66]/18 bg-black/50 p-6 shadow-[0_0_28px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-6">
          <div className="text-xs uppercase tracking-[0.35em] text-[#7da28c]">
            Command Dossier
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[0.22em] text-[#00ff66] sm:text-5xl">
            WHO WE ARE
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-300">
            A compact overview of the 101st Doom Battalion and its line platoons.
          </p>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatPill label="Root Formation" value="101st Doom Battalion" />
            <StatPill label="Line Units" value="Tomahawk, Claymore, Broadsword" />
            <StatPill label="Special Detachment" value="Dagger" />
          </div>

          <div className="mt-6">
            <div className="mb-3 text-xs uppercase tracking-[0.28em] text-[#7da28c]">
              Select Platoon
            </div>

            <div className="overflow-x-auto pb-1">
              <div className="flex min-w-max gap-3">
                {tabs.map((tab) => (
                  <TabButton
                    key={tab.key}
                    tab={tab}
                    active={activeTab === tab.key}
                    isPrimary={tab.key === "DB"}
                    onClick={() => setActiveTab(tab.key)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-[#00ff66]/18 bg-black/55 p-5 shadow-[0_0_28px_rgba(0,255,100,0.08)] backdrop-blur-xl sm:p-6">
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-[0.28em] text-[#7da28c]">
                Current Entry
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-bold tracking-[0.14em] text-[#00ff66] sm:text-3xl">
                  {currentLabel}
                </h2>

                {currentBadge && (
                  <span className="rounded-full border border-yellow-400/30 bg-gradient-to-r from-yellow-500 to-amber-400 px-3 py-1 text-[11px] font-semibold tracking-[0.22em] text-black">
                    {currentBadge}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatPill
                label="Selected"
                value={activeTab === "DB" ? "Command" : "Line Unit"}
              />
              <StatPill
                label="Focus"
                value={activeTab === "DB" ? "Overview" : "Doctrine"}
              />
              <StatPill label="Mode" value="Information" />
            </div>
          </div>

          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-white/10 bg-black/35 p-4 text-sm leading-7 text-gray-300 sm:text-base">
                <p className="whitespace-pre-line">{currentContent}</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatPill
                  label="Formation"
                  value={activeTab === "DB" ? "Battalion HQ" : currentLabel}
                />
                <StatPill label="Presentation" value="Dossier View" />
                <StatPill
                  label="Status"
                  value={activeTab === "DB" ? "Command" : "Operational"}
                />
              </div>
            </div>

            <div className="flex items-center justify-center">
              <div className="relative w-full overflow-hidden rounded-3xl border border-[#00ff66]/18 bg-black/40 p-4">
                <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,255,102,0.05)_3px)] opacity-35" />
                <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.1),transparent_65%)]" />

                <div className="relative flex min-h-[300px] items-center justify-center">
                  {currentLogo && (
                    <img
                      src={currentLogo}
                      alt={currentLabel}
                      className="max-h-[270px] max-w-full object-contain drop-shadow-[0_0_26px_rgba(0,255,100,0.35)]"
                    />
                  )}
                </div>

                <div className="relative mt-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-center">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-gray-500">
                    Selected Emblem
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {currentLabel}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>
      </div>

      <div className="fixed bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-[#00ff66] to-transparent opacity-70" />
    </motion.div>
  );
}