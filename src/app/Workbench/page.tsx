"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { animate, svg } from "animejs";

type SystemMode = "standby" | "scanning" | "combat ops" | "admin access" | "maintenance";
type LocalAccessLevel = "standard" | "ops" | "admin";

type QuickAction = {
  label: string;
  route: string;
  command: string;
  statLabel: string;
  statValue: string;
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
  warning: string;
  warningSoft: string;
  success: string;
  successSoft: string;
};

type CommandEntry = {
  id: string;
  type: "input" | "output" | "warn";
  text: string;
};

type ActivityItem = {
  id: string;
  label: string;
  detail: string;
  time: string;
};

type AlertItem = {
  id: string;
  level: "info" | "warning" | "critical";
  text: string;
  time: string;
};

type Diagnostics = {
  uplinkLatency: number;
  activeUsers: number;
  activeServers: number;
  latestAudit: string;
  latestBooking: string;
  alertLevel: string;
};

type BootCheck = {
  id: string;
  label: string;
  status: "pending" | "running" | "pass";
};

type SubsystemStatus = "ONLINE" | "DEGRADED" | "SYNCING" | "LOCKED" | "OFFLINE";

type SectorItem = {
  id: string;
  sector: string;
  status: string;
};

const MODE_ACCESS: Record<SystemMode, LocalAccessLevel> = {
  standby: "standard",
  scanning: "standard",
  "combat ops": "ops",
  "admin access": "admin",
  maintenance: "admin",
};

const ACCESS_RANK: Record<LocalAccessLevel, number> = {
  standard: 1,
  ops: 2,
  admin: 3,
};

function getTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

export default function AIInterface() {
  const router = useRouter();

  const [systemMode, setSystemMode] = useState<SystemMode>("standby");
  const [systemOnline, setSystemOnline] = useState(false);
  const [booting, setBooting] = useState(false);
  const [bootStage, setBootStage] = useState("Awaiting activation...");
  const [bootProgress, setBootProgress] = useState(0);
  const [command, setCommand] = useState("");
  const [statusMessage, setStatusMessage] = useState("System in passive standby.");
  const [accessLevel, setAccessLevel] = useState<LocalAccessLevel>("admin");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [detailsDrawerOpen, setDetailsDrawerOpen] = useState(false);
  const [modulesDrawerOpen, setModulesDrawerOpen] = useState(false);

  const [commandHistory, setCommandHistory] = useState<CommandEntry[]>([
    {
      id: makeId(),
      type: "output",
      text: `[${getTimestamp()}] Neural interface initialized. Core idle.`,
    },
  ]);

  const [activityFeed, setActivityFeed] = useState<ActivityItem[]>([
    {
      id: makeId(),
      label: "System Boot",
      detail: "Interface shell loaded into passive standby.",
      time: getTimestamp(),
    },
    {
      id: makeId(),
      label: "Route Cache",
      detail: "Quick action pathways indexed and ready.",
      time: getTimestamp(),
    },
    {
      id: makeId(),
      label: "Diagnostics",
      detail: "Signal and visual layers synchronized.",
      time: getTimestamp(),
    },
  ]);

  const [alerts, setAlerts] = useState<AlertItem[]>([
    {
      id: makeId(),
      level: "info",
      text: "Passive standby active. Awaiting operator input.",
      time: getTimestamp(),
    },
  ]);

  const [bootChecks, setBootChecks] = useState<BootCheck[]>([
    { id: "boot-1", label: "Neural Shell Integrity", status: "pending" },
    { id: "boot-2", label: "Command Bus Link", status: "pending" },
    { id: "boot-3", label: "Visual Layer Sync", status: "pending" },
    { id: "boot-4", label: "Uplink Handshake", status: "pending" },
    { id: "boot-5", label: "Route Cache", status: "pending" },
    { id: "boot-6", label: "Memory Lattice", status: "pending" },
  ]);

  const [diagnostics, setDiagnostics] = useState<Diagnostics>({
    uplinkLatency: 28,
    activeUsers: 12,
    activeServers: 4,
    latestAudit: "Promotion routing verified",
    latestBooking: "Training server reserved",
    alertLevel: "LOW",
  });

  const [sectorFeed, setSectorFeed] = useState<SectorItem[]>([
    { id: makeId(), sector: "SECTOR A1", status: "CLEAR" },
    { id: makeId(), sector: "SECTOR C4", status: "SIGNAL FOUND" },
    { id: makeId(), sector: "NODE F2", status: "AUTHORIZED" },
    { id: makeId(), sector: "GRID H7", status: "DEGRADED" },
    { id: makeId(), sector: "SECTOR D2", status: "LOW TRAFFIC" },
  ]);

  const [tickerItems, setTickerItems] = useState<string[]>([
    "SYSTEM READY",
    "PASSIVE STANDBY ACTIVE",
    "SIGNAL MONITOR IDLE",
    "COMMAND INTERFACE LINKED",
  ]);

  const bootTimeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const alertTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const animationCleanupRef = useRef<(() => void) | null>(null);

  const quickActions: QuickAction[] = useMemo(
    () => [
      { label: "Personnel", route: "/personnel", command: "personnel", statLabel: "Records", statValue: "184" },
      { label: "Certifications", route: "/certifications", command: "certifications", statLabel: "Tracked", statValue: "63" },
      { label: "Events", route: "/events", command: "events", statLabel: "Upcoming", statValue: "09" },
      { label: "Servers", route: "/servers", command: "servers", statLabel: "Online", statValue: "04" },
      { label: "Logistics", route: "/logistics", command: "logistics", statLabel: "Pending", statValue: "11" },
      { label: "Admin", route: "/admin", command: "admin", statLabel: "Queues", statValue: "05" },
    ],
    []
  );

  const availableCommands = useMemo(
    () => [
      "personnel",
      "certifications",
      "events",
      "servers",
      "logistics",
      "admin",
      "scan",
      "combat",
      "maintenance",
      "standby",
      "admin access",
      "help",
      "clear",
      "engage",
      "drawer",
      "alerts",
      "sector scan",
      "modules",
    ],
    []
  );

  const suggestions = useMemo(() => {
    const normalized = command.trim().toLowerCase();
    if (!normalized) return [];
    return availableCommands.filter((cmd) => cmd.startsWith(normalized)).slice(0, 6);
  }, [availableCommands, command]);

  const modeConfig = useMemo(() => {
    switch (systemMode) {
      case "scanning":
        return {
          label: "Neural Scan Matrix // Active",
          headline: "AI CORE",
          description:
            "Extended network scan enabled. Signal acquisition, command parsing, and route analysis are running across local command systems.",
          integrity: "97.8%",
          ringDurations: [18000, 24000, 30000],
        };
      case "combat ops":
        return {
          label: "Combat Operations Layer // Armed",
          headline: "AI CORE",
          description:
            "Rapid-response command routing active. Priority monitoring has shifted toward tactical systems, alert channels, and live operational readiness.",
          integrity: "99.7%",
          ringDurations: [9000, 12000, 15000],
        };
      case "admin access":
        return {
          label: "Administrative Override // Authorized",
          headline: "AI CORE",
          description:
            "Administrative control privileges unlocked. Configuration routing, management pathways, and internal system tools are available for execution.",
          integrity: "99.9%",
          ringDurations: [18000, 24000, 30000],
        };
      case "maintenance":
        return {
          label: "Maintenance Protocol // Stabilized",
          headline: "AI CORE",
          description:
            "Subsystem diagnostics and service routines are active. Core processes are held in a stable state for repair, review, and synchronization.",
          integrity: "96.4%",
          ringDurations: [18000, 24000, 30000],
        };
      case "standby":
      default:
        return {
          label: "Neural Circuit Matrix // Online",
          headline: "AI CORE",
          description:
            "Dense circuit-board intelligence architecture with active data pathways, processor routing, and stabilized core monitoring.",
          integrity: "99.2%",
          ringDurations: [0, 0, 0],
        };
    }
  }, [systemMode]);

  const motionConfig = useMemo(() => {
    if (reducedMotion) {
      return {
        sphereSpin: false,
        sphereDuration: 0,
        lineDraw: false,
        lineDuration: 0,
        ringSpin: false,
        floatShell: false,
        pulse: true,
      };
    }

    switch (systemMode) {
      case "combat ops":
        return {
          sphereSpin: true,
          sphereDuration: 16000,
          lineDraw: true,
          lineDuration: 1400,
          ringSpin: true,
          floatShell: true,
          pulse: true,
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
          floatShell: true,
          pulse: true,
        };
      case "standby":
      default:
        return {
          sphereSpin: false,
          sphereDuration: 0,
          lineDraw: false,
          lineDuration: 0,
          ringSpin: false,
          floatShell: false,
          pulse: true,
        };
    }
  }, [reducedMotion, systemMode]);

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
          warning: "#ffc266",
          warningSoft: "rgba(255,194,102,0.18)",
          success: "#7dff9e",
          successSoft: "rgba(125,255,158,0.18)",
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
          warning: "#ffd873",
          warningSoft: "rgba(255,216,115,0.18)",
          success: "#7effff",
          successSoft: "rgba(126,255,255,0.18)",
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
          warning: "#f0b8ff",
          warningSoft: "rgba(240,184,255,0.18)",
          success: "#c5ff9f",
          successSoft: "rgba(197,255,159,0.18)",
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
          warning: "#ffd66e",
          warningSoft: "rgba(255,214,110,0.18)",
          success: "#7dff9e",
          successSoft: "rgba(125,255,158,0.18)",
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

  const subsystemGrid = useMemo(() => {
    const mapByMode: Record<SystemMode, { label: string; status: SubsystemStatus }[]> = {
      standby: [
        { label: "Command Routing", status: "ONLINE" },
        { label: "Sensor Array", status: "OFFLINE" },
        { label: "Event Relay", status: "SYNCING" },
        { label: "Personnel Index", status: "ONLINE" },
        { label: "Audit Monitor", status: "ONLINE" },
        { label: "Booking Engine", status: "ONLINE" },
        { label: "Logistics Bridge", status: "LOCKED" },
        { label: "Threat Scanner", status: "OFFLINE" },
      ],
      scanning: [
        { label: "Command Routing", status: "ONLINE" },
        { label: "Sensor Array", status: "ONLINE" },
        { label: "Event Relay", status: "ONLINE" },
        { label: "Personnel Index", status: "ONLINE" },
        { label: "Audit Monitor", status: "ONLINE" },
        { label: "Booking Engine", status: "ONLINE" },
        { label: "Logistics Bridge", status: "SYNCING" },
        { label: "Threat Scanner", status: "ONLINE" },
      ],
      "combat ops": [
        { label: "Command Routing", status: "ONLINE" },
        { label: "Sensor Array", status: "ONLINE" },
        { label: "Event Relay", status: "DEGRADED" },
        { label: "Personnel Index", status: "ONLINE" },
        { label: "Audit Monitor", status: "ONLINE" },
        { label: "Booking Engine", status: "ONLINE" },
        { label: "Logistics Bridge", status: "ONLINE" },
        { label: "Threat Scanner", status: "ONLINE" },
      ],
      "admin access": [
        { label: "Command Routing", status: "ONLINE" },
        { label: "Sensor Array", status: "SYNCING" },
        { label: "Event Relay", status: "ONLINE" },
        { label: "Personnel Index", status: "ONLINE" },
        { label: "Audit Monitor", status: "ONLINE" },
        { label: "Booking Engine", status: "ONLINE" },
        { label: "Logistics Bridge", status: "ONLINE" },
        { label: "Threat Scanner", status: "LOCKED" },
      ],
      maintenance: [
        { label: "Command Routing", status: "SYNCING" },
        { label: "Sensor Array", status: "OFFLINE" },
        { label: "Event Relay", status: "DEGRADED" },
        { label: "Personnel Index", status: "ONLINE" },
        { label: "Audit Monitor", status: "ONLINE" },
        { label: "Booking Engine", status: "DEGRADED" },
        { label: "Logistics Bridge", status: "LOCKED" },
        { label: "Threat Scanner", status: "OFFLINE" },
      ],
    };

    return mapByMode[systemMode];
  }, [systemMode]);

  const modePanel = useMemo(() => {
    switch (systemMode) {
      case "scanning":
        return {
          title: "Scan Matrix",
          subtitle: "Signal acquisition active",
          bullets: [
            "Sector sweeps cycling through monitored zones.",
            "Anomaly detection tuned for low-noise signal pickup.",
            "Non-critical pathways remain open for command routing.",
          ],
          response: "Observing all local channels. Pattern shifts are being mapped and indexed.",
        };
      case "combat ops":
        return {
          title: "Combat Readiness",
          subtitle: "Priority threat routing enabled",
          bullets: [
            "Alert channels elevated to tactical priority.",
            "Route response times compressed for rapid dispatch.",
            "Auxiliary nodes redirected toward operational resilience.",
          ],
          response: "Priority locked. Threat classification active. Tactical pathways are ready for immediate execution.",
        };
      case "admin access":
        return {
          title: "Administrative Override",
          subtitle: "Protected tools available",
          bullets: [
            "Management channels unlocked for configuration access.",
            "Protected route permissions elevated to admin clearance.",
            "Internal audit and oversight controls available.",
          ],
          response: "Administrative verification complete. Protected controls are available within your current clearance band.",
        };
      case "maintenance":
        return {
          title: "Maintenance Frame",
          subtitle: "Stability and repair routines active",
          bullets: [
            "Subsystem repair queues are being reviewed.",
            "Degraded services are being isolated for service cycles.",
            "Non-essential processes remain deprioritized during stabilization.",
          ],
          response: "Repair posture maintained. Diagnostics continue to cycle across all serviceable layers.",
        };
      case "standby":
      default:
        return {
          title: "Passive Standby",
          subtitle: "Low-power monitoring state",
          bullets: [
            "Core integrity remains stable during passive watch.",
            "Only baseline routing and interface systems are active.",
            "Protected and tactical modules remain dormant until requested.",
          ],
          response: "Standing by. Awaiting command input with passive environmental monitoring maintained.",
        };
    }
  }, [systemMode]);

  const dashboardCards = useMemo(() => {
    return [
      {
        title: "Server Status",
        value: systemOnline ? `${String(diagnostics.activeServers).padStart(2, "0")} ONLINE / 01 DEGRADED` : "OFFLINE",
        detail: systemOnline
          ? "Primary cluster responding. One auxiliary node reporting reduced throughput."
          : "Core systems not yet engaged.",
      },
      {
        title: "Task Queue",
        value: systemOnline ? "18 ACTIVE" : "--",
        detail: systemOnline
          ? "Queued processes include personnel lookup, bookings, qualification queries, and sync checks."
          : "Task routing unavailable until activation.",
      },
      {
        title: "Threat Monitor",
        value: diagnostics.alertLevel,
        detail:
          diagnostics.alertLevel === "ELEVATED"
            ? "Priority channels unlocked. Tactical signal routing emphasized."
            : diagnostics.alertLevel === "SERVICE"
            ? "Maintenance posture active. Degraded subsystems isolated."
            : "No immediate anomalies detected in monitored pathways.",
      },
      {
        title: "Last Command",
        value:
          commandHistory
            .filter((entry) => entry.type === "input")
            .slice(-1)[0]
            ?.text.replace(/^.*?> /, "")
            .toUpperCase() || "NONE",
        detail: statusMessage,
      },
    ];
  }, [commandHistory, diagnostics.activeServers, diagnostics.alertLevel, statusMessage, systemOnline]);

  const addHistory = (type: CommandEntry["type"], text: string) => {
    setCommandHistory((prev) => [
      ...prev.slice(-24),
      {
        id: makeId(),
        type,
        text: `[${getTimestamp()}] ${text}`,
      },
    ]);
  };

  const addActivity = (label: string, detail: string) => {
    setActivityFeed((prev) => [
      {
        id: makeId(),
        label,
        detail,
        time: getTimestamp(),
      },
      ...prev,
    ].slice(0, 7));
  };

  const addAlert = (level: AlertItem["level"], text: string, autoDismiss = true) => {
    const id = makeId();
    setAlerts((prev) => [{ id, level, text, time: getTimestamp() }, ...prev].slice(0, 5));
    setTickerItems((prev) => [text.toUpperCase(), ...prev].slice(0, 8));

    if (autoDismiss) {
      const timeout = setTimeout(() => {
        setAlerts((prev) => prev.filter((item) => item.id !== id));
      }, 7000);
      alertTimeoutsRef.current.push(timeout);
    }
  };

  const canAccessMode = (mode: SystemMode) => {
    return ACCESS_RANK[accessLevel] >= ACCESS_RANK[MODE_ACCESS[mode]];
  };

  const switchMode = (mode: SystemMode) => {
    if (!canAccessMode(mode)) {
      const required = MODE_ACCESS[mode];
      const msg = `Access denied. ${mode} requires ${required} clearance.`;
      setStatusMessage(msg);
      addHistory("warn", msg);
      addActivity("Access Control", msg);
      addAlert("warning", `UNAUTHORIZED MODE REQUEST // ${mode.toUpperCase()}`);
      return;
    }

    setSystemMode(mode);
    const msg = `Mode switched to ${mode}.`;
    setStatusMessage(msg);
    addHistory("output", msg);
    addActivity("Mode Shift", `System mode set to ${mode}.`);

    const alertLevel = mode === "combat ops" ? "ELEVATED" : mode === "maintenance" ? "SERVICE" : "LOW";
    setDiagnostics((prev) => ({
      ...prev,
      alertLevel,
    }));

    if (mode === "combat ops") {
      addAlert("critical", "COMBAT OPERATIONS LAYER ACTIVE");
    } else if (mode === "maintenance") {
      addAlert("warning", "MAINTENANCE PROTOCOLS ENGAGED");
    } else if (mode === "admin access") {
      addAlert("info", "ADMINISTRATIVE OVERRIDE AUTHORIZED");
    } else if (mode === "scanning") {
      addAlert("info", "SCAN MATRIX ACTIVE");
    } else {
      addAlert("info", "SYSTEM RETURNED TO STANDBY");
    }
  };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyPref = () => setReducedMotion(media.matches);
    applyPref();
    const listener = () => applyPref();
    media.addEventListener("change", listener);
    return () => {
      media.removeEventListener("change", listener);
    };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      setDiagnostics((prev) => {
        const latencyDelta = Math.floor(Math.random() * 7) - 3;
        const userDelta = Math.floor(Math.random() * 3) - 1;
        const nextLatency = Math.max(18, Math.min(72, prev.uplinkLatency + latencyDelta));
        const nextUsers = Math.max(7, Math.min(28, prev.activeUsers + userDelta));
        const nextServers = systemOnline ? 4 : 0;

        return {
          ...prev,
          uplinkLatency: nextLatency,
          activeUsers: nextUsers,
          activeServers: nextServers,
        };
      });

      setSectorFeed((prev) => {
        const statusesByMode: Record<SystemMode, string[]> = {
          standby: ["CLEAR", "LOW TRAFFIC", "IDLE", "MONITORED"],
          scanning: ["SIGNAL FOUND", "SCANNING", "AUTHORIZED", "TRACE ACTIVE", "CLEAR"],
          "combat ops": ["HOSTILE TRACE", "ELEVATED", "TARGET LOCK", "CONTESTED", "HOT"],
          "admin access": ["AUTHORIZED", "VERIFIED", "PROTECTED", "OVERSIGHT", "CONTROLLED"],
          maintenance: ["SERVICE", "DEGRADED", "PATCHING", "ISOLATED", "REPAIR"],
        };

        const sectors = ["SECTOR A1", "SECTOR B3", "SECTOR C4", "GRID H7", "NODE F2", "GRID D6", "SECTOR E9"];
        const next = {
          id: makeId(),
          sector: randomFrom(sectors),
          status: randomFrom(statusesByMode[systemMode]),
        };

        return [next, ...prev].slice(0, 6);
      });

      if (systemMode === "combat ops" && Math.random() > 0.7) {
        addAlert("critical", "UPLINK LATENCY SPIKE DETECTED");
      } else if (systemMode === "maintenance" && Math.random() > 0.78) {
        addAlert("warning", "AUXILIARY NODE DEGRADED");
      } else if (systemMode === "scanning" && Math.random() > 0.82) {
        addAlert("info", "SECTOR SIGNAL VARIANCE DETECTED");
      }
    }, 2600);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [systemOnline, systemMode]);

  useEffect(() => {
    if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);

    tickerIntervalRef.current = setInterval(() => {
      setTickerItems((prev) => {
        if (prev.length <= 1) return prev;
        return [...prev.slice(1), prev[0]];
      });
    }, 2800);

    return () => {
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (animationCleanupRef.current) {
      animationCleanupRef.current();
      animationCleanupRef.current = null;
    }

    const cleanupFns: Array<() => void> = [];

    const sphereShell = document.getElementById("sphere-shell");
    if (sphereShell && motionConfig.floatShell) {
      const anim = animate(sphereShell, {
        translateY: ["0px", "-6px", "0px"],
        easing: "easeInOutSine",
        duration: systemMode === "combat ops" ? 2200 : 4200,
        loop: true,
      });
      cleanupFns.push(() => {
        anim.pause();
        sphereShell.style.transform = "translateY(0px)";
      });
    } else if (sphereShell) {
      sphereShell.style.transform = "translateY(0px)";
    }

    const sphere = document.getElementById("ai-sphere");
    if (sphere && motionConfig.sphereSpin) {
      const anim = animate(sphere, {
        rotate: ["0deg", "360deg"],
        easing: "linear",
        duration: motionConfig.sphereDuration,
        loop: true,
      });
      cleanupFns.push(() => {
        anim.pause();
        sphere.style.transform = "rotate(0deg)";
      });
    } else if (sphere) {
      sphere.style.transform = "rotate(0deg)";
    }

    const rings = Array.from(document.getElementsByClassName("ai-ring")) as HTMLDivElement[];
    rings.forEach((ring, idx) => {
      if (motionConfig.ringSpin) {
        const anim = animate(ring, {
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
        cleanupFns.push(() => {
          anim.pause();
          ring.style.transform = "rotate(0deg)";
        });
      } else {
        ring.style.transform = "rotate(0deg)";
      }
    });

    const coreGlow = document.getElementById("core-glow");
    if (coreGlow && motionConfig.pulse) {
      const anim = animate(coreGlow, {
        r:
          systemMode === "combat ops"
            ? [10, 15, 10]
            : systemOnline
            ? [10, 13.5, 10]
            : [10, 11.5, 10],
        opacity:
          systemMode === "combat ops"
            ? [0.12, 0.34, 0.12]
            : systemOnline
            ? [0.12, 0.24, 0.12]
            : [0.08, 0.16, 0.08],
        easing: "easeInOutSine",
        duration: systemMode === "combat ops" ? 1400 : 2600,
        loop: true,
      });
      cleanupFns.push(() => anim.pause());
    }

    const coreInnerGlow = document.getElementById("core-inner-glow");
    if (coreInnerGlow && motionConfig.pulse) {
      const anim = animate(coreInnerGlow, {
        r: systemMode === "combat ops" ? [5.8, 8, 5.8] : [5.8, 7.2, 5.8],
        opacity: systemOnline ? [0.16, 0.3, 0.16] : [0.12, 0.24, 0.12],
        easing: "easeInOutSine",
        duration: systemMode === "combat ops" ? 1100 : 1800,
        loop: true,
      });
      cleanupFns.push(() => anim.pause());
    }

    const coreHighlight = document.getElementById("core-highlight");
    if (coreHighlight && motionConfig.pulse) {
      const anim = animate(coreHighlight, {
        opacity: [0.2, 0.45, 0.2],
        easing: "easeInOutSine",
        duration: systemMode === "combat ops" ? 1200 : 2200,
        loop: true,
      });
      cleanupFns.push(() => anim.pause());
    }

    const paths = Array.from(
      document.querySelectorAll<SVGPathElement>("#ai-circuits .line, #ai-circuits .core-line")
    );

    if (paths.length > 0 && motionConfig.lineDraw) {
      const drawables = paths.map((p) => {
        p.style.opacity = "1";
        p.style.removeProperty("stroke-dasharray");
        p.style.removeProperty("stroke-dashoffset");
        return svg.createDrawable(p);
      });

      drawables.forEach((drawable) => {
        const anim = animate(drawable, {
          draw: ["0 0", "0 1", "1 1"],
          easing: "easeInOutQuad",
          duration: motionConfig.lineDuration + Math.random() * 1200,
          delay: Math.random() * 1500,
          loop: true,
        });
        cleanupFns.push(() => anim.pause());
      });
    } else {
      paths.forEach((p) => {
        p.style.opacity = systemMode === "standby" ? "0" : "1";
        p.style.removeProperty("stroke-dasharray");
        p.style.removeProperty("stroke-dashoffset");
      });
    }

    const vias = Array.from(document.querySelectorAll<SVGCircleElement>("#ai-circuits .via"));
    vias.forEach((via, i) => {
      const anim = animate(via, {
        opacity: [0.22, 0.85, 0.22],
        scale: [1, 1.2, 1],
        easing: "easeInOutSine",
        duration: 1300 + (i % 4) * 220,
        delay: i * 120,
        loop: true,
        direction: "alternate",
      });
      cleanupFns.push(() => anim.pause());
    });

    const pulses = Array.from(document.querySelectorAll<SVGCircleElement>("#ai-circuits .pulse"));
    pulses.forEach((node, i) => {
      const anim = animate(node, {
        scale: [1, systemMode === "combat ops" ? 2 : 1.7, 1],
        opacity: [0.4, 1, 0.4],
        easing: "easeInOutSine",
        duration: systemMode === "combat ops" ? 1200 + i * 70 : 1700 + i * 110,
        delay: i * 70,
        loop: true,
      });
      cleanupFns.push(() => anim.pause());
    });

    const dataBars = Array.from(document.querySelectorAll<HTMLElement>(".data-bar"));
    dataBars.forEach((bar, i) => {
      const anim = animate(bar, {
        opacity: [0.35, 1, 0.35],
        scaleX: [0.7, 1, 0.7],
        easing: "easeInOutSine",
        duration: 1400 + i * 180,
        delay: i * 140,
        loop: true,
      });
      cleanupFns.push(() => anim.pause());
    });

    animationCleanupRef.current = () => {
      cleanupFns.forEach((fn) => fn());
    };

    return () => {
      cleanupFns.forEach((fn) => fn());
    };
  }, [modeConfig.ringDurations, motionConfig, systemMode, systemOnline]);

  useEffect(() => {
    return () => {
      bootTimeouts.current.forEach(clearTimeout);
      alertTimeoutsRef.current.forEach(clearTimeout);
      bootTimeouts.current = [];
      alertTimeoutsRef.current = [];
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (tickerIntervalRef.current) clearInterval(tickerIntervalRef.current);
      if (animationCleanupRef.current) animationCleanupRef.current();
    };
  }, []);

  const runCommand = (input: string) => {
    const normalized = input.trim().toLowerCase();
    if (!normalized) {
      setStatusMessage("No command entered.");
      addHistory("warn", "No command entered.");
      return;
    }

    addHistory("input", `> ${normalized}`);

    if (normalized === "help") {
      const msg = `Available: ${availableCommands.join(", ")}`;
      setStatusMessage("Displayed available commands.");
      addHistory("output", msg);
      return;
    }

    if (normalized === "clear") {
      setCommandHistory([
        {
          id: makeId(),
          type: "output",
          text: `[${getTimestamp()}] Console cleared.`,
        },
      ]);
      setStatusMessage("Console cleared.");
      return;
    }

    if (normalized === "engage") {
      handleEngageCore();
      return;
    }

    if (normalized === "drawer") {
      setDetailsDrawerOpen((prev) => !prev);
      setStatusMessage("Details drawer toggled.");
      addHistory("output", "Details drawer toggled.");
      return;
    }

    if (normalized === "modules") {
      setModulesDrawerOpen((prev) => !prev);
      setStatusMessage("Navigation modules toggled.");
      addHistory("output", "Navigation modules toggled.");
      return;
    }

    if (normalized === "alerts") {
      setStatusMessage("Alert archive focused.");
      addHistory("output", "Alert archive focused.");
      addAlert("info", "ALERT ARCHIVE REVIEWED");
      return;
    }

    if (normalized === "sector scan") {
      setStatusMessage("Sector scan sweep executed.");
      addHistory("output", "Sector scan sweep executed.");
      addAlert("info", "SECTOR SCAN REFRESH COMPLETE");
      setSectorFeed((prev) => [
        {
          id: makeId(),
          sector: randomFrom(["SECTOR J2", "GRID M4", "NODE P6", "SECTOR T1"]),
          status: randomFrom(["SCAN COMPLETE", "SIGNAL FOUND", "VERIFIED", "CLEAR"]),
        },
        ...prev,
      ].slice(0, 6));
      return;
    }

    if (normalized.includes("personnel")) {
      setStatusMessage("Routing to personnel systems...");
      addHistory("output", "Routing to personnel systems...");
      addActivity("Route Execution", "Personnel module selected.");
      router.push("/personnel");
      return;
    }

    if (normalized.includes("cert") || normalized.includes("qualification")) {
      setStatusMessage("Opening certification records...");
      addHistory("output", "Opening certification records...");
      addActivity("Route Execution", "Certification module selected.");
      router.push("/certifications");
      return;
    }

    if (normalized.includes("event") || normalized.includes("booking")) {
      setStatusMessage("Accessing events and bookings...");
      addHistory("output", "Accessing events and bookings...");
      addActivity("Route Execution", "Events module selected.");
      router.push("/events");
      return;
    }

    if (normalized.includes("server")) {
      setStatusMessage("Opening server control systems...");
      addHistory("output", "Opening server control systems...");
      addActivity("Route Execution", "Servers module selected.");
      router.push("/servers");
      return;
    }

    if (normalized.includes("logistics") || normalized.includes("shop") || normalized.includes("asset")) {
      setStatusMessage("Accessing logistics hub...");
      addHistory("output", "Accessing logistics hub...");
      addActivity("Route Execution", "Logistics module selected.");
      router.push("/logistics");
      return;
    }

    if (normalized === "admin") {
      setStatusMessage("Authorizing administrative route...");
      addHistory("output", "Authorizing administrative route...");
      addActivity("Route Execution", "Admin module selected.");
      router.push("/admin");
      return;
    }

    if (normalized === "scan" || normalized === "/scan") {
      switchMode("scanning");
      return;
    }

    if (normalized === "combat" || normalized === "/combat") {
      switchMode("combat ops");
      return;
    }

    if (normalized === "maintenance" || normalized === "/maintenance") {
      switchMode("maintenance");
      return;
    }

    if (normalized === "standby" || normalized === "/standby") {
      switchMode("standby");
      return;
    }

    if (normalized === "admin access" || normalized === "/admin access") {
      switchMode("admin access");
      return;
    }

    const msg = `Command not recognized: ${normalized}`;
    setStatusMessage(msg);
    addHistory("warn", msg);
    addAlert("warning", `UNKNOWN COMMAND // ${normalized.toUpperCase()}`);
  };

  const handleQuickAction = (action: QuickAction) => {
    setCommand(action.command);
    setStatusMessage(`Opening ${action.label} module...`);
    addHistory("input", `> ${action.command}`);
    addHistory("output", `Opening ${action.label} module...`);
    addActivity("Quick Action", `${action.label} route triggered.`);
    router.push(action.route);
  };

  const updateBootCheck = (index: number, status: BootCheck["status"]) => {
    setBootChecks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, status } : item))
    );
  };

  const resetBootChecks = () => {
    setBootChecks((prev) => prev.map((item) => ({ ...item, status: "pending" })));
  };

  const handleEngageCore = () => {
    if (booting) return;

    bootTimeouts.current.forEach(clearTimeout);
    bootTimeouts.current = [];

    setBooting(true);
    setSystemOnline(false);
    setBootProgress(0);
    setStatusMessage("Boot sequence started.");
    setBootStage("Initializing neural shell...");
    resetBootChecks();
    addHistory("input", "> engage");
    addHistory("output", "Boot sequence started.");
    addActivity("Core Boot", "Initialization sequence started.");
    addAlert("info", "BOOT SEQUENCE INITIATED");

    updateBootCheck(0, "running");

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(12);
        updateBootCheck(0, "pass");
        updateBootCheck(1, "running");
        setBootStage("Calibrating signal pathways...");
      }, 500)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(28);
        updateBootCheck(1, "pass");
        updateBootCheck(2, "running");
      }, 1000)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(44);
        updateBootCheck(2, "pass");
        updateBootCheck(3, "running");
        setBootStage("Synchronizing core memory lattice...");
      }, 1550)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(61);
        updateBootCheck(3, "pass");
        updateBootCheck(4, "running");
      }, 2200)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(79);
        updateBootCheck(4, "pass");
        updateBootCheck(5, "running");
        setBootStage("Authorizing command matrix...");
      }, 2900)
    );

    bootTimeouts.current.push(
      setTimeout(() => {
        setBootProgress(100);
        updateBootCheck(5, "pass");
        setBootStage("AI core online.");
        setBooting(false);
        setSystemOnline(true);
        setSystemMode("scanning");
        setStatusMessage("Core activation complete. Command systems ready.");
        addHistory("output", "Core activation complete. Command systems ready.");
        addActivity("Core Boot", "AI core entered active scanning mode.");
        addAlert("info", "AI CORE ONLINE");
        setDiagnostics((prev) => ({
          ...prev,
          activeServers: 4,
          alertLevel: "LOW",
        }));
      }, 3800)
    );
  };

  const getStatusStyles = (status: SubsystemStatus) => {
    switch (status) {
      case "ONLINE":
        return {
          color: theme.success,
          backgroundColor: theme.successSoft,
          borderColor: theme.successSoft,
        };
      case "DEGRADED":
        return {
          color: theme.warning,
          backgroundColor: theme.warningSoft,
          borderColor: theme.warningSoft,
        };
      case "SYNCING":
        return {
          color: theme.secondary,
          backgroundColor: theme.secondarySoft,
          borderColor: theme.secondarySoft,
        };
      case "LOCKED":
        return {
          color: theme.accent,
          backgroundColor: theme.accentSoft,
          borderColor: theme.accentSoft,
        };
      case "OFFLINE":
      default:
        return {
          color: theme.textMuted,
          backgroundColor: "rgba(255,255,255,0.04)",
          borderColor: theme.primarySoft,
        };
    }
  };

  const getBootStatusColor = (status: BootCheck["status"]) => {
    switch (status) {
      case "pass":
        return theme.success;
      case "running":
        return theme.warning;
      case "pending":
      default:
        return theme.textMuted;
    }
  };

  const getAlertColors = (level: AlertItem["level"]) => {
    if (level === "critical") {
      return {
        borderColor: "rgba(255,59,59,0.35)",
        backgroundColor: "rgba(255,59,59,0.14)",
        color: "#ffd7d7",
      };
    }

    if (level === "warning") {
      return {
        borderColor: theme.warningSoft,
        backgroundColor: theme.warningSoft,
        color: theme.warning,
      };
    }

    return {
      borderColor: theme.secondarySoft,
      backgroundColor: theme.secondarySoft,
      color: theme.accent,
    };
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

      {systemMode === "combat ops" && !reducedMotion && (
        <div
          className="pointer-events-none absolute inset-0 z-[1] animate-pulse"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,59,59,0.05) 0%, rgba(255,59,59,0.01) 28%, rgba(0,0,0,0) 60%)",
          }}
        />
      )}

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1550px] flex-col px-4 py-6 md:px-6 xl:px-8">
        <div
          className="mb-4 overflow-hidden border px-4 py-2 text-[10px] uppercase tracking-[0.28em]"
          style={{
            borderColor: theme.primarySoft,
            backgroundColor: theme.consoleBg,
            color: theme.textMuted,
          }}
        >
          <div className="flex min-w-max items-center gap-10 whitespace-nowrap">
            {tickerItems.map((item, index) => (
              <span key={`${item}-${index}`} style={{ color: index === 0 ? theme.primary : theme.textMuted }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="mb-4 grid gap-3">
            {alerts.slice(0, 2).map((alert) => {
              const colors = getAlertColors(alert.level);
              return (
                <div
                  key={alert.id}
                  className="border px-4 py-3"
                  style={{
                    borderColor: colors.borderColor,
                    backgroundColor: colors.backgroundColor,
                    color: colors.color,
                  }}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-xs font-bold uppercase tracking-[0.22em]">{alert.text}</div>
                    <div className="shrink-0 text-[10px] uppercase tracking-[0.18em]">{alert.time}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="mb-4 grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div
            className="border px-4 py-4 backdrop-blur-sm"
            style={{
              borderColor: theme.primarySoft,
              backgroundColor: theme.panelBg,
              boxShadow: `0 0 24px ${theme.primarySoft}`,
            }}
          >
            <div className="mb-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
              Operator Profile
            </div>

            <div className="space-y-3 text-xs uppercase tracking-[0.18em]">
              {(["standard", "ops", "admin"] as LocalAccessLevel[]).map((level) => (
                <button
                  key={level}
                  onClick={() => {
                    setAccessLevel(level);
                    setStatusMessage(`Local access profile switched to ${level}.`);
                    addActivity("Access Profile", `Local clearance changed to ${level}.`);
                    addAlert("info", `LOCAL CLEARANCE // ${level.toUpperCase()}`);
                  }}
                  className="w-full border px-3 py-2 text-left transition-all"
                  style={{
                    borderColor: accessLevel === level ? `${theme.primary}cc` : theme.secondarySoft,
                    backgroundColor: accessLevel === level ? theme.primarySoft : theme.panelAlt,
                    color: accessLevel === level ? theme.textMain : theme.textMuted,
                  }}
                >
                  {level}
                </button>
              ))}
            </div>

            <div className="mt-4 border-t pt-4 text-[10px] uppercase tracking-[0.24em]" style={{ borderColor: theme.primarySoft, color: theme.textMuted }}>
              <div>Reduced Motion</div>
              <div className="mt-1" style={{ color: theme.primary }}>
                {reducedMotion ? "Enabled by system preference" : "Standard animation profile"}
              </div>
            </div>

            <div className="mt-4 border-t pt-4 text-[10px] uppercase tracking-[0.24em]" style={{ borderColor: theme.primarySoft, color: theme.textMuted }}>
              <div>Details Drawer</div>
              <button
                onClick={() => setDetailsDrawerOpen((prev) => !prev)}
                className="mt-2 w-full border px-3 py-2 text-left"
                style={{
                  borderColor: theme.secondarySoft,
                  backgroundColor: theme.panelAlt,
                  color: theme.secondary,
                }}
              >
                {detailsDrawerOpen ? "Collapse" : "Expand"}
              </button>
            </div>

            <div className="mt-4 border-t pt-4 text-[10px] uppercase tracking-[0.24em]" style={{ borderColor: theme.primarySoft, color: theme.textMuted }}>
              <div>Navigation Modules</div>
              <button
                onClick={() => setModulesDrawerOpen((prev) => !prev)}
                className="mt-2 w-full border px-3 py-2 text-left"
                style={{
                  borderColor: theme.secondarySoft,
                  backgroundColor: theme.panelAlt,
                  color: theme.secondary,
                }}
              >
                {modulesDrawerOpen ? "Collapse" : "Expand"}
              </button>
            </div>
          </div>

          <div className="text-center">
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

          <div
            className="border px-4 py-4 backdrop-blur-sm"
            style={{
              borderColor: theme.primarySoft,
              backgroundColor: theme.panelBg,
              boxShadow: `0 0 24px ${theme.primarySoft}`,
            }}
          >
            <div className="mb-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
              Diagnostics Rail
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between uppercase tracking-[0.18em]">
                <span style={{ color: theme.textMuted }}>Uplink Latency</span>
                <span style={{ color: theme.textMain }}>{diagnostics.uplinkLatency} ms</span>
              </div>
              <div className="flex items-center justify-between uppercase tracking-[0.18em]">
                <span style={{ color: theme.textMuted }}>Active Users</span>
                <span style={{ color: theme.textMain }}>{diagnostics.activeUsers}</span>
              </div>
              <div className="flex items-center justify-between uppercase tracking-[0.18em]">
                <span style={{ color: theme.textMuted }}>Active Servers</span>
                <span style={{ color: theme.textMain }}>{diagnostics.activeServers}</span>
              </div>
              <div className="border-t pt-3" style={{ borderColor: theme.primarySoft }}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                  Latest Audit
                </div>
                <div className="text-xs leading-5" style={{ color: theme.textMain }}>
                  {diagnostics.latestAudit}
                </div>
              </div>
              <div className="border-t pt-3" style={{ borderColor: theme.primarySoft }}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                  Latest Booking
                </div>
                <div className="text-xs leading-5" style={{ color: theme.textMain }}>
                  {diagnostics.latestBooking}
                </div>
              </div>
              <div className="border-t pt-3" style={{ borderColor: theme.primarySoft }}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                  Alert Level
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
                  {diagnostics.alertLevel}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-start">
          <div id="sphere-shell" className="relative mb-8 h-72 w-72 md:h-80 md:w-80">
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

                  {[43, 46, 49, 52, 55, 57].map((x, i) => (
                    <path key={`pin-top-${i}`} className="line" d={`M${x} 39 L${x} 41`} stroke={i % 2 ? theme.primary : theme.secondary} strokeWidth="0.7" />
                  ))}
                  {[43, 46, 49, 52, 55, 57].map((x, i) => (
                    <path key={`pin-bottom-${i}`} className="line" d={`M${x} 59 L${x} 61`} stroke={i % 2 ? theme.secondary : theme.primary} strokeWidth="0.7" />
                  ))}
                  {[43, 46, 49, 52, 55, 57].map((y, i) => (
                    <path key={`pin-left-${i}`} className="line" d={`M39 ${y} L41 ${y}`} stroke={i % 2 ? theme.primary : theme.secondary} strokeWidth="0.7" />
                  ))}
                  {[43, 46, 49, 52, 55, 57].map((y, i) => (
                    <path key={`pin-right-${i}`} className="line" d={`M59 ${y} L61 ${y}`} stroke={i % 2 ? theme.secondary : theme.primary} strokeWidth="0.7" />
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

                  {[
                    [14, 20], [11, 35], [12, 50], [14, 66], [20, 83],
                    [80, 15], [88, 29], [89, 48], [86, 67], [79, 84],
                    [33, 10], [50, 8], [68, 11], [33, 90], [50, 92], [67, 89],
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
                </g>
              </svg>
            </div>

            <div
              className="ai-ring absolute inset-0 rounded-full border transition-colors duration-500"
              style={{ borderColor: theme.primarySoft, boxShadow: `0 0 20px ${theme.primarySoft}` }}
            />
            <div
              className="ai-ring absolute inset-2 rounded-full border transition-colors duration-500"
              style={{ borderColor: theme.secondarySoft, boxShadow: `0 0 22px ${theme.secondarySoft}` }}
            />
            <div
              className="ai-ring absolute inset-4 rounded-full border transition-colors duration-500"
              style={{ borderColor: theme.accentSoft }}
            />
          </div>

          <div
            className="relative w-full border px-4 py-5 backdrop-blur-sm transition-colors duration-500 md:px-6"
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
                {(["standby", "scanning", "combat ops", "admin access", "maintenance"] as SystemMode[]).map((mode) => {
                  const locked = !canAccessMode(mode);
                  return (
                    <button
                      key={mode}
                      onClick={() => switchMode(mode)}
                      className="border px-3 py-2 text-[10px] uppercase tracking-[0.22em] transition-all"
                      style={{
                        borderColor: systemMode === mode ? `${theme.primary}cc` : theme.secondarySoft,
                        backgroundColor: systemMode === mode ? theme.primarySoft : theme.panelAlt,
                        color: locked ? "rgba(255,255,255,0.38)" : systemMode === mode ? theme.textMain : theme.textMuted,
                        opacity: locked ? 0.7 : 1,
                      }}
                    >
                      {mode}
                      {locked ? " [LOCKED]" : ""}
                    </button>
                  );
                })}

                <button
                  onClick={() => setModulesDrawerOpen((prev) => !prev)}
                  className="border px-3 py-2 text-[10px] uppercase tracking-[0.22em] transition-all"
                  style={{
                    borderColor: theme.secondarySoft,
                    backgroundColor: modulesDrawerOpen ? theme.secondarySoft : theme.panelAlt,
                    color: modulesDrawerOpen ? theme.textMain : theme.secondary,
                  }}
                >
                  {modulesDrawerOpen ? "Hide Modules" : "Show Modules"}
                </button>
              </div>
            </div>

            <h1
              className="mb-3 text-center text-4xl font-bold uppercase tracking-[0.35em] md:text-6xl transition-colors duration-500"
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

            {booting && (
              <div className="mb-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="mx-auto w-full max-w-3xl">
                  <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-[0.22em]" style={{ color: theme.textMuted }}>
                    <span>Boot Progress</span>
                    <span>{bootProgress}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden border" style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt }}>
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${bootProgress}%`,
                        background: `linear-gradient(90deg, ${theme.secondary}, ${theme.primary})`,
                      }}
                    />
                  </div>
                </div>

                <div className="border p-4" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                  <div className="mb-3 text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.secondary }}>
                    Boot Diagnostics
                  </div>
                  <div className="space-y-2 text-xs uppercase tracking-[0.18em]">
                    {bootChecks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center justify-between border px-3 py-2"
                        style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt }}
                      >
                        <span style={{ color: theme.textMain }}>{check.label}</span>
                        <span style={{ color: getBootStatusColor(check.status) }}>{check.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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

            <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="border p-4" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
                    Mode-Specific Panel
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.22em]" style={{ color: theme.textMuted }}>
                    {modePanel.subtitle}
                  </div>
                </div>

                <div className="mb-3 text-lg font-bold uppercase tracking-[0.2em]" style={{ color: theme.textMain }}>
                  {modePanel.title}
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                  <div>
                    <div className="space-y-2">
                      {modePanel.bullets.map((item) => (
                        <div
                          key={item}
                          className="border px-3 py-3 text-xs leading-6"
                          style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt, color: theme.textMuted }}
                        >
                          {item}
                        </div>
                      ))}
                    </div>

                    <div
                      className="mt-4 border px-4 py-4 text-sm leading-7"
                      style={{
                        borderColor: theme.secondarySoft,
                        backgroundColor: theme.panelAlt,
                        color: theme.textMain,
                      }}
                    >
                      {modePanel.response}
                    </div>
                  </div>

                  <div className="border p-4" style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt }}>
                    <div className="mb-3 text-[10px] uppercase tracking-[0.26em]" style={{ color: theme.secondary }}>
                      Sector Scan
                    </div>

                    <div className="mb-4 grid grid-cols-5 gap-1">
                      {Array.from({ length: 25 }).map((_, i) => (
                        <div
                          key={i}
                          className="aspect-square border"
                          style={{
                            borderColor: theme.primarySoft,
                            backgroundColor:
                              i % 7 === 0
                                ? theme.primarySoft
                                : i % 11 === 0
                                ? theme.secondarySoft
                                : "rgba(255,255,255,0.02)",
                          }}
                        />
                      ))}
                    </div>

                    <div className="space-y-2 text-[10px] uppercase tracking-[0.18em]">
                      {sectorFeed.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between border px-3 py-2"
                          style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}
                        >
                          <span style={{ color: theme.textMain }}>{item.sector}</span>
                          <span style={{ color: theme.primary }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border p-4" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                <div className="mb-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
                  Subsystem Health Grid
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {subsystemGrid.map((item) => {
                    const styles = getStatusStyles(item.status);
                    return (
                      <div
                        key={item.label}
                        className="border px-3 py-3"
                        style={{
                          borderColor: styles.borderColor,
                          backgroundColor: styles.backgroundColor,
                        }}
                      >
                        <div className="mb-1 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                          {item.label}
                        </div>
                        <div className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: styles.color }}>
                          {item.status}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {modulesDrawerOpen && (
              <div
                className="mb-6 border p-4 transition-colors duration-500"
                style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.secondary }}>
                    Navigation Modules
                  </div>
                  <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: theme.textMuted }}>
                    Collapsible route access panel
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
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
                        Module Route
                      </div>
                      <div className="text-sm font-bold uppercase tracking-[0.22em]" style={{ color: theme.textMain }}>
                        {action.label}
                      </div>
                      <div className="mt-2 text-xs uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
                        /{action.command}
                      </div>
                      <div className="mt-3 text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                        {action.statLabel}: <span style={{ color: theme.accent }}>{action.statValue}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

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

            <div className="mb-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
              <div className="border p-4 transition-colors duration-500" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                <div className="mb-3 flex items-center justify-between">
                  <div className="text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.textMuted }}>
                    Command Console
                  </div>
                  <button
                    onClick={() =>
                      setCommandHistory([
                        {
                          id: makeId(),
                          type: "output",
                          text: `[${getTimestamp()}] Console cleared.`,
                        },
                      ])
                    }
                    className="border px-3 py-1 text-[10px] uppercase tracking-[0.22em]"
                    style={{ borderColor: theme.secondarySoft, color: theme.secondary }}
                  >
                    Clear Log
                  </button>
                </div>

                <div className="flex flex-col gap-3 md:flex-row">
                  <div className="relative w-full">
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

                    {suggestions.length > 0 && (
                      <div
                        className="absolute left-0 right-0 top-full z-20 mt-1 border"
                        style={{
                          borderColor: theme.primarySoft,
                          backgroundColor: theme.consoleBg,
                          boxShadow: `0 0 18px ${theme.primarySoft}`,
                        }}
                      >
                        {suggestions.map((item) => (
                          <button
                            key={item}
                            onClick={() => setCommand(item)}
                            className="block w-full border-b px-4 py-2 text-left text-xs uppercase tracking-[0.18em]"
                            style={{
                              borderColor: theme.primarySoft,
                              color: theme.textMuted,
                            }}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

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

                <div className="mt-3 flex flex-wrap gap-2">
                  {availableCommands.map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => setCommand(cmd)}
                      className="border px-2 py-1 text-[10px] uppercase tracking-[0.16em]"
                      style={{
                        borderColor: theme.primarySoft,
                        backgroundColor: theme.panelAlt,
                        color: theme.textMuted,
                      }}
                    >
                      {cmd}
                    </button>
                  ))}
                </div>

                <div className="mt-4 text-xs uppercase tracking-[0.18em]" style={{ color: theme.primary }}>
                  Status: {statusMessage}
                </div>

                <div
                  className="mt-4 h-56 overflow-y-auto border p-3"
                  style={{
                    borderColor: theme.primarySoft,
                    backgroundColor: "rgba(0,0,0,0.38)",
                  }}
                >
                  <div className="space-y-2 text-xs leading-5">
                    {commandHistory.map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          color:
                            entry.type === "input"
                              ? theme.accent
                              : entry.type === "warn"
                              ? theme.warning
                              : theme.textMuted,
                        }}
                      >
                        {entry.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="border p-4 transition-colors duration-500" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                <div className="mb-3 text-[10px] uppercase tracking-[0.3em]" style={{ color: theme.textMuted }}>
                  Recent Activity
                </div>

                <div className="space-y-3">
                  {activityFeed.map((item) => (
                    <div
                      key={item.id}
                      className="border px-3 py-3"
                      style={{
                        borderColor: theme.primarySoft,
                        backgroundColor: theme.panelAlt,
                      }}
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <div className="text-[10px] uppercase tracking-[0.2em]" style={{ color: theme.secondary }}>
                          {item.label}
                        </div>
                        <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: theme.textMuted }}>
                          {item.time}
                        </div>
                      </div>
                      <div className="text-xs leading-5" style={{ color: theme.textMain }}>
                        {item.detail}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {detailsDrawerOpen && (
              <div className="mb-6 grid gap-6 border p-4 md:grid-cols-2 xl:grid-cols-3" style={{ borderColor: theme.primarySoft, backgroundColor: theme.consoleBg }}>
                <div>
                  <div className="mb-3 text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.secondary }}>
                    Full Diagnostics
                  </div>
                  <div className="space-y-2 text-xs">
                    {[
                      `Core Integrity // ${modeConfig.integrity}`,
                      `Access Profile // ${accessLevel.toUpperCase()}`,
                      `Motion Profile // ${reducedMotion ? "REDUCED" : "STANDARD"}`,
                      `Drawer State // ${detailsDrawerOpen ? "OPEN" : "CLOSED"}`,
                      `Modules State // ${modulesDrawerOpen ? "OPEN" : "CLOSED"}`,
                      `Active Mode // ${systemMode.toUpperCase()}`,
                    ].map((line) => (
                      <div
                        key={line}
                        className="border px-3 py-2 uppercase tracking-[0.18em]"
                        style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt, color: theme.textMain }}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.secondary }}>
                    Alert Archive
                  </div>
                  <div className="space-y-2">
                    {alerts.map((alert) => {
                      const colors = getAlertColors(alert.level);
                      return (
                        <div
                          key={alert.id}
                          className="border px-3 py-2"
                          style={{ borderColor: colors.borderColor, backgroundColor: colors.backgroundColor }}
                        >
                          <div className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colors.color }}>
                            {alert.level}
                          </div>
                          <div className="mt-1 text-xs leading-5" style={{ color: theme.textMain }}>
                            {alert.text}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <div className="mb-3 text-[10px] uppercase tracking-[0.28em]" style={{ color: theme.secondary }}>
                    Boot History
                  </div>
                  <div className="space-y-2">
                    {bootChecks.map((check) => (
                      <div
                        key={check.id}
                        className="flex items-center justify-between border px-3 py-2"
                        style={{ borderColor: theme.primarySoft, backgroundColor: theme.panelAlt }}
                      >
                        <span className="text-xs uppercase tracking-[0.16em]" style={{ color: theme.textMain }}>
                          {check.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.16em]" style={{ color: getBootStatusColor(check.status) }}>
                          {check.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

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
    </div>
  );
}