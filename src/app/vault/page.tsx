"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Stage = "locked" | "scanning" | "terminal" | "unlocked";
type ArchiveTone = "green" | "red" | "blue";
type OpenKey = "sideOp" | "landfall" | "device";

type TeamBlockProps = {
  title: string;
  members: string[];
};

type ArchivePanelProps = {
  title: string;
  icon: string;
  tone: ArchiveTone;
  statusLine: string;
  subStatus: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
};

const VAULT_CODE = "OMEGA";

export default function VaultPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<Stage>("locked");
  const [logs, setLogs] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "neutral" | "success" | "warning" | "danger";
    text: string;
  } | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [openPanels, setOpenPanels] = useState<Record<OpenKey, boolean>>({
    sideOp: false,
    landfall: false,
    device: false,
  });

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const isBusy =
    stage === "scanning" || stage === "terminal" || stage === "unlocked";

  const unlockedCount = useMemo(
    () => Object.values(openPanels).filter(Boolean).length,
    [openPanels]
  );

  const appendLogs = (entries: string[]) => {
    setLogs((prev) => [...prev, ...entries]);
  };

  const formatTerminalLine = (message: string) => {
    const id = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `[SYS-${id}] ${message}`;
  };

  const resetVault = () => {
    setPassword("");
    setStage("locked");
    setLogs([]);
    setStatusMessage(null);
    setScanProgress(0);
    setOpenPanels({
      sideOp: false,
      landfall: false,
      device: false,
    });
  };

  const togglePanel = (key: OpenKey) => {
    setOpenPanels((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const expandAll = () => {
    setOpenPanels({
      sideOp: true,
      landfall: true,
      device: true,
    });
  };

  const collapseAll = () => {
    setOpenPanels({
      sideOp: false,
      landfall: false,
      device: false,
    });
  };

  const handleUnlock = () => {
    if (stage !== "locked") return;

    const normalized = password.trim().toUpperCase();
    const reversed = VAULT_CODE.split("").reverse().join("");

    setLogs([]);
    setStatusMessage(null);
    setScanProgress(0);

    if (!normalized) {
      setStatusMessage({
        tone: "warning",
        text: "Vault code required before access can be attempted.",
      });
      return;
    }

    if (normalized === reversed) {
      setStage("scanning");
      setStatusMessage({
        tone: "warning",
        text: "Backdoor signature detected. Routing through unauthorized channel.",
      });
      return;
    }

    if (normalized !== VAULT_CODE) {
      setFailedAttempts((prev) => prev + 1);
      setPassword("");
      setStatusMessage({
        tone: "danger",
        text: "ACCESS DENIED — provided clearance string is invalid.",
      });
      appendLogs([formatTerminalLine("Rejected invalid authentication token.")]);
      return;
    }

    setStage("scanning");
    setStatusMessage({
      tone: "neutral",
      text: "Credential accepted. Beginning archive integrity scan.",
    });
  };

  useEffect(() => {
    if (stage !== "scanning") return;

    let progress = 0;

    const interval = window.setInterval(() => {
      progress += Math.floor(Math.random() * 18) + 10;

      if (progress >= 100) {
        progress = 100;
        setScanProgress(progress);
        window.clearInterval(interval);

        window.setTimeout(() => {
          setLogs([]);
          setStage("terminal");
        }, 350);

        return;
      }

      setScanProgress(progress);
    }, 180);

    return () => window.clearInterval(interval);
  }, [stage]);

  useEffect(() => {
    if (stage !== "terminal") return;

    const isBackdoor = password.trim().toUpperCase() === VAULT_CODE.split("").reverse().join("");

    const messages = isBackdoor
      ? [
          "Backdoor route exploited.",
          "Privilege escalation in progress...",
          "Firewall handshake spoofed.",
          "Unauthorized admin token accepted.",
          "Secondary archive partitions mounted.",
          "Hidden records linked to active session.",
          "Secret archive unlocked.",
        ]
      : [
          "Initializing access sequence...",
          "Bypassing firewall...",
          "Decrypting archive headers...",
          "Scanning security layers...",
          "Injecting authentication token...",
          "Access key verified.",
          "Reconstructing classified data...",
          "Archive shell online.",
        ];

    let index = 0;

    const interval = window.setInterval(() => {
      if (index >= messages.length) {
        window.clearInterval(interval);

        window.setTimeout(() => {
          setStage("unlocked");
          setStatusMessage({
            tone: isBackdoor ? "warning" : "success",
            text: isBackdoor
              ? "Access granted through unauthorized route. Audit trail suppressed."
              : "Access granted. Republic War Archive is now online.",
          });
        }, 700);

        return;
      }

      setLogs((prev) => [...prev, formatTerminalLine(messages[index])]);
      index++;
    }, 220);

    return () => window.clearInterval(interval);
  }, [stage, password]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrame = 0;
    let lastTime = 0;
    const fontSize = 16;
    const letters = "01";
    let columns = 0;
    let drops: number[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      columns = Math.ceil(canvas.width / fontSize);
      drops = Array.from({ length: columns }, () =>
        Math.floor(Math.random() * canvas.height)
      );
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const draw = (timestamp: number) => {
      if (timestamp - lastTime > 45) {
        lastTime = timestamp;

        ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = "#00ff88";
        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
          const text = letters[Math.floor(Math.random() * letters.length)];
          const x = i * fontSize;
          const y = drops[i] * fontSize;

          ctx.fillText(text, x, y);

          if (y > canvas.height && Math.random() > 0.975) {
            drops[i] = 0;
          } else {
            drops[i]++;
          }
        }
      }

      animationFrame = window.requestAnimationFrame(draw);
    };

    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  const statusClasses =
    statusMessage?.tone === "danger"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : statusMessage?.tone === "warning"
      ? "border-yellow-500/40 bg-yellow-500/10 text-yellow-300"
      : statusMessage?.tone === "success"
      ? "border-green-500/40 bg-green-500/10 text-green-300"
      : "border-cyan-500/30 bg-cyan-500/10 text-cyan-200";

  return (
    <div className="relative min-h-screen overflow-hidden bg-black font-mono text-white">
      <canvas ref={canvasRef} className="absolute inset-0 z-0" />

      <div className="relative z-10 min-h-screen bg-[radial-gradient(circle_at_top,rgba(0,60,30,0.18),transparent_35%)] px-4 py-8 sm:px-6 lg:px-10">
        <div className="mx-auto max-w-[1500px]">
          <button
            onClick={() => router.push("/")}
            className="mb-6 rounded-xl border border-purple-500/50 px-4 py-2 text-purple-300 transition hover:bg-purple-500/15"
          >
            ← Return to Command
          </button>

          <div className="mb-8 flex flex-col gap-5 rounded-[28px] border border-green-500/20 bg-black/55 p-6 shadow-[0_0_50px_rgba(0,255,120,0.08)] backdrop-blur-xl lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.45em] text-green-500/70">
                Republic Intelligence Archive
              </div>
              <h1 className="mt-3 text-3xl font-bold tracking-[0.2em] text-green-400 drop-shadow-[0_0_18px_rgba(0,255,100,0.4)] sm:text-4xl lg:text-5xl">
                REPUBLIC WAR ARCHIVE
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-green-100/65">
                Classified operational records, terminal-gated after action files,
                and preserved campaign intelligence for command-level review.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Stage" value={stage.toUpperCase()} />
              <StatCard label="Entries" value="03" />
              <StatCard label="Opened" value={String(unlockedCount).padStart(2, "0")} />
              <StatCard
                label="Fails"
                value={String(failedAttempts).padStart(2, "0")}
              />
            </div>
          </div>

          {statusMessage && (
            <div
              className={`mb-6 rounded-2xl border px-4 py-3 text-sm tracking-wide ${statusClasses}`}
            >
              {statusMessage.text}
            </div>
          )}

          {stage === "locked" && (
            <div className="max-w-xl rounded-[30px] border border-green-500/30 bg-black/70 p-8 shadow-[0_0_45px_rgba(0,255,100,0.12)] backdrop-blur-xl">
              <div className="mb-6">
                <div className="text-xs uppercase tracking-[0.35em] text-green-500/70">
                  Secure Access Node
                </div>
                <h2 className="mt-3 text-2xl font-bold text-green-400">
                  Classified Access Required
                </h2>
                <p className="mt-3 text-sm leading-6 text-green-100/60">
                  Enter the archive clearance string to initialize authentication
                  and reconstruct the protected operational records.
                </p>
              </div>

              <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-green-100/45">
                    Required Clearance
                  </div>
                  <div className="mt-2 text-sm font-semibold text-green-100/80">
                    Commander Level
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-green-100/45">
                    Security Status
                  </div>
                  <div className="mt-2 text-sm font-semibold text-yellow-300">
                    Vault Locked
                  </div>
                </div>
              </div>

              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleUnlock();
                }}
                placeholder="Enter Vault Code"
                className="mb-4 w-full rounded-2xl border border-green-500/30 bg-black/60 px-4 py-3 text-white outline-none transition placeholder:text-green-100/25 focus:border-green-400 focus:shadow-[0_0_20px_rgba(0,255,100,0.15)]"
              />

              <button
                onClick={handleUnlock}
                disabled={isBusy}
                className="w-full rounded-2xl bg-green-600 px-4 py-3 font-bold text-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Initiate Access
              </button>
            </div>
          )}

          {stage === "scanning" && (
            <div className="rounded-[30px] border border-green-500/35 bg-black/75 p-8 shadow-[0_0_40px_rgba(0,255,100,0.12)] backdrop-blur-xl">
              <div className="text-xs uppercase tracking-[0.35em] text-green-500/70">
                Security Verification
              </div>
              <h2 className="mt-3 text-2xl font-bold text-green-400">
                System Scanning
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-green-100/60">
                Verifying access token, decrypting archive headers, and mapping
                protected record partitions.
              </p>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-green-100/55">
                  <span>Progress</span>
                  <span>{scanProgress}%</span>
                </div>

                <div className="h-4 overflow-hidden rounded-full border border-green-500/20 bg-green-950/40">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-300 transition-all duration-200"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {stage === "terminal" && (
            <div className="rounded-[30px] border border-green-500/40 bg-black/90 p-6 shadow-[0_0_35px_rgba(0,255,100,0.18)]">
              <div className="mb-4 flex items-center justify-between gap-4 border-b border-green-500/15 pb-4">
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-green-500/70">
                    Terminal Session
                  </div>
                  <div className="mt-2 text-lg font-bold text-green-400">
                    Archive Reconstruction Console
                  </div>
                </div>

                <div className="rounded-full border border-green-500/25 bg-green-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-green-300">
                  Live Feed
                </div>
              </div>

              <div
                ref={terminalRef}
                className="h-[420px] overflow-y-auto rounded-2xl border border-green-500/20 bg-black/70 p-4"
              >
                {logs.length === 0 ? (
                  <p className="text-green-500/70">&gt; Awaiting terminal output...</p>
                ) : (
                  logs.map((log, i) => (
                    <p key={`${log}-${i}`} className="mb-2 text-green-400">
                      &gt; {log}
                    </p>
                  ))
                )}
              </div>
            </div>
          )}

          {stage === "unlocked" && (
            <div className="space-y-8">
              <div className="rounded-[30px] border border-green-500/30 bg-black/65 p-8 shadow-[0_0_45px_rgba(0,255,100,0.12)] backdrop-blur-xl">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="text-xs uppercase tracking-[0.35em] text-green-500/70">
                      Archive Access
                    </div>
                    <h2 className="mt-3 text-2xl font-bold text-green-400">
                      Access Granted
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-green-100/65">
                      Command-level access is active. Archived battle records and
                      operation files are now available for review.
                    </p>

                    <div className="mt-4 inline-flex rounded-full border border-yellow-500/35 bg-yellow-500/10 px-3 py-1 text-sm text-yellow-300">
                      Commander Level Clearance
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Archive" value="ONLINE" />
                    <StatCard label="Panels" value="03" />
                    <StatCard label="Opened" value={String(unlockedCount).padStart(2, "0")} />
                    <StatCard label="Session" value="ACTIVE" />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={expandAll}
                    className="rounded-2xl border border-green-500/25 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300 transition hover:bg-green-500/15"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-white/80 transition hover:border-white/20"
                  >
                    Collapse All
                  </button>
                  <button
                    onClick={resetVault}
                    className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-semibold text-purple-300 transition hover:bg-purple-500/15"
                  >
                    Relock Archive
                  </button>
                </div>
              </div>

              <ArchivePanel
                title="GC Side Operation Archive"
                icon="🛑"
                tone="green"
                statusLine="Operation Concluded"
                subStatus="STATUS: Operation Over - B3 ARF are in extreme danger"
                isOpen={openPanels.sideOp}
                onToggle={() => togglePanel("sideOp")}
              >
                <div className="space-y-4 text-sm text-gray-300">
                  <p className="font-semibold text-red-400">
                    The side operation has concluded. Heavy casualties sustained.
                  </p>

                  <p>
                    The platoon was compromised behind enemy lines. Extraction
                    attempts failed for most personnel.
                  </p>

                  <p className="text-yellow-400">
                    Survivors successfully returned to friendly territory.
                  </p>

                  <div className="border-t border-green-500/20 pt-4">
                    <p className="font-semibold text-green-400">
                      Team One — Longbow Omegon
                    </p>

                    <ul className="ml-4 mt-2 space-y-1">
                      <li className="text-red-500 line-through">
                        Team Lead: Akhari — KIA
                      </li>
                      <li className="font-semibold text-green-400">
                        Sniper: Sick — SURVIVED
                      </li>
                      <li className="font-semibold text-green-400">
                        Spotter: Toxic — SURVIVED
                      </li>
                      <li className="font-semibold text-green-400">
                        Medic: Advisor — SURVIVED
                      </li>
                      <li className="text-red-500 line-through">
                        Assault: Sour — KIA
                      </li>
                      <li className="font-semibold text-green-400">
                        Assault: Yami — SURVIVED
                      </li>
                    </ul>

                    <p className="mt-6 font-semibold text-green-400">
                      Team Two — Longbow Epsilon
                    </p>

                    <ul className="ml-4 mt-2 space-y-1">
                      <li className="font-semibold text-yellow-400">
                        Team Lead: Shy — POW
                      </li>
                      <li className="text-red-500 line-through">
                        Sniper: Wulf — KIA
                      </li>
                      <li className="text-red-500 line-through">
                        Spotter: Joker — KIA
                      </li>
                      <li className="font-semibold text-yellow-400">
                        Medic: Warden — POW
                      </li>
                      <li className="text-red-500 line-through">
                        Assault: York — KIA
                      </li>
                      <li className="text-red-500 line-through">
                        Assault: Blitz — KIA
                      </li>
                    </ul>
                  </div>
                </div>
              </ArchivePanel>

              <ArchivePanel
                title="C2 LANDFALL — TRITON"
                icon="🚀"
                tone="red"
                statusLine="STATUS: Foothold Established"
                subStatus="853 Confirmed Eliminations"
                isOpen={openPanels.landfall}
                onToggle={() => togglePanel("landfall")}
              >
                <div className="space-y-4 text-sm leading-relaxed text-gray-300">
                  <p className="font-semibold text-green-400">
                    Landfall Successful.
                  </p>

                  <p>
                    Initial assault forces breached Triton&apos;s defensive
                    perimeter under sustained orbital and surface artillery fire.
                    Defensive emplacements were neutralized through coordinated
                    ground and orbital strikes.
                  </p>

                  <p>
                    TASK FORCE DOOM Acclamators are now able to provide sustained
                    orbital support. Triton is no longer a denial zone. A stable
                    planetary foothold has been achieved.
                  </p>

                  <div className="space-y-2 border-t border-red-500/30 pt-4">
                    <p className="font-bold text-yellow-400">
                      ⚔ Engagement Summary
                    </p>

                    <p>
                      Confirmed Enemy Eliminations:
                      <span className="font-bold text-red-500"> 853</span>
                    </p>

                    <p>
                      Friendly Casualties:
                      <span className="font-bold text-yellow-400">
                        {" "}Deaths Currently Being Counted
                      </span>
                    </p>

                    <p className="font-semibold text-green-400">
                      Triton Secured. Orbital dominance achieved.
                    </p>
                  </div>
                </div>
              </ArchivePanel>

              <ArchivePanel
                title="Device Interdiction"
                icon="🔵"
                tone="blue"
                statusLine="STATUS: Operation Successful"
                subStatus="Enemy Logistics Severely Disrupted"
                isOpen={openPanels.device}
                onToggle={() => togglePanel("device")}
              >
                <div className="space-y-6 text-sm text-gray-300">
                  <div className="space-y-4">
                    <p className="font-semibold text-green-400">
                      Operation Successful.
                    </p>

                    <p>
                      Clone Commando reconnaissance successfully tracked multiple
                      enemy device convoys operating across hostile territory.
                      Interdiction teams launched coordinated strikes along the
                      identified supply routes.
                    </p>

                    <p>
                      Escort forces were neutralized and the transport units
                      carrying the devices were destroyed before reaching fortified
                      enemy installations.
                    </p>

                    <p className="font-semibold text-blue-400">
                      Enemy logistical capabilities have been significantly degraded
                      in the sector.
                    </p>
                  </div>

                  <div className="space-y-6 rounded-2xl border border-blue-500/30 bg-black/40 p-4">
                    <h3 className="text-xl font-bold tracking-widest text-blue-400">
                      🛡 DEPLOYED TEAMS
                    </h3>

                    <TeamBlock
                      title="HQ ELEMENT"
                      members={["CO: Bearded", "XO: Sicko"]}
                    />

                    <TeamBlock
                      title="TEAM 1"
                      members={[
                        "Squad Leader: Butter",
                        "Sniper: Sick",
                        "Demolitions: Shy",
                        "Medic: Advisor",
                      ]}
                    />

                    <TeamBlock
                      title="TEAM 2"
                      members={[
                        "Squad Leader: Snake",
                        "Sniper: Wulf",
                        "Demolitions: Blitz",
                        "Medic: Coco",
                      ]}
                    />

                    <TeamBlock
                      title="TEAM 3"
                      members={[
                        "Squad Leader: Akhari",
                        "Sniper: Sour",
                        "Demolitions: Yami",
                        "Medic: Vidar",
                      ]}
                    />

                    <TeamBlock
                      title="TEAM 4"
                      members={[
                        "Sniper: Eclipse",
                        "Demolitions: Griddle",
                        "Medic: Okami",
                      ]}
                    />
                  </div>
                </div>
              </ArchivePanel>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-right">
      <div className="text-[11px] uppercase tracking-[0.22em] text-white/40">
        {label}
      </div>
      <div className="mt-2 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function ArchivePanel({
  title,
  icon,
  tone,
  statusLine,
  subStatus,
  isOpen,
  onToggle,
  children,
}: ArchivePanelProps) {
  const toneClasses =
    tone === "red"
      ? {
          border: "border-red-500/40",
          hover: "hover:bg-red-500/10",
          title: "text-red-400",
          accent: "text-red-300",
          iconBox: "border-red-500/25 bg-red-500/10 text-red-400",
        }
      : tone === "blue"
      ? {
          border: "border-blue-500/40",
          hover: "hover:bg-blue-500/10",
          title: "text-blue-400",
          accent: "text-blue-300",
          iconBox: "border-blue-500/25 bg-blue-500/10 text-blue-400",
        }
      : {
          border: "border-green-500/40",
          hover: "hover:bg-green-500/10",
          title: "text-green-400",
          accent: "text-yellow-400",
          iconBox: "border-green-500/25 bg-green-500/10 text-green-400",
        };

  return (
    <div className={`overflow-hidden rounded-[28px] border bg-black/60 ${toneClasses.border}`}>
      <button
        onClick={onToggle}
        className={`flex w-full items-center justify-between gap-4 p-6 text-left transition ${toneClasses.hover}`}
      >
        <div className="min-w-0">
          <h3 className={`text-xl font-bold ${toneClasses.title}`}>
            {icon} {title}
          </h3>

          <div className="mt-2">
            <div className="text-sm text-green-300">{statusLine}</div>
            <div className={`text-sm font-bold ${toneClasses.accent}`}>
              {subStatus}
            </div>
          </div>
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-xl transition-transform duration-300 ${toneClasses.iconBox} ${
            isOpen ? "rotate-180" : "rotate-0"
          }`}
        >
          ▼
        </div>
      </button>

      <div
        className={`overflow-hidden transition-all duration-500 ${
          isOpen ? "max-h-[3000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-6 pt-0">{children}</div>
      </div>
    </div>
  );
}

function TeamBlock({ title, members }: TeamBlockProps) {
  return (
    <div className="rounded-xl border border-blue-500/30 bg-black/60 p-4">
      <h4 className="mb-3 text-base font-semibold text-blue-300">{title}</h4>

      <ul className="space-y-2 text-sm text-gray-300">
        {members.map((member, index) => (
          <li key={`${title}-${index}`} className="border-l border-blue-500/50 pl-3">
            {member}
          </li>
        ))}
      </ul>
    </div>
  );
}