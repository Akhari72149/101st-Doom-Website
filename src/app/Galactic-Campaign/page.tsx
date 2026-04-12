"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type ObjectiveStatus = "complete" | "active" | "pending";

type Objective = {
  id: string;
  name: string;
  status: ObjectiveStatus;
};

type Phase = {
  id: number;
  name: string;
  codename: string;
  description: string;
  objectives: Objective[];
};

type LoreKey = "planet" | "philosophy" | "enemy";

type Star = {
  id: number;
  x: number;
  y: number;
  size: number;
  speed: number;
};

const phases: Phase[] = [
  {
    id: 1,
    name: "Phase 1 — Moon Securing",
    codename: "ORBITAL DOMINANCE",
    description:
      "Secure Triton and Oberon to establish orbital superiority and staging control.",
    objectives: [
      {
        id: "t1",
        name: "Triton: Secure Guns — Secured by Dagger 02/28/2026",
        status: "complete",
      },
      {
        id: "t2",
        name: "Triton: Secure Shipyard",
        status: "complete",
      },
      {
        id: "o1",
        name: "Oberon: Secure Radar Facilities",
        status: "pending",
      },
      {
        id: "o2",
        name: "Oberon: Secure Supply Depots",
        status: "pending",
      },
    ],
  },
  {
    id: 2,
    name: "Phase 2 — Industrial Collapse",
    codename: "BROKEN FORGE",
    description:
      "Destroy droid production chains and seize critical mining infrastructure.",
    objectives: [
      {
        id: "f1",
        name: "Destroy Droid Factories",
        status: "pending",
      },
      {
        id: "m1",
        name: "Capture Mining Operations",
        status: "pending",
      },
    ],
  },
  {
    id: 3,
    name: "Phase 3 — Population Control",
    codename: "IRON QUIET",
    description:
      "Crush organized resistance from security contractors and civilian militia elements.",
    objectives: [
      {
        id: "s1",
        name: "Neutralize Security Corporation",
        status: "pending",
      },
      {
        id: "c1",
        name: "Suppress Civilian Militia",
        status: "pending",
      },
    ],
  },
];

const timelineEntries = [
  {
    id: 1,
    date: "Complete",
    title: "Triton Guns Secured",
    detail: "Dagger established control over orbital artillery positions.",
    tone: "success",
  },
  {
    id: 2,
    date: "Complete",
    title: "Triton Shipyard Assault Pending",
    detail: "Fleet command awaiting final strike window confirmation.",
    tone: "success",
  },
  {
    id: 3,
    date: "UPCOMING",
    title: "Oberon Radar Strike",
    detail: "Recon indicates radar disruption is required before major insertion.",
    tone: "pending",
  },
] as const;

const alerts = [
  {
    id: 1,
    label: "WARNING",
    text: "Enemy militia resistance expected to intensify on Oberon.",
    color: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
  },
];

export default function GalacticCampaignPage() {
  const router = useRouter();

  const [activePhase, setActivePhase] = useState(1);
  const [showIntro, setShowIntro] = useState(true);
  const [cloneDisplay, setCloneDisplay] = useState(0);
  const [droidDisplay, setDroidDisplay] = useState(0);
  const [openLore, setOpenLore] = useState<LoreKey | null>(null);
  const [stars, setStars] = useState<Star[]>([]);

  const cloneTarget = 670;
  const droidTarget = 25210;
  const powCount = 0;

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowIntro(false);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (showIntro) return;

    const animateCounter = (
      target: number,
      setValue: React.Dispatch<React.SetStateAction<number>>
    ) => {
      let current = 0;

      const interval = setInterval(() => {
        const step = Math.max(1, Math.floor(target * 0.01));
        current += step;

        if (current >= target) {
          setValue(target);
          clearInterval(interval);
          return;
        }

        setValue(current);
      }, 40);

      return interval;
    };

    const cloneInterval = animateCounter(cloneTarget, setCloneDisplay);
    const droidInterval = animateCounter(droidTarget, setDroidDisplay);

    return () => {
      if (cloneInterval) clearInterval(cloneInterval);
      if (droidInterval) clearInterval(droidInterval);
    };
  }, [showIntro]);

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

  const phase1Complete = phases[0].objectives.every(
    (objective) => objective.status === "complete"
  );

  const phase2Complete = phases[1].objectives.every(
    (objective) => objective.status === "complete"
  );

  const totalObjectives = useMemo(
    () => phases.reduce((acc, phase) => acc + phase.objectives.length, 0),
    []
  );

  const completedObjectives = useMemo(
    () =>
      phases.reduce(
        (acc, phase) =>
          acc +
          phase.objectives.filter((objective) => objective.status === "complete")
            .length,
        0
      ),
    []
  );

  const activeObjectives = useMemo(
    () =>
      phases.reduce(
        (acc, phase) =>
          acc +
          phase.objectives.filter((objective) => objective.status === "active")
            .length,
        0
      ),
    []
  );

  const campaignCompletion = Math.floor(
    (completedObjectives / totalObjectives) * 100
  );

  const enemyStrength = 100 - campaignCompletion;
  const currentPhase = phases.find((phase) => phase.id === activePhase)!;

  const toggleLore = (section: LoreKey) => {
    setOpenLore(openLore === section ? null : section);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-orbitron text-white">
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center bg-black transition-opacity duration-1000 ${
          showIntro ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="animate-pulse text-center">
          <h1 className="mb-6 text-4xl font-bold tracking-widest text-[#00ff66] md:text-6xl">
            REPUBLIC MILITARY COMMAND
          </h1>
          <p className="mb-2 text-xl text-yellow-400">OPERATION: YOABOS</p>
          <p className="text-red-500">Clearance Level: High Command</p>
        </div>
      </div>

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_50%,#000000_100%)]" />

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
              borderRadius: "9999px",
              opacity: 0.7,
              boxShadow: "0 0 6px #00ff66",
            }}
          />
        ))}
      </div>

      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,102,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.04)_1px,transparent_1px)] bg-[size:38px_38px] opacity-20" />

      <div className="relative z-10 mx-auto max-w-[1600px] px-6 py-6">
        <div className="mb-6 rounded-2xl border border-[#00ff66]/30 bg-black/50 p-3 backdrop-blur-md">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            <button
              onClick={() => router.push("/")}
              className="rounded-xl border border-[#00ff66]/40 px-4 py-3 text-sm font-semibold tracking-wider text-[#00ff66] transition-all duration-200 hover:scale-[1.02] hover:bg-[#00ff66]/10"
            >
              ← RETURN TO COMMAND
            </button>

            <button
              onClick={() => router.push("/GC-Logi")}
              className="rounded-xl border border-[#00ff66]/40 px-4 py-3 text-sm font-semibold tracking-wider text-[#00ff66] transition-all duration-200 hover:scale-[1.02] hover:bg-[#00ff66]/10"
            >
              GC LOGISTICS HUB
            </button>

            <button
              onClick={() => router.push("/vault")}
              className="rounded-xl border border-purple-500/40 px-4 py-3 text-sm font-semibold tracking-wider text-purple-300 transition-all duration-200 hover:scale-[1.02] hover:bg-purple-500/10"
            >
              📁 ENTER WAR ARCHIVE
            </button>

            <div className="md:ml-auto flex items-center rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold tracking-widest text-red-300">
              THEATRE STATUS: PLANETFALL IMMINENT
            </div>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.55fr_0.8fr]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-[#00ff66]/30 bg-black/45 p-6 shadow-[0_0_30px_rgba(0,255,102,0.08)] backdrop-blur-md">
              <div className="grid gap-6 lg:grid-cols-[1.35fr_0.9fr]">
                <div>
                  <div className="mb-3 inline-flex rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1 text-xs font-bold tracking-[0.25em] text-red-300">
                    HIGH COMMAND PRIORITY
                  </div>

                  <h1 className="mb-3 text-4xl font-bold text-red-500 md:text-5xl">
                    Operation: Yoabos
                  </h1>

                  <p className="max-w-3xl text-sm leading-7 text-gray-300 md:text-base">
                    Republic forces are entering the decisive opening phase of
                    the Yoabos campaign. Orbital staging, industrial denial, and
                    population suppression remain the three pillars of total
                    control.
                  </p>

                  <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard
                      label="Current Phase"
                      value={`Phase ${activePhase}`}
                      subtext={currentPhase.codename}
                      tone="green"
                    />
                    <MetricCard
                      label="Campaign Completion"
                      value={`${campaignCompletion}%`}
                      subtext={`${completedObjectives}/${totalObjectives} objectives complete`}
                      tone="green"
                    />
                    <MetricCard
                      label="Active Tasks"
                      value={String(activeObjectives)}
                      subtext="Immediate operational priority"
                      tone="yellow"
                    />
                    <MetricCard
                      label="Enemy Pressure"
                      value={`${enemyStrength}%`}
                      subtext="Residual hostile capability"
                      tone="red"
                    />
                  </div>
                </div>

                <div className="rounded-2xl border border-[#00ff66]/20 bg-black/50 p-5">
                  <h2 className="mb-4 text-lg font-bold tracking-widest text-[#00ff66]">
                    COMMAND SUMMARY
                  </h2>

                  <div className="space-y-4 text-sm">
                    <SummaryRow
                      label="Primary Objective"
                      value="Secure Final Areas on Triton"
                    />
                    <SummaryRow
                      label="Threat Outlook"
                      value="Severe but manageable"
                    />
                    <SummaryRow
                      label="Enemy Composition"
                      value="CIS, corporate security, militia"
                    />
                    <SummaryRow
                      label="Recommended Action"
                      value="Maintain pressure before reinforcement window"
                    />
                  </div>

                  <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                    Command directive: secure orbital control before committing
                    mass landfall resources.
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`rounded-2xl border p-4 text-sm tracking-wide ${alert.color}`}
                >
                  <span className="mr-2 font-bold">{alert.label}:</span>
                  {alert.text}
                </div>
              ))}
            </section>

            <section className="rounded-3xl border border-[#00ff66]/30 bg-black/45 p-6 backdrop-blur-md">
              <div className="mb-5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-[#00ff66]">
                    Phase Overview
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    Select a campaign phase to review current objectives and
                    campaign progression.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {phases.map((phase) => {
                  const isLocked =
                    (phase.id === 2 && !phase1Complete) ||
                    (phase.id === 3 && !(phase1Complete && phase2Complete));

                  const phaseCompleted =
                    phase.objectives.filter((objective) => objective.status === "complete")
                      .length;
                  const phasePercent = Math.floor(
                    (phaseCompleted / phase.objectives.length) * 100
                  );

                  return (
                    <button
                      key={phase.id}
                      disabled={isLocked}
                      onClick={() => !isLocked && setActivePhase(phase.id)}
                      className={`rounded-2xl border p-4 text-left transition-all duration-200 ${
                        activePhase === phase.id
                          ? "border-[#00ff66] bg-[#00ff66]/10 shadow-[0_0_24px_rgba(0,255,102,0.18)]"
                          : "border-[#00ff66]/20 bg-black/40"
                      } ${
                        isLocked
                          ? "cursor-not-allowed opacity-35"
                          : "hover:scale-[1.02] hover:border-[#00ff66]/60 hover:bg-[#00ff66]/5"
                      }`}
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs font-bold tracking-[0.25em] text-gray-400">
                            PHASE {phase.id}
                          </div>
                          <h3 className="mt-1 text-lg font-bold text-white">
                            {phase.codename}
                          </h3>
                        </div>
                        <div className="text-lg">
                          {isLocked ? "🔒" : activePhase === phase.id ? "●" : "○"}
                        </div>
                      </div>

                      <p className="mb-3 text-sm text-gray-300">{phase.name}</p>

                      <div className="mb-2 h-2 w-full rounded-full bg-gray-800">
                        <div
                          className="h-2 rounded-full bg-[#00ff66]"
                          style={{ width: `${phasePercent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{phaseCompleted}/{phase.objectives.length} complete</span>
                        <span>{phasePercent}%</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-[#00ff66]/30 bg-black/45 p-6 backdrop-blur-md">
              <div className="mb-5 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#00ff66]">
                    {currentPhase.name}
                  </h2>
                  <p className="mt-1 text-sm text-gray-400">
                    {currentPhase.description}
                  </p>
                </div>

                <div className="rounded-xl border border-[#00ff66]/20 bg-black/50 px-4 py-2 text-xs tracking-[0.2em] text-[#00ff66]">
                  {currentPhase.codename}
                </div>
              </div>

              <div className="grid gap-3">
                {currentPhase.objectives.map((objective) => (
                  <ObjectiveCard key={objective.id} objective={objective} />
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-[#00ff66]/30 bg-black/45 p-6 backdrop-blur-md">
              <h2 className="mb-5 text-2xl font-bold text-[#00ff66]">
                Campaign Timeline
              </h2>

              <div className="space-y-4">
                {timelineEntries.map((entry, index) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-3 w-3 rounded-full ${
                          entry.tone === "success"
                            ? "bg-green-400 shadow-[0_0_12px_rgba(74,222,128,0.8)]"
                            : entry.tone === "pending"
                            ? "bg-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.8)]"
                            : "bg-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.8)]"
                        }`}
                      />
                      {index < timelineEntries.length - 1 && (
                        <div className="mt-2 h-full w-px bg-[#00ff66]/20" />
                      )}
                    </div>

                    <div className="flex-1 rounded-2xl border border-[#00ff66]/20 bg-black/40 p-4">
                      <div className="mb-1 text-xs font-bold tracking-[0.25em] text-gray-400">
                        {entry.date}
                      </div>
                      <h3 className="text-lg font-semibold text-white">
                        {entry.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-300">{entry.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-5 rounded-3xl border border-[#00ff66]/30 bg-black/45 p-6 backdrop-blur-md">
              <h2 className="text-2xl font-bold text-[#00ff66]">
                Intelligence Dossiers
              </h2>

              <LoreSection
                title="Planet Lore — Yoabos"
                meta="Source: Republic Intelligence // Sector: Mid Rim // Classification: Strategic"
                isOpen={openLore === "planet"}
                onClick={() => toggleLore("planet")}
              >
                Yoabos was once a major raw material processing world aligned
                with corporate interests and CIS logistics. Positioned along the
                Mid-Rim trade corridor, it evolved into a strategic military and
                economic hub with major industrial throughput.
              </LoreSection>

              <LoreSection
                title="Campaign Philosophy"
                meta="Directive: Occupation Through Overwhelming Control"
                isOpen={openLore === "philosophy"}
                onClick={() => toggleLore("philosophy")}
              >
                This operation marks a shift from liberation to dominance. Full
                military capability is authorized, with command intent focused
                on speed, suppression, and irreversible control over hostile
                infrastructure.
              </LoreSection>

              <LoreSection
                title="Enemy Forces"
                meta="Threat Rating: High"
                isOpen={openLore === "enemy"}
                onClick={() => toggleLore("enemy")}
              >
                CIS remnants, corporate security divisions, and armed civilian
                militia forces remain active across the theatre. Expect mixed
                resistance, entrenched hardpoints, and fragmented but dangerous
                counterattacks.
              </LoreSection>
            </section>
          </div>

          <aside className="space-y-6">
            <div className="rounded-3xl border border-[#00ff66]/30 bg-black/50 p-6 backdrop-blur-md">
              <h3 className="mb-5 text-xl font-bold text-[#00ff66]">
                Campaign Status
              </h3>

              <StatusBar label="System Control" value={campaignCompletion} />
              <StatusBar label="Enemy Strength" value={enemyStrength} />
            </div>

            <IntelCard title="Casualty Report" tone="red">
              <p className="text-gray-400">Clone Losses</p>
              <p className="text-3xl font-bold tracking-widest text-red-400">
                {cloneDisplay.toLocaleString()}
              </p>
            </IntelCard>

            <IntelCard title="Combat Report" tone="green">
              <p className="text-gray-400">Droid Kills</p>
              <p className="text-3xl font-bold tracking-widest text-green-400">
                {droidDisplay.toLocaleString()}
              </p>
            </IntelCard>

            <IntelCard title="POW Status" tone="yellow">
              <p className="text-gray-400">Prisoners of War</p>
              <p className="text-3xl font-bold tracking-widest text-yellow-400">
                {powCount}
              </p>
            </IntelCard>

            <IntelCard title="Objective Summary" tone="green">
              <div className="space-y-3 text-sm">
                <SummaryRow
                  label="Objectives Complete"
                  value={`${completedObjectives}/${totalObjectives}`}
                />
                <SummaryRow
                  label="Current Focus"
                  value="Orbital staging and shipyard denial"
                />
                <SummaryRow
                  label="Theatre Outlook"
                  value="Favourable if momentum is maintained"
                />
              </div>
            </IntelCard>
          </aside>
        </div>
      </div>
    </div>
  );
}

function StatusBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between text-sm">
        <p className="text-gray-300">{label}</p>
        <span className="font-bold text-[#00ff66]">{value}%</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-800">
        <div
          className="h-3 rounded-full bg-[#00ff66] shadow-[0_0_12px_rgba(0,255,102,0.4)]"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ObjectiveCard({ objective }: { objective: Objective }) {
  const statusMap: Record<
    ObjectiveStatus,
    {
      icon: string;
      label: string;
      border: string;
      bg: string;
      text: string;
    }
  > = {
    complete: {
      icon: "✔",
      label: "Complete",
      border: "border-green-500/30",
      bg: "bg-green-500/10",
      text: "text-green-300",
    },
    active: {
      icon: "◉",
      label: "Active",
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      text: "text-yellow-300",
    },
    pending: {
      icon: "○",
      label: "Pending",
      border: "border-[#00ff66]/20",
      bg: "bg-black/40",
      text: "text-gray-300",
    },
  };

  const style = statusMap[objective.status];

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-200 hover:border-[#00ff66]/50 ${style.border} ${style.bg}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 text-lg font-bold ${style.text}`}>
            {style.icon}
          </div>
          <div>
            <p
              className={`text-sm md:text-base ${
                objective.status === "complete"
                  ? "text-green-300 line-through"
                  : "text-white"
              }`}
            >
              {objective.name}
            </p>
          </div>
        </div>

        <div
          className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wider ${style.border} ${style.text}`}
        >
          {style.label}
        </div>
      </div>
    </div>
  );
}

function LoreSection({
  title,
  meta,
  children,
  isOpen,
  onClick,
}: {
  title: string;
  meta: string;
  children: React.ReactNode;
  isOpen: boolean;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-[#00ff66]/25 bg-black/40 p-4">
      <button onClick={onClick} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-[#00ff66]">
              {isOpen ? "▼ " : "► "} {title}
            </div>
            <div className="mt-1 text-xs tracking-wide text-gray-500">
              {meta}
            </div>
          </div>
        </div>
      </button>

      {isOpen && (
        <div className="mt-4 text-sm leading-7 text-gray-300">{children}</div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  subtext,
  tone,
}: {
  label: string;
  value: string;
  subtext: string;
  tone: "green" | "yellow" | "red";
}) {
  const toneClasses =
    tone === "green"
      ? "border-[#00ff66]/25 bg-[#00ff66]/5 text-[#00ff66]"
      : tone === "yellow"
      ? "border-yellow-500/25 bg-yellow-500/5 text-yellow-300"
      : "border-red-500/25 bg-red-500/5 text-red-300";

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <p className="text-xs font-bold tracking-[0.2em] opacity-80">{label}</p>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subtext}</p>
    </div>
  );
}

function IntelCard({
  title,
  tone,
  children,
}: {
  title: string;
  tone: "green" | "yellow" | "red";
  children: React.ReactNode;
}) {
  const toneClasses =
    tone === "green"
      ? "border-[#00ff66]/30"
      : tone === "yellow"
      ? "border-yellow-500/30"
      : "border-red-500/30";

  return (
    <div className={`rounded-3xl border bg-black/50 p-6 backdrop-blur-md ${toneClasses}`}>
      <h3 className="mb-4 text-lg font-bold tracking-widest text-white">{title}</h3>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-2">
      <span className="text-gray-400">{label}</span>
      <span className="max-w-[60%] text-right text-white">{value}</span>
    </div>
  );
}