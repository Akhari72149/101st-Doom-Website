"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, svg, stagger } from "animejs";

type SystemMode = "standby" | "scanning" | "combat ops" | "admin access" | "maintenance";

type QuickAction = {
  label: string;
  route: string;
  command: string;
};

type ThemeConfig = {
  primary: string;
  primarySoft: string;
  secondary: string;
  secondarySoft: string;
  accent: string;
  accentSoft: string;
  textMain: string;
  textMuted: string;
  pageBg: string;
  panelBg: string;
  panelAlt: string;
  consoleBg: string;
  gridLine: string;
  radialPrimary: string;
  radialSecondary: string;
  shadowPrimary: string;
  shadowSecondary: string;
};

export default function AIInterface() {
  const router = useRouter();

  const [systemMode, setSystemMode] = useState<SystemMode>("standby");
  const [systemOnline, setSystemOnline] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootStage, setBootStage] = useState("Awaiting activation...");
  const [command, setCommand] = useState("");
  const [statusMessage, setStatusMessage] = useState("System in passive standby.");
  const bootTimeouts = useRef<NodeJS.Timeout[]>([]);
  const sphereAnimRef = useRef<any>(null);
  const ringAnimRefs = useRef<any[]>([]);
  const shellAnimRef = useRef<any>(null);
  const lineAnimRefs = useRef<any[]>([]);

  const quickActions: QuickAction[] = useMemo(
    () => [
      { label: "Personnel", route: "/personnel", command: "personnel" },
      { label: "Certifications", route: "/certifications", command: "certifications" },
      { label: "Events", route: "/events", command: "events" },
      { label: "Servers", route: "/servers", command: "servers" },
      { label: "Logistics", route: "/logistics", command: "logistics" },
      { label: "Admin", route: "/admin", command: "admin" },
    ],
    []
  );

  const modeConfig = useMemo(() => {
    switch (systemMode) {
      case "scanning":
        return {
          label: "Neural Scan Matrix // Active",
          headline: "AI CORE",
          description:
            "Extended network scan enabled. Signal acquisition, command parsing, and route analysis are running across all monitored systems.",
          integrity: "97.8%",
          ringDurations: [18000, 24000, 30000],
        };
      case "combat ops":
        return {
          label: "Combat Operations Layer // Armed",
          headline: "AI CORE",
          description:
            "Rapid-response command routing active. Priority monitoring has shifted toward tactical systems, server readiness, and live operational status.",
          integrity: "99.7%",
          ringDurations: [9000, 12000, 15000],
        };
      case "admin access":
        return {
          label: "Administrative Override // Authorized",
          headline: "AI CORE",
          description:
            "Administrative control privileges unlocked. Configuration routing, personnel tools, and management pathways are available for execution.",
          integrity: "99.9%",
          ringDurations: [18000, 24000, 30000],
        };
      case "maintenance":
        return {
          label: "Maintenance Protocol // Stabilized",
          headline: "AI CORE",
          description:
            "Subsystem diagnostics and service routines are active. Core processes are held in a stable state for repair, review, and data synchronization.",
          integrity: "96.4%",
          ringDurations: [18000, 24000, 30000],
        };
      case "standby":
      default:
        return {
          label: "Neural Circuit Matrix // Online",
          headline: "AI CORE",
          description:
            "Dense circuit-board intelligence architecture with active data pathways, processor routing, bus modules, and live signal monitoring across a stabilized neural core.",
          integrity: "99.2%",
          ringDurations: [0, 0, 0],
        };
    }
  }, [systemMode]);

  const motionConfig = useMemo(() => {
    switch (systemMode) {
      case "combat ops":
        return {
          sphereSpin: true,
          sphereDuration: 16000,
          lineDraw: true,
          lineDuration: 1400,
          ringSpin: true,
        };
      case "scanning":
      case "admin access":
      case "maintenance":
        return {
          sphereSpin: true,
          sphereDuration: 32000,
          lineDraw: true,
          lineDuration: 3200,
          ringSpin: true,
        };
      case "standby":
      default:
        return {
          sphereSpin: false,
          sphereDuration: 0,
          lineDraw: false,
          lineDuration: 0,
          ringSpin: false,
        };
    }
  }, [systemMode]);

  const theme = useMemo<ThemeConfig>(() => {
    switch (systemMode) {
      case "combat ops":
        return {
          primary: "#ff3b3b",
          primarySoft: "rgba(255,59,59,0.28)",
          secondary: "#ff8a3d",
          secondarySoft: "rgba(255,138,61,0.26)",
          accent: "#ffd6d6",
          accentSoft: "rgba(255,214,214,0.16)",
          textMain: "#fff1f1",
          textMuted: "rgba(255,220,220,0.72)",
          pageBg: "#080202",
          panelBg: "rgba(24,6,6,0.62)",
          panelAlt: "rgba(34,10,10,0.50)",
          consoleBg: "rgba(18,4,4,0.82)",
          gridLine: "rgba(255,59,59,0.05)",
          radialPrimary: "rgba(255,59,59,0.10)",
          radialSecondary: "rgba(255,138,61,0.10)",
          shadowPrimary: "rgba(255,59,59,0.30)",
          shadowSecondary: "rgba(255,138,61,0.18)",
        };
      case "admin access":
        return {
          primary: "#00f0ff",
          primarySoft: "rgba(0,240,255,0.28)",
          secondary: "#1f7bff",
          secondarySoft: "rgba(31,123,255,0.26)",
          accent: "#d9faff",
          accentSoft: "rgba(217,250,255,0.16)",
          textMain: "#ecfdff",
          textMuted: "rgba(210,247,255,0.72)",
          pageBg: "#02070b",
          panelBg: "rgba(4,16,24,0.62)",
          panelAlt: "rgba(6,22,34,0.50)",
          consoleBg: "rgba(3,10,16,0.82)",
          gridLine: "rgba(0,240,255,0.05)",
          radialPrimary: "rgba(0,240,255,0.10)",
          radialSecondary: "rgba(31,123,255,0.10)",
          shadowPrimary: "rgba(0,240,255,0.30)",
          shadowSecondary: "rgba(31,123,255,0.18)",
        };
      case "maintenance":
        return {
          primary: "#b05cff",
          primarySoft: "rgba(176,92,255,0.28)",
          secondary: "#7a5cff",
          secondarySoft: "rgba(122,92,255,0.26)",
          accent: "#f0ddff",
          accentSoft: "rgba(240,221,255,0.16)",
          textMain: "#faf3ff",
          textMuted: "rgba(234,214,255,0.72)",
          pageBg: "#05030a",
          panelBg: "rgba(18,10,28,0.62)",
          panelAlt: "rgba(24,14,36,0.50)",
          consoleBg: "rgba(14,8,22,0.82)",
          gridLine: "rgba(176,92,255,0.05)",
          radialPrimary: "rgba(176,92,255,0.10)",
          radialSecondary: "rgba(122,92,255,0.10)",
          shadowPrimary: "rgba(176,92,255,0.30)",
          shadowSecondary: "rgba(122,92,255,0.18)",
        };
      case "scanning":
      case "standby":
      default:
        return {
          primary: "#00ff66",
          primarySoft: "rgba(0,255,102,0.28)",
          secondary: "#2f6fff",
          secondarySoft: "rgba(47,111,255,0.26)",
          accent: "#d9ecff",
          accentSoft: "rgba(217,236,255,0.16)",
          textMain: "#e8fff2",
          textMuted: "rgba(183,255,212,0.72)",
          pageBg: "#020508",
          panelBg: "rgba(0,0,0,0.35)",
          panelAlt: "rgba(7,17,31,0.45)",
          consoleBg: "rgba(3,7,10,0.82)",
          gridLine: "rgba(0,255,102,0.03)",
          radialPrimary: "rgba(0,255,102,0.06)",
          radialSecondary: "rgba(47,111,255,0.08)",
          shadowPrimary: "rgba(0,255,102,0.35)",
          shadowSecondary: "rgba(47,111,255,0.18)",
        };
    }
  }, [systemMode]);

  const systemStats = useMemo(() => {
    const byMode: Record<SystemMode, { busLoad: number; coreFlux: number; memorySync: number }> = {
      standby: { busLoad: 46, coreFlux: 62, memorySync: 88 },
      scanning: { busLoad: 71, coreFlux: 83, memorySync: 91 },
      "combat ops": { busLoad: 92, coreFlux: 97, memorySync: 86 },
      "admin access": { busLoad: 58, coreFlux: 74, memorySync: 96 },
      maintenance: { busLoad: 35, coreFlux: 49, memorySync: 93 },
    };

    return byMode[systemMode];
  }, [systemMode]);

  const dashboardCards = useMemo(() => {
    return [
      {
        title: "Server Status",
        value: systemOnline ? "04 ONLINE / 01 DEGRADED" : "OFFLINE",
        detail: systemOnline
          ? "Primary cluster responding. One auxiliary node reporting reduced throughput."
          : "Core systems not yet engaged.",
      },
      {
        title: "Task Queue",
        value: systemOnline ? "18 ACTIVE" : "--",
        detail: systemOnline
          ? "Queued processes include personnel lookup, bookings, certification queries, and sync checks."
          : "Task routing unavailable until activation.",
      },
      {
        title: "Threat Monitor",
        value: systemMode === "combat ops" ? "ELEVATED" : "LOW",
        detail:
          systemMode === "combat ops"
            ? "Combat routing enabled. Tactical priority channels unlocked."
            : "No immediate anomalies detected in monitored pathways.",
      },
      {
        title: "Last Command",
        value: command.trim() ? command.toUpperCase() : "NONE",
        detail: statusMessage,
      },
    ];
  }, [systemOnline, systemMode, command, statusMessage]);

  useEffect(() => {
const sphereShell = document.getElementById("sphere-shell");
if (sphereShell) {
  if (systemMode !== "standby") {
    animate(sphereShell, {
      translateY: ["0px", "-6px", "0px"],
      easing: "easeInOutSine",
      duration: 4200,
      loop: true,
    });
  } else {
    sphereShell.style.transform = "translateY(0px)";
  }
}

    const sphere = document.getElementById("ai-sphere");
    if (sphere) {
      if (motionConfig.sphereSpin) {
        animate(sphere, {
          rotate: ["0deg", "360deg"],
          easing: "linear",
          duration: motionConfig.sphereDuration,
          loop: true,
        });
      } else {
        sphere.style.transform = "rotate(0deg)";
      }

      const rings = Array.from(document.getElementsByClassName("ai-ring")) as HTMLDivElement[];
      rings.forEach((ring, idx) => {
        if (motionConfig.ringSpin) {
          animate(ring, {
            rotate:
              idx === 0
                ? ["0deg", "360deg"]
                : idx === 1
                ? ["0deg", "-260deg"]
                : ["0deg", "180deg"],
            easing: "linear",
            duration: modeConfig.ringDurations[idx] || 24000,
            loop: true,
          });
        } else {
          ring.style.transform = "rotate(0deg)";
        }
      });
    }

    const coreGlow = document.getElementById("core-glow");
    const coreInnerGlow = document.getElementById("core-inner-glow");
    const coreHighlight = document.getElementById("core-highlight");

    if (coreGlow) {
      animate(coreGlow, {
        r: systemOnline ? [10, 13.5, 10] : [10, 11.5, 10],
        opacity: systemOnline ? [0.12, 0.24, 0.12] : [0.08, 0.16, 0.08],
        easing: "easeInOutSine",
        duration: 2600,
        loop: true,
      });
    }

    if (coreInnerGlow) {
      animate(coreInnerGlow, {
        r: [5.8, 7.2, 5.8],
        opacity: systemOnline ? [0.16, 0.3, 0.16] : [0.12, 0.24, 0.12],
        easing: "easeInOutSine",
        duration: 1800,
        loop: true,
      });
    }

    if (coreHighlight) {
      animate(coreHighlight, {
        opacity: [0.2, 0.45, 0.2],
        easing: "easeInOutSine",
        duration: 2200,
        loop: true,
      });
    }

    const paths = Array.from(
      document.querySelectorAll<SVGPathElement>("#ai-circuits .line, #ai-circuits .core-line")
    );

if (paths.length > 0) {
  if (motionConfig.lineDraw) {
    const drawables = paths.map((p) => {
      p.style.opacity = "1";
      p.style.removeProperty("stroke-dasharray");
      p.style.removeProperty("stroke-dashoffset");
      return svg.createDrawable(p);
    });

    drawables.forEach((drawable) => {
      animate(drawable, {
        draw: ["0 0", "0 1", "1 1"],
        easing: "easeInOutQuad",
        duration: motionConfig.lineDuration + Math.random() * 1200,
        delay: Math.random() * 1500,
        loop: true,
      });
    });
  } else {
    paths.forEach((p) => {
      p.style.opacity = "0";
      p.style.removeProperty("stroke-dasharray");
      p.style.removeProperty("stroke-dashoffset");
    });
  }
}

    const vias = Array.from(document.querySelectorAll<SVGCircleElement>("#ai-circuits .via"));
    vias.forEach((via, i) => {
      animate(via, {
        opacity: [0.22, 0.85, 0.22],
        scale: [1, 1.2, 1],
        easing: "easeInOutSine",
        duration: 1300 + (i % 4) * 220,
        delay: i * 120,
        loop: true,
        direction: "alternate",
      });
    });

    const pulses = Array.from(document.querySelectorAll<SVGCircleElement>("#ai-circuits .pulse"));
    pulses.forEach((node, i) => {
      animate(node, {
        scale: [1, 1.7, 1],
        opacity: [0.4, 1, 0.4],
        easing: "easeInOutSine",
        duration: 1700 + i * 110,
        delay: i * 70,
        loop: true,
      });
    });

    const dataBars = Array.from(document.querySelectorAll<HTMLElement>(".data-bar"));
    dataBars.forEach((bar, i) => {
      animate(bar, {
        opacity: [0.35, 1, 0.35],
        scaleX: [0.7, 1, 0.7],
        easing: "easeInOutSine",
        duration: 1400 + i * 180,
        delay: i * 140,
        loop: true,
      });
    });

    return () => {
      bootTimeouts.current.forEach(clearTimeout);
      bootTimeouts.current = [];
    };
  }, [modeConfig.ringDurations, motionConfig, systemOnline]);

  const runCommand = (input: string) => {
    const normalized = input.trim().toLowerCase();

    if (!normalized) {
      setStatusMessage("No command entered.");
      return;
    }

    if (normalized.includes("personnel")) {
      setStatusMessage("Routing to personnel systems...");
      router.push("/personnel");
      return;
    }

    if (normalized.includes("cert") || normalized.includes("qualification")) {
      setStatusMessage("Opening certification records...");
      router.push("/certifications");
      return;
    }

    if (normalized.includes("event") || normalized.includes("booking")) {
      setStatusMessage("Accessing events and bookings...");
      router.push("/events");
      return;
    }

    if (normalized.includes("server")) {
      setStatusMessage("Opening server control systems...");
      router.push("/servers");
      return;
    }

    if (normalized.includes("logistics") || normalized.includes("shop") || normalized.includes("asset")) {
      setStatusMessage("Accessing logistics hub...");
      router.push("/logistics");
      return;
    }

    if (normalized.includes("admin")) {
      setStatusMessage("Authorizing administrative route...");
      router.push("/admin");
      return;
    }

    if (normalized.includes("scan")) {
      setSystemMode("scanning");
      setStatusMessage("System mode changed to scanning.");
      return;
    }

    if (normalized.includes("combat")) {
      setSystemMode("combat ops");
      setStatusMessage("System mode changed to combat ops.");
      return;
    }

    if (normalized.includes("maintenance")) {
      setSystemMode("maintenance");
      setStatusMessage("System mode changed to maintenance.");
      return;
    }

    if (normalized.includes("standby")) {
      setSystemMode("standby");
      setStatusMessage("System mode returned to standby.");
      return;
    }

    if (normalized.includes("admin access")) {
      setSystemMode("admin access");
      setStatusMessage("System mode changed to admin access.");
      return;
    }

    setStatusMessage(`Command not recognized: ${normalized}`);
  };

  const handleQuickAction = (action: QuickAction) => {
    setCommand(action.command);
    setStatusMessage(`Opening ${action.label} module...`);
    router.push(action.route);
  };

  const handleEngageCore = () => {
    if (booting) return;

    bootTimeouts.current.forEach(clearTimeout);
    bootTimeouts.current = [];

    setBooting(true);
    setSystemOnline(false);
    setStatusMessage("Boot sequence started.");
    setBootStage("Initializing neural shell...");

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootStage("Calibrating signal pathways...");
      }, 900)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootStage("Synchronizing core memory lattice...");
      }, 1800)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootStage("Authorizing command matrix...");
      }, 2700)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootStage("AI core online.");
        setBooting(false);
        setSystemOnline(true);
        setSystemMode("scanning");
        setStatusMessage("Core activation complete. Command systems ready.");
      }, 3600)
    );
  };

  return (
    <div
      className="relative min-h-screen overflow-hidden font-mono transition-colors duration-500"
      style={{ backgroundColor: theme.pageBg, color: theme.primary }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background: `radial-gradient(circle at center, ${theme.radialPrimary} 0%, ${theme.radialSecondary} 28%, rgba(0,0,0,0) 62%)`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-30"
        style={{
          backgroundImage: `
            linear-gradient(${theme.gridLine} 1px, transparent 1px),
            linear-gradient(90deg, ${theme.gridLine} 1px, transparent 1px)
          `,
          backgroundSize: "44px 44px",
        }}
      />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 text-center">
          <p
            className="mb-3 text-xs uppercase tracking-[0.45em] transition-colors duration-500"
            style={{ color: theme.secondary }}
          >
            {modeConfig.label}
          </p>
          <p
            className="text-[10px] uppercase tracking-[0.3em] transition-colors duration-500"
            style={{ color: theme.textMuted }}
          >
            {booting ? bootStage : systemOnline ? "Core linked to command grid." : "Core idle - activation pending."}
          </p>
        </div>

        <div id="sphere-shell" className="relative mb-10 h-80 w-80">
          <div
            className="pointer-events-none absolute -inset-6 rounded-full border transition-colors duration-500"
            style={{ borderColor: theme.secondarySoft }}
          />
          <div
            className="pointer-events-none absolute -inset-10 rounded-full border transition-colors duration-500"
            style={{ borderColor: theme.primarySoft }}
          />

          <div
            id="ai-sphere"
            className="absolute inset-0 flex items-center justify-center rounded-full border-4 transition-all duration-500"
            style={{
              borderColor: `${theme.primary}cc`,
              background: `radial-gradient(circle at 50% 42%, ${theme.secondarySoft}, ${theme.primarySoft} 35%, rgba(0,0,0,0.85) 78%)`,
              boxShadow: `0 0 30px ${theme.shadowPrimary}, 0 0 70px ${theme.shadowSecondary}, inset 0 0 40px ${theme.primarySoft}`,
            }}
          >
            <div
              className="pointer-events-none absolute inset-[9px] rounded-full border transition-colors duration-500"
              style={{
                borderColor: theme.secondarySoft,
                boxShadow: `inset 0 0 30px ${theme.secondarySoft}`,
              }}
            />
            <div
              className="pointer-events-none absolute inset-10 rounded-full blur-2xl transition-colors duration-500"
              style={{ backgroundColor: theme.primarySoft }}
            />
            <div
              className="pointer-events-none absolute left-[22%] top-[14%] h-16 w-24 rotate-[-18deg] rounded-full blur-xl transition-colors duration-500"
              style={{ backgroundColor: theme.accentSoft }}
            />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(0,0,0,0.28)_82%,rgba(0,0,0,0.52)_100%)]" />

            <svg id="ai-circuits" className="h-72 w-72" viewBox="0 0 100 100" fill="none">
              <defs>
                <clipPath id="sphereClip">
                  <circle cx="50" cy="50" r="47" />
                </clipPath>
              </defs>

              <g clipPath="url(#sphereClip)">
                <circle cx="50" cy="50" r="46" stroke={theme.primary} strokeOpacity="0.14" strokeWidth="0.45" />
                <circle cx="50" cy="50" r="42" stroke={theme.secondary} strokeOpacity="0.16" strokeWidth="0.35" />
                <circle cx="50" cy="50" r="39" stroke={theme.primary} strokeOpacity="0.08" strokeWidth="0.3" />

                <circle cx="50" cy="50" r="31" stroke={theme.secondary} strokeOpacity="0.12" strokeWidth="0.25" strokeDasharray="1.5 2.2" />
                <circle cx="50" cy="50" r="25" stroke={theme.primary} strokeOpacity="0.1" strokeWidth="0.25" strokeDasharray="2 2.5" />

                <circle id="core-glow" cx="50" cy="50" r="10" fill={theme.primary} opacity="0.08" />
                <circle id="core-inner-glow" cx="50" cy="50" r="6" fill={theme.secondary} opacity="0.14" />
                <circle id="core-highlight" cx="47.2" cy="46.8" r="2.1" fill={theme.accent} opacity="0.3" />

                <rect x="41" y="41" width="18" height="18" rx="1.5" stroke={theme.primary} strokeWidth="1" fill={theme.primarySoft} />
                <rect x="44" y="44" width="12" height="12" rx="1" stroke={theme.secondary} strokeWidth="0.7" fill={theme.secondarySoft} />

                <path className="core-line" d="M46 46 L50 46 L50 50" stroke={theme.accent} strokeWidth="0.45" />
                <path className="core-line" d="M54 46 L50 46" stroke={theme.primary} strokeWidth="0.45" />
                <path className="core-line" d="M46 54 L50 54 L50 50" stroke={theme.secondary} strokeWidth="0.45" />
                <path className="core-line" d="M54 54 L50 54" stroke={theme.primary} strokeWidth="0.45" />
                <path className="core-line" d="M47 47 L53 47" stroke={theme.secondary} strokeWidth="0.35" />
                <path className="core-line" d="M47 53 L53 53" stroke={theme.accent} strokeWidth="0.35" />
                <path className="core-line" d="M47 47 L47 53" stroke={theme.primary} strokeWidth="0.35" />
                <path className="core-line" d="M53 47 L53 53" stroke={theme.secondary} strokeWidth="0.35" />

                <text x="50" y="51.3" textAnchor="middle" fontSize="2.2" fill={theme.accent} opacity="0.85" letterSpacing="0.45">
                  CORE
                </text>

                {[
                  [43, 39, 43, 41],
                  [46, 39, 46, 41],
                  [49, 39, 49, 41],
                  [52, 39, 52, 41],
                  [55, 39, 55, 41],
                  [57, 39, 57, 41],
                  [43, 59, 43, 61],
                  [46, 59, 46, 61],
                  [49, 59, 49, 61],
                  [52, 59, 52, 61],
                  [55, 59, 55, 61],
                  [57, 59, 57, 61],
                  [39, 43, 41, 43],
                  [39, 46, 41, 46],
                  [39, 49, 41, 49],
                  [39, 52, 41, 52],
                  [39, 55, 41, 55],
                  [39, 57, 41, 57],
                  [59, 43, 61, 43],
                  [59, 46, 61, 46],
                  [59, 49, 61, 49],
                  [59, 52, 61, 52],
                  [59, 55, 61, 55],
                  [59, 57, 61, 57],
                ].map(([x1, y1, x2, y2], i) => (
                  <path
                    key={`pin-${i}`}
                    className="line"
                    d={`M${x1} ${y1} L${x2} ${y2}`}
                    stroke={i % 3 === 0 ? theme.secondary : theme.primary}
                    strokeWidth="0.7"
                  />
                ))}

                <rect x="18" y="23" width="10" height="6" rx="0.8" stroke={theme.primary} strokeWidth="0.7" fill={theme.primarySoft} />
                <rect x="70" y="25" width="11" height="7" rx="0.8" stroke={theme.secondary} strokeWidth="0.7" fill={theme.secondarySoft} />
                <rect x="72" y="60" width="10" height="8" rx="0.8" stroke={theme.primary} strokeWidth="0.7" fill={theme.primarySoft} />
                <rect x="19" y="66" width="12" height="7" rx="0.8" stroke={theme.secondary} strokeWidth="0.7" fill={theme.secondarySoft} />

                <rect x="30" y="15" width="3" height="9" rx="0.5" stroke={theme.primary} strokeWidth="0.6" />
                <rect x="34" y="15" width="3" height="9" rx="0.5" stroke={theme.secondary} strokeWidth="0.6" />
                <rect x="67" y="74" width="3" height="8" rx="0.5" stroke={theme.primary} strokeWidth="0.6" />
                <rect x="71" y="74" width="3" height="8" rx="0.5" stroke={theme.secondary} strokeWidth="0.6" />

                <text x="20" y="21" fontSize="1.9" fill={theme.accent} opacity="0.72" letterSpacing="0.3">I/O</text>
                <text x="70" y="23" fontSize="1.9" fill={theme.accent} opacity="0.72" letterSpacing="0.3">BUS</text>
                <text x="73" y="58" fontSize="1.9" fill={theme.accent} opacity="0.72" letterSpacing="0.3">MEM</text>
                <text x="20" y="64" fontSize="1.9" fill={theme.accent} opacity="0.72" letterSpacing="0.3">PWR</text>

                {[
                  [14, 20], [11, 35], [12, 50], [14, 66], [20, 83],
                  [80, 15], [88, 29], [89, 48], [86, 67], [79, 84],
                  [33, 10], [50, 8], [68, 11], [33, 90], [50, 92], [67, 89],
                  [24, 30], [76, 73], [25, 74], [74, 25],
                ].map(([cx, cy], i) => (
                  <g key={`pad-${i}`}>
                    <circle
                      cx={cx}
                      cy={cy}
                      r="1.6"
                      stroke={i % 2 === 0 ? theme.primary : theme.secondary}
                      strokeWidth="0.6"
                      fill={i % 2 === 0 ? theme.primarySoft : theme.secondarySoft}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="0.5"
                      fill={i % 3 === 0 ? theme.accent : i % 2 === 0 ? theme.primary : theme.secondary}
                      className="pulse"
                    />
                  </g>
                ))}

                {[
                  [24, 18], [27, 18], [73, 19], [76, 19],
                  [18, 58], [21, 58], [78, 58], [81, 58],
                  [31, 78], [34, 78], [61, 79], [64, 79],
                  [44, 28], [56, 29], [43, 71], [57, 70],
                ].map(([cx, cy], i) => (
                  <circle
                    key={`via-${i}`}
                    className="via"
                    cx={cx}
                    cy={cy}
                    r="0.9"
                    stroke={i % 2 === 0 ? theme.primary : theme.secondary}
                    strokeWidth="0.45"
                    fill={theme.accentSoft}
                  />
                ))}

                <path className="line" d="M50 41 L50 26 L42 26 L42 18 L33 18" stroke={theme.secondary} strokeWidth="0.9" />
                <path className="line" d="M46 41 L46 32 L34 32 L34 24 L24 24 L24 20 L14 20" stroke={theme.primary} strokeWidth="0.75" />
                <path className="line" d="M54 41 L54 30 L66 30 L66 22 L80 22 L80 15" stroke={theme.secondary} strokeWidth="0.75" />
                <path className="line" d="M59 46 L70 46 L70 39 L82 39 L82 29 L88 29" stroke={theme.primary} strokeWidth="0.8" />
                <path className="line" d="M59 53 L69 53 L69 61 L78 61 L78 67 L86 67" stroke={theme.secondary} strokeWidth="0.8" />
                <path className="line" d="M54 59 L54 72 L61 72 L61 79 L67 79 L67 89" stroke={theme.primary} strokeWidth="0.75" />
                <path className="line" d="M46 59 L46 70 L37 70 L37 78 L33 78 L33 90" stroke={theme.secondary} strokeWidth="0.75" />
                <path className="line" d="M41 54 L29 54 L29 60 L21 60 L21 66 L14 66" stroke={theme.primary} strokeWidth="0.8" />
                <path className="line" d="M41 47 L31 47 L31 41 L20 41 L20 35 L11 35" stroke={theme.secondary} strokeWidth="0.8" />
                <path className="line" d="M50 59 L50 78 L50 92" stroke={theme.accent} strokeWidth="0.85" />
                <path className="line" d="M50 41 L50 18 L50 8" stroke={theme.accent} strokeWidth="0.85" />
                <path className="line" d="M41 50 L22 50 L12 50" stroke={theme.primary} strokeWidth="0.9" />
                <path className="line" d="M59 50 L79 50 L89 48" stroke={theme.secondary} strokeWidth="0.9" />
                <path className="line" d="M28 26 L28 30 L24 30" stroke={theme.primary} strokeWidth="0.55" />
                <path className="line" d="M28 68 L28 74 L25 74" stroke={theme.secondary} strokeWidth="0.55" />
                <path className="line" d="M72 27 L72 25 L74 25 L74 19 L76 19" stroke={theme.accent} strokeWidth="0.55" />
                <path className="line" d="M76 73 L76 79 L72 79" stroke={theme.primary} strokeWidth="0.55" />
                <path className="line" d="M37 19 L42 19 L42 14 L50 14" stroke={theme.secondary} strokeWidth="0.5" />
                <path className="line" d="M63 18 L68 18 L68 11" stroke={theme.primary} strokeWidth="0.5" />
                <path className="line" d="M36 82 L42 82 L42 87 L50 87" stroke={theme.secondary} strokeWidth="0.5" />
                <path className="line" d="M59 84 L64 84 L64 79" stroke={theme.primary} strokeWidth="0.5" />

                <circle cx="24" cy="30" r="3.2" stroke={theme.primary} strokeWidth="0.55" strokeOpacity="0.7" />
                <circle cx="24" cy="30" r="1" fill={theme.secondary} fillOpacity="0.6" />
                <circle cx="76" cy="73" r="3.2" stroke={theme.secondary} strokeWidth="0.55" strokeOpacity="0.7" />
                <circle cx="76" cy="73" r="1" fill={theme.primary} fillOpacity="0.5" />
                <circle cx="74" cy="25" r="2.8" stroke={theme.accent} strokeWidth="0.5" strokeOpacity="0.6" />
                <circle cx="25" cy="74" r="2.8" stroke={theme.secondary} strokeWidth="0.5" strokeOpacity="0.6" />
              </g>

              <g id="pulse-layer" />
            </svg>
          </div>

          <div
            className="ai-ring absolute inset-0 rounded-full border transition-colors duration-500"
            style={{
              borderColor: theme.primarySoft,
              boxShadow: `0 0 20px ${theme.primarySoft}`,
            }}
          />
          <div
            className="ai-ring absolute inset-2 rounded-full border transition-colors duration-500"
            style={{
              borderColor: theme.secondarySoft,
              boxShadow: `0 0 22px ${theme.secondarySoft}`,
            }}
          />
          <div
            className="ai-ring absolute inset-4 rounded-full border transition-colors duration-500"
            style={{ borderColor: theme.accentSoft }}
          />
        </div>

        <div
          className="relative w-full max-w-6xl border px-6 py-6 backdrop-blur-sm transition-colors duration-500"
          style={{
            borderColor: theme.primarySoft,
            backgroundColor: theme.panelBg,
            boxShadow: `0 0 30px ${theme.primarySoft}`,
          }}
        >
          <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t" style={{ borderColor: `${theme.secondary}b3` }} />
          <div className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t" style={{ borderColor: `${theme.primary}b3` }} />
          <div className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l" style={{ borderColor: `${theme.primary}b3` }} />
          <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r" style={{ borderColor: `${theme.secondary}b3` }} />

          <div
            className="mb-4 flex flex-col gap-4 border-b pb-4 md:flex-row md:items-center md:justify-between"
            style={{ borderColor: theme.primarySoft }}
          >
            <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.textMuted }}>
              <div>Processor Mesh</div>
              <div className="mt-1" style={{ color: theme.primary }}>
                Signal Integrity {modeConfig.integrity}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {(["standby", "scanning", "combat ops", "admin access", "maintenance"] as SystemMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => {
                    setSystemMode(mode);
                    setStatusMessage(`Mode switched to ${mode}.`);
                  }}
                  className="border px-3 py-2 text-[10px] uppercase tracking-[0.22em] transition-all"
                  style={{
                    borderColor: systemMode === mode ? `${theme.primary}cc` : theme.secondarySoft,
                    backgroundColor: systemMode === mode ? theme.primarySoft : theme.panelAlt,
                    color: systemMode === mode ? theme.textMain : theme.textMuted,
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <h1
            className="mb-3 text-center text-5xl font-bold uppercase tracking-[0.35em] md:text-6xl transition-colors duration-500"
            style={{
              color: theme.textMain,
              textShadow: `0 0 10px ${theme.shadowPrimary}`,
            }}
          >
            {modeConfig.headline}
          </h1>

          <p
            className="mx-auto mb-6 max-w-3xl text-center text-sm leading-7 md:text-base transition-colors duration-500"
            style={{ color: theme.textMuted }}
          >
            {modeConfig.description}
          </p>

          <div className="mb-6 grid grid-cols-1 gap-3 text-[11px] uppercase tracking-[0.22em] md:grid-cols-3">
            <div className="border px-4 py-3" style={{ borderColor: theme.secondarySoft, backgroundColor: theme.panelAlt }}>
              <div className="mb-2 flex items-center justify-between" style={{ color: theme.secondary }}>
                <span>Bus Load</span>
                <span>{systemStats.busLoad}%</span>
              </div>
              <div className="h-[2px] w-full" style={{ backgroundColor: theme.secondarySoft }}>
                <div className="data-bar h-[2px] origin-left" style={{ width: `${systemStats.busLoad}%`, backgroundColor: theme.secondary }} />
              </div>
            </div>

            <div className="border px-4 py-3" style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt }}>
              <div className="mb-2 flex items-center justify-between" style={{ color: theme.primary }}>
                <span>Core Flux</span>
                <span>{systemStats.coreFlux}%</span>
              </div>
              <div className="h-[2px] w-full" style={{ backgroundColor: theme.primarySoft }}>
                <div className="data-bar h-[2px] origin-left" style={{ width: `${systemStats.coreFlux}%`, backgroundColor: theme.primary }} />
              </div>
            </div>

            <div className="border px-4 py-3" style={{ borderColor: theme.accentSoft, backgroundColor: theme.panelAlt }}>
              <div className="mb-2 flex items-center justify-between" style={{ color: theme.accent }}>
                <span>Memory Sync</span>
                <span>{systemStats.memorySync}%</span>
              </div>
              <div className="h-[2px] w-full" style={{ backgroundColor: theme.accentSoft }}>
                <div className="data-bar h-[2px] origin-left" style={{ width: `${systemStats.memorySync}%`, backgroundColor: theme.accent }} />
              </div>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardCards.map((card) => (
              <div
                key={card.title}
                className="border px-4 py-4 transition-colors duration-500"
                style={{
                  borderColor: theme.primarySoft,
                  backgroundColor: theme.panelAlt,
                  boxShadow: `0 0 18px ${theme.primarySoft}`,
                }}
              >
                <div className="mb-2 text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.secondary }}>
                  {card.title}
                </div>
                <div className="mb-2 text-lg font-bold uppercase tracking-[0.18em]" style={{ color: theme.textMain }}>
                  {card.value}
                </div>
                <p className="text-xs leading-6" style={{ color: theme.textMuted }}>
                  {card.detail}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {quickActions.map((action) => (
              <button
                key={action.label}
                onClick={() => handleQuickAction(action)}
                className="border px-4 py-4 text-left transition-all"
                style={{
                  borderColor: theme.secondarySoft,
                  backgroundColor: theme.panelAlt,
                }}
              >
                <div className="mb-1 text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.secondary }}>
                  Quick Action
                </div>
                <div className="text-sm font-bold uppercase tracking-[0.22em]" style={{ color: theme.textMain }}>
                  {action.label}
                </div>
                <div className="mt-2 text-xs uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
                  /{action.command}
                </div>
              </button>
            ))}
          </div>

          <div className="mb-6 border p-4 transition-colors duration-500" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
            <div className="mb-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.textMuted }}>
              Command Console
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <input
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") runCommand(command);
                }}
                placeholder="Enter command: personnel / certifications / events / servers / logistics / admin / scan / combat / maintenance"
                className="w-full border bg-black px-4 py-3 text-sm outline-none transition-colors duration-500"
                style={{
                  borderColor: theme.secondarySoft,
                  color: theme.textMain,
                }}
              />
              <button
                onClick={() => runCommand(command)}
                className="border px-6 py-3 text-sm font-bold uppercase tracking-[0.22em] transition-all"
                style={{
                  borderColor: `${theme.secondary}99`,
                  backgroundColor: theme.panelAlt,
                  color: theme.accent,
                }}
              >
                Execute
              </button>
            </div>

            <div className="mt-3 text-xs uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
              Status: {statusMessage}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center gap-3 md:flex-row">
            <button
              onClick={handleEngageCore}
              disabled={booting}
              className="group relative overflow-hidden border bg-black px-10 py-4 text-sm font-bold uppercase tracking-[0.35em] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-60"
              style={{
                borderColor: `${theme.primary}cc`,
                color: theme.primary,
                boxShadow: `0 0 24px ${theme.shadowSecondary}`,
              }}
            >
              <span
                className="absolute inset-y-0 left-0 w-10 opacity-70 transition-all duration-300 group-hover:left-full group-hover:w-16"
                style={{
                  background: `linear-gradient(90deg, ${theme.secondarySoft}, transparent)`,
                }}
              />
              <span className="relative z-10">{booting ? "BOOTING..." : "ENGAGE CORE"}</span>
            </button>

            <div className="text-center text-[10px] uppercase tracking-[0.25em]" style={{ color: theme.textMuted }}>
              {booting
                ? bootStage
                : systemOnline
                ? "Activation complete // command systems live"
                : "Core offline // ready for initialization"}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}