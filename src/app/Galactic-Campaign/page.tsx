"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/* ================= PHASE CONFIG ================= */

const initialPhases = [
  {
    id: 1,
    name: "Phase 1 — Moon Securing",
    description:
      "Secure Triton and Oberon to establish orbital dominance.",
    objectives: [
      { id: "t1", name: "Triton: Secure Guns", complete: false },
      { id: "t2", name: "Triton: Secure Shipyard", complete: false },
      { id: "o1", name: "Oberon: Secure Radar Facilities", complete: false },
      { id: "o2", name: "Oberon: Secure Supply Depots", complete: false },
    ],
  },
  {
    id: 2,
    name: "Phase 2 — Industrial Collapse",
    description:
      "Destroy droid factories and capture mining infrastructure.",
    objectives: [
      { id: "f1", name: "Destroy Droid Factories", complete: false },
      { id: "m1", name: "Capture Mining Operations", complete: false },
    ],
  },
  {
    id: 3,
    name: "Phase 3 — Population Control",
    description:
      "Subdue corporate security and civilian militia resistance.",
    objectives: [
      { id: "s1", name: "Neutralize Security Corporation", complete: false },
      { id: "c1", name: "Suppress Civilian Militia", complete: false },
    ],
  },
];

export default function GalacticCampaignPage() {
  const router = useRouter();

  const [phases] = useState(initialPhases);
  const [activePhase, setActivePhase] = useState(1);

  /* ================= CINEMATIC INTRO ================= */

  const [showIntro, setShowIntro] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  /* ================= ANIMATED MILITARY COUNTERS ================= */

  const cloneTarget = 256;
  const droidTarget = 2100;

  const [cloneDisplay, setCloneDisplay] = useState(0);
  const [droidDisplay, setDroidDisplay] = useState(0);
  const [cloneShake, setCloneShake] = useState(false);
  const [droidShake, setDroidShake] = useState(false);
  const [sideOpOpen, setSideOpOpen] = useState(false);
  const [landfallOpen, setLandfallOpen] = useState(false);

  const animateCounter = (
    target: number,
    setValue: React.Dispatch<React.SetStateAction<number>>,
    triggerShake: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    let current = 0;

    const interval = setInterval(() => {
      const step = Math.max(1, Math.floor(target * 0.01));
      current += step;

      if (current >= target) {
        current = target;
        setValue(current);
        triggerShake(true);
        setTimeout(() => triggerShake(false), 300);
        clearInterval(interval);
        return;
      }

      setValue(current);
    }, 80);
  };

  useEffect(() => {
    if (showIntro) return;

    animateCounter(cloneTarget, setCloneDisplay, setCloneShake);
    animateCounter(droidTarget, setDroidDisplay, setDroidShake);
  }, [showIntro]);

  /* ================= SIDE OP COUNTDOWN ================= */

  const getSideOpTarget = () => {
    const now = new Date();
    const target = new Date();
    target.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7));
    target.setHours(0, 0, 0, 0);
    return target;
  };

  const [timeLeft, setTimeLeft] = useState("Loading...");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const target = getSideOpTarget();

    const interval = setInterval(() => {
      const diff = target.getTime() - new Date().getTime();

      if (diff <= 0) {
        setIsActive(true);
        setTimeLeft("00:00:00");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setTimeLeft(
        `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0"
        )}:${String(s).padStart(2, "0")}`
      );
    }, 80);

    return () => clearInterval(interval);
  }, []);

  /* ================= LANDING COUNTDOWN ================= */

  const getLandfallTarget = () => {
    const now = new Date();
    const target = new Date();

    const daysUntilSaturday = (6 - now.getDay() + 7) % 7;

    target.setDate(now.getDate() + daysUntilSaturday);
    target.setHours(0, 0, 0, 0);

    return target;
  };

  const [landfallTime, setLandfallTime] = useState("Loading...");
  const [landfallActive, setLandfallActive] = useState(false);

  useEffect(() => {
    const target = getLandfallTarget();

    const interval = setInterval(() => {
      const diff = target.getTime() - new Date().getTime();

      if (diff <= 0) {
        setLandfallActive(true);
        setLandfallTime("00:00:00");
        clearInterval(interval);
        return;
      }

      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);

      setLandfallTime(
        `${String(h).padStart(2, "0")}:${String(m).padStart(
          2,
          "0"
        )}:${String(s).padStart(2, "0")}`
      );
    }, 80);

    return () => clearInterval(interval);
  }, []);

  /* ================= STARFIELD ================= */

  const [stars, setStars] = useState<any[]>([]);

  useEffect(() => {
    const generated = Array.from({ length: 120 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.05 + 0.02,
    }));
    setStars(generated);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setStars((prev) =>
        prev.map((star) => ({
          ...star,
          y: star.y > 100 ? 0 : star.y + star.speed,
        }))
      );
    }, 16);
    return () => clearInterval(interval);
  }, []);

  /* ================= PHASE LOCK LOGIC (UPDATED ONLY) ================= */

  const phase1Complete = phases[0]?.objectives.every(
    (o: any) => o.complete
  );

  const phase2Complete = phases[1]?.objectives.every(
    (o: any) => o.complete
  );

  /* ================= METRICS ================= */

  const totalObjectives = phases.reduce(
    (acc, phase) => acc + phase.objectives.length,
    0
  );

  const completedObjectives = phases.reduce(
    (acc, phase) =>
      acc + phase.objectives.filter((o) => o.complete).length,
    0
  );

  const planetControl = Math.floor(
    (completedObjectives / totalObjectives) * 100
  );

  const enemyStrength = 100 - planetControl;

  const currentPhase = phases.find((p) => p.id === activePhase)!;

  /* ================= LORE ================= */

  const [openLore, setOpenLore] = useState<string | null>(null);

  const toggleLore = (section: string) => {
    setOpenLore(openLore === section ? null : section);
  };
  

  /* ================= UI ================= */

  return (
    <div className="relative min-h-screen text-white font-orbitron overflow-hidden">

      {/* CINEMATIC INTRO */}
      <div
        className={`absolute inset-0 flex items-center justify-center z-50 bg-black transition-opacity duration-1000 ${
          showIntro ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="text-center animate-pulse">
          <h1 className="text-4xl md:text-6xl text-[#00ff66] font-bold tracking-widest mb-6">
            REPUBLIC MILITARY COMMAND
          </h1>
          <p className="text-xl text-yellow-400 mb-2">
            OPERATION: YOABOS
          </p>
          <p className="text-m text-red-500">
            Clearance Level: High Command
          </p>
        </div>
      </div>

      {/* BACKGROUND */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]" />

      {/* STARFIELD */}
      <div className="absolute inset-0 pointer-events-none">
        {stars.map((star) => (
          <div
            key={star.id}
            style={{
              position: "absolute",
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: star.size,
              height: star.size,
              background: "#00ff66",
              borderRadius: "50%",
              opacity: 0.7,
              boxShadow: "0 0 6px #00ff66",
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex">
        <div className="flex-1 p-10 space-y-10">

          <button
            onClick={() => router.push("/")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66]"
          >
            ← Back
          </button>

          <button
            onClick={() => router.push("/GC-Logi")}
            className="px-4 py-2 border border-[#00ff66] text-[#00ff66] hover:scale-105 transition-all duration-200"
          >
          GC Logistics Hub
          </button>

          <h1 className="text-5xl text-[#00ff66] font-bold">
            {isActive ? "SIDE OPERATION ACTIVE" : "Galactic Campaign"}
          </h1>

{/* ================= SIDE OP BOX ================= */}

<div className="border border-[#00ff66]/40 bg-black/50 rounded-2xl overflow-hidden">

  {/* HEADER (ALWAYS VISIBLE + CONTAINS COUNTDOWN) */}
  <button
    onClick={() => setSideOpOpen(!sideOpOpen)}
    className="w-full flex justify-between items-center p-6 
               hover:bg-[#00ff66]/10 transition"
  >

    <div className="text-left">
      <h2 className="text-2xl text-[#00ff66] font-bold">
        🛑 GC Side Operation
      </h2>

      {/* ✅ COUNTDOWN MOVED HERE */}
      <div className="mt-1">
        <span className="text-sm text-yellow-400">
          📅 Thursday — 7:00 PM EST
        </span>

        <div className="text-xl text-green-400 font-mono">
          {isActive ? "OPERATION ACTIVE" : timeLeft}
        </div>
      </div>
    </div>

    <span className="text-xl text-[#00ff66]">
      {sideOpOpen ? "▲" : "▼"}
    </span>

  </button>

  {/* COLLAPSIBLE CONTENT */}
  <div
    className={`
      overflow-hidden transition-all duration-500
      ${sideOpOpen ? "max-h-[2000px] opacity-100 p-6" : "max-h-0 opacity-0"}
    `}
  >

    {/* Announcement Text */}
    <div className="text-sm text-gray-300 leading-relaxed space-y-4">

      <p>
        A platoon of ARF troopers has been pushed behind enemy lines
        after heavy casualties. Your mission is to stealthily return
        to friendly territory with limited supplies.
      </p>

      <p>
        Detection means death. This is a one life operation.
        Team coordination and discretion are mandatory.
      </p>

      <div className="border-t border-[#00ff66]/20 pt-4">

        <p className="text-[#00ff66] font-semibold">
          Team One — Longbow Omegon
        </p>
        <ul className="ml-4 text-sm space-y-1">
          <li>Team Lead: Akhari</li>
          <li>Sniper: Sick</li>
          <li>Spotter: Toxic</li>
          <li>Medic: Advisor</li>
          <li>Assault: Sour</li>
          <li>Assault: Yami</li>
        </ul>

        <p className="text-[#00ff66] font-semibold mt-4">
          Team Two — Longbow Epsilon
        </p>
        <ul className="ml-4 text-sm space-y-1">
          <li>Team Lead: Shy</li>
          <li>Sniper: Wulf</li>
          <li>Spotter: Joker</li>
          <li>Medic: Vidar</li>
          <li>Assault: York</li>
          <li>Assault: Blitz</li>
        </ul>

      </div>

    </div>

  </div>
</div>

{/* ================= C2 LANDFALL BOX ================= */}

<div className="border border-red-500/40 bg-black/50 rounded-2xl overflow-hidden">

  {/* HEADER — ALWAYS VISIBLE */}
  <button
    onClick={() => setLandfallOpen(!landfallOpen)}
    className="w-full flex justify-between items-center p-6 hover:bg-red-500/10 transition"
  >
    <div className="text-left">
      <h2 className="text-2xl text-red-500 font-bold">
        🚀 C2 LANDING — TRITON
      </h2>

      {/* ✅ COUNTDOWN MOVED HERE */}
      <div className="mt-1">
        <span className="text-sm text-red-400">
          Initial Landfall Countdown
        </span>

        <div className="text-xl text-yellow-400 font-mono">
          {landfallActive ? "LANDING ACTIVE" : landfallTime}
        </div>
      </div>
    </div>

    <span className="text-xl text-red-500">
      {landfallOpen ? "▲" : "▼"}
    </span>
  </button>

  {/* COLLAPSIBLE CONTENT */}
  <div
    className={`
      overflow-hidden transition-all duration-500
      ${landfallOpen ? "max-h-[2000px] opacity-100 p-6" : "max-h-0 opacity-0"}
    `}
  >

    <div className="text-sm text-gray-300 leading-relaxed space-y-4">

      <p>
        DOOM Battalion must make landfall on the Yaoboan Moon of Triton.
        Initial landing forces must secure a landing zone to allow
        TASK FORCE DOOM Acclamators to support ground operations.
      </p>

      <p>
        Triton is a heavily defended rocky moon with powerful gun
        emplacements capable of engaging orbital assets.
        Securing it is critical — without Triton, the battalion
        remains stranded in deep space without direct support.
      </p>

      <p>
        Pacifying Triton ensures orbital dominance and enables sustained
        occupation of Yaoboa through coordinated ground support.
      </p>

    </div>

  </div>
</div>

          {/* PHASES (LOCKED LOGIC ONLY CHANGED) */}
          <div className="flex gap-4">
            {phases.map((phase) => {
              const isLocked =
                (phase.id === 2 && !phase1Complete) ||
                (phase.id === 3 &&
                  !(phase1Complete && phase2Complete));

              return (
                <button
                  key={phase.id}
                  disabled={isLocked}
                  onClick={() =>
                    !isLocked && setActivePhase(phase.id)
                  }
                  className={`px-4 py-2 border transition-all duration-200 ${
                    activePhase === phase.id
                      ? "bg-[#00ff66] text-black"
                      : "border-[#00ff66] text-[#00ff66]"
                  } ${
                    isLocked
                      ? "opacity-30 cursor-not-allowed"
                      : "hover:scale-105"
                  }`}
                >
                  Phase {phase.id}
                  {isLocked && " 🔒"}
                </button>
              );
            })}
          </div>

          {/* CURRENT PHASE */}
          <div>
            <h2 className="text-2xl text-[#00ff66]">
              {currentPhase.name}
            </h2>
            <p className="mb-4">{currentPhase.description}</p>

            {currentPhase.objectives.map((obj) => (
              <div
                key={obj.id}
                className="border border-[#00ff66]/40 p-3 rounded mb-2 bg-black/30"
              >
                <span
                  className={
                    obj.complete ? "line-through text-green-400" : ""
                  }
                >
                  {obj.name}
                </span>
              </div>
            ))}
          </div>

          {/* LORE */}
          <div className="space-y-6 pt-10">
            <LoreSection
              title="Planet Lore — Yoabos"
              isOpen={openLore === "planet"}
              onClick={() => toggleLore("planet")}
            >
              Yoabos was once a major raw material processing world aligned
              with corporate interests and CIS logistics.
              Positioned along the Mid-Rim trade corridor, it became
              a strategic military and economic hub.
            </LoreSection>

            <LoreSection
              title="Campaign Philosophy"
              isOpen={openLore === "philosophy"}
              onClick={() => toggleLore("philosophy")}
            >
              This operation marks a shift from liberation to dominance.
              Full military capability is authorized.
            </LoreSection>

            <LoreSection
              title="Enemy Forces"
              isOpen={openLore === "enemy"}
              onClick={() => toggleLore("enemy")}
            >
              CIS remnants, corporate security divisions, and armed
              civilian militia forces actively resist Republic occupation.
            </LoreSection>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="w-80 bg-black/50 p-6 border-l border-[#00ff66]/30 backdrop-blur-md">
          <h3 className="text-xl text-[#00ff66] mb-4">
            Campaign Status
          </h3>

          <StatusBar label="System Control" value={planetControl} />
          <StatusBar label="Enemy Strength" value={enemyStrength} />

          <div className="mt-6 space-y-6">
            <div>
              <p className="text-gray-400">Clone Losses</p>
              <p className="text-red-400 text-3xl font-bold tracking-widest">
                {cloneDisplay.toLocaleString()}
              </p>
            </div>

            <div>
              <p className="text-gray-400">Droid Kills</p>
              <p className="text-green-400 text-3xl font-bold tracking-widest">
                {droidDisplay.toLocaleString()}
              </p>
            </div>
          </div>

          <p className="text-sm mt-6">
            Objectives: {completedObjectives}/{totalObjectives}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================= COMPONENTS ================= */

function StatusBar({ label, value }: any) {
  return (
    <div className="mb-4">
      <p className="text-sm">{label}</p>
      <div className="w-full bg-gray-800 h-3 rounded">
        <div
          className="bg-[#00ff66] h-3 rounded"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/* ================= LORE COMPONENT ================= */

function LoreSection({ title, children, isOpen, onClick }: any) {
  return (
    <div className="border border-[#00ff66]/30 rounded p-4 bg-black/40">
      <button
        onClick={onClick}
        className="text-[#00ff66] font-semibold w-full text-left"
      >
        {isOpen ? "▼ " : "► "} {title}
      </button>
      {isOpen && <div className="mt-4 text-sm">{children}</div>}
    </div>
  );
}