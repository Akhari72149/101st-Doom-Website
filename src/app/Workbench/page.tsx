"use client";

import { useEffect } from "react";
import { animate, svg, stagger } from "animejs";

export default function AIInterface() {
  useEffect(() => {
    const sphereShell = document.getElementById("sphere-shell");
    if (sphereShell) {
      animate(sphereShell, {
        translateY: ["0px", "-6px", "0px"],
        easing: "easeInOutSine",
        duration: 4200,
        loop: true,
      });
    }

    const sphere = document.getElementById("ai-sphere");
    if (sphere) {
      animate(sphere, {
        rotate: ["0deg", "360deg"],
        easing: "linear",
        duration: 32000,
        loop: true,
      });

      const rings = Array.from(document.getElementsByClassName("ai-ring")) as HTMLDivElement[];
      rings.forEach((ring, idx) => {
        animate(ring, {
          rotate:
            idx === 0
              ? ["0deg", "360deg"]
              : idx === 1
              ? ["0deg", "-260deg"]
              : ["0deg", "180deg"],
          easing: "linear",
          duration: idx === 0 ? 18000 : idx === 1 ? 24000 : 30000,
          loop: true,
        });
      });
    }

    const coreGlow = document.getElementById("core-glow");
    const coreInnerGlow = document.getElementById("core-inner-glow");
    const coreHighlight = document.getElementById("core-highlight");

    if (coreGlow) {
      animate(coreGlow, {
        r: [10, 12.5, 10],
        opacity: [0.08, 0.16, 0.08],
        easing: "easeInOutSine",
        duration: 2600,
        loop: true,
      });
    }

    if (coreInnerGlow) {
      animate(coreInnerGlow, {
        r: [5.8, 7.2, 5.8],
        opacity: [0.12, 0.24, 0.12],
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
      const drawables = paths.map((p) => svg.createDrawable(p));
      animate(drawables, {
        draw: ["0 0", "0 1", "1 1"],
        easing: "easeInOutQuad",
        duration: 2600,
        delay: stagger(55),
        loop: true,
      });
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
  }, []);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#020508] font-mono text-[#00ff66]">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.06)_0%,rgba(0,102,255,0.08)_28%,rgba(0,0,0,0)_62%)]" />
      <div className="pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(rgba(0,255,102,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.03)_1px,transparent_1px)] bg-[size:44px_44px] opacity-30" />

      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6 py-12">
        <div className="mb-4 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.45em] text-[#2f6fff]">
            Neural Circuit Matrix // Online
          </p>
        </div>

        <div id="sphere-shell" className="relative mb-10 h-80 w-80">
          <div className="pointer-events-none absolute -inset-6 rounded-full border border-[#2f6fff]/20" />
          <div className="pointer-events-none absolute -inset-10 rounded-full border border-[#00ff66]/10" />

          <div
            id="ai-sphere"
            className="absolute inset-0 flex items-center justify-center rounded-full border-4 border-[#00ff66]/80 bg-[radial-gradient(circle_at_50%_42%,rgba(47,111,255,0.16),rgba(0,255,102,0.05)_35%,rgba(0,0,0,0.85)_78%)] shadow-[0_0_30px_rgba(0,255,102,0.35),0_0_70px_rgba(47,111,255,0.18),inset_0_0_40px_rgba(0,255,102,0.07)]"
          >
            <div className="pointer-events-none absolute inset-[9px] rounded-full border border-[#2f6fff]/20 shadow-[inset_0_0_30px_rgba(47,111,255,0.12)]" />
            <div className="pointer-events-none absolute inset-10 rounded-full bg-[#00ff66]/5 blur-2xl" />
            <div className="pointer-events-none absolute left-[22%] top-[14%] h-16 w-24 rotate-[-18deg] rounded-full bg-[#d9ecff]/10 blur-xl" />
            <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_50%_50%,transparent_52%,rgba(0,0,0,0.28)_82%,rgba(0,0,0,0.52)_100%)]" />

            <svg
              id="ai-circuits"
              className="h-72 w-72"
              viewBox="0 0 100 100"
              fill="none"
            >
              <defs>
                <clipPath id="sphereClip">
                  <circle cx="50" cy="50" r="47" />
                </clipPath>
              </defs>

              <g clipPath="url(#sphereClip)">
                {/* board shells */}
                <circle cx="50" cy="50" r="46" stroke="#00ff66" strokeOpacity="0.14" strokeWidth="0.45" />
                <circle cx="50" cy="50" r="42" stroke="#2f6fff" strokeOpacity="0.16" strokeWidth="0.35" />
                <circle cx="50" cy="50" r="39" stroke="#00ff66" strokeOpacity="0.08" strokeWidth="0.3" />

                {/* etched board rings */}
                <circle cx="50" cy="50" r="31" stroke="#2f6fff" strokeOpacity="0.12" strokeWidth="0.25" strokeDasharray="1.5 2.2" />
                <circle cx="50" cy="50" r="25" stroke="#00ff66" strokeOpacity="0.1" strokeWidth="0.25" strokeDasharray="2 2.5" />

                {/* core glow */}
                <circle id="core-glow" cx="50" cy="50" r="10" fill="#00ff66" opacity="0.08" />
                <circle id="core-inner-glow" cx="50" cy="50" r="6" fill="#2f6fff" opacity="0.14" />
                <circle id="core-highlight" cx="47.2" cy="46.8" r="2.1" fill="#d9ecff" opacity="0.3" />

                {/* central processor */}
                <rect
                  x="41"
                  y="41"
                  width="18"
                  height="18"
                  rx="1.5"
                  stroke="#00ff66"
                  strokeWidth="1"
                  fill="rgba(0,255,102,0.05)"
                />
                <rect
                  x="44"
                  y="44"
                  width="12"
                  height="12"
                  rx="1"
                  stroke="#2f6fff"
                  strokeWidth="0.7"
                  fill="rgba(47,111,255,0.08)"
                />

                {/* core detail traces */}
                <path className="core-line" d="M46 46 L50 46 L50 50" stroke="#d9ecff" strokeWidth="0.45" />
                <path className="core-line" d="M54 46 L50 46" stroke="#00ff66" strokeWidth="0.45" />
                <path className="core-line" d="M46 54 L50 54 L50 50" stroke="#2f6fff" strokeWidth="0.45" />
                <path className="core-line" d="M54 54 L50 54" stroke="#00ff66" strokeWidth="0.45" />
                <path className="core-line" d="M47 47 L53 47" stroke="#2f6fff" strokeWidth="0.35" />
                <path className="core-line" d="M47 53 L53 53" stroke="#d9ecff" strokeWidth="0.35" />
                <path className="core-line" d="M47 47 L47 53" stroke="#00ff66" strokeWidth="0.35" />
                <path className="core-line" d="M53 47 L53 53" stroke="#2f6fff" strokeWidth="0.35" />

                <text
                  x="50"
                  y="51.3"
                  textAnchor="middle"
                  fontSize="2.2"
                  fill="#d9ecff"
                  opacity="0.85"
                  letterSpacing="0.45"
                >
                  CORE
                </text>

                {/* cpu pins */}
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
                    stroke={i % 3 === 0 ? "#2f6fff" : "#00ff66"}
                    strokeWidth="0.7"
                  />
                ))}

                {/* side components / chips */}
                <rect x="18" y="23" width="10" height="6" rx="0.8" stroke="#00ff66" strokeWidth="0.7" fill="rgba(0,255,102,0.04)" />
                <rect x="70" y="25" width="11" height="7" rx="0.8" stroke="#2f6fff" strokeWidth="0.7" fill="rgba(47,111,255,0.05)" />
                <rect x="72" y="60" width="10" height="8" rx="0.8" stroke="#00ff66" strokeWidth="0.7" fill="rgba(0,255,102,0.04)" />
                <rect x="19" y="66" width="12" height="7" rx="0.8" stroke="#2f6fff" strokeWidth="0.7" fill="rgba(47,111,255,0.05)" />

                {/* capacitors / modules */}
                <rect x="30" y="15" width="3" height="9" rx="0.5" stroke="#00ff66" strokeWidth="0.6" />
                <rect x="34" y="15" width="3" height="9" rx="0.5" stroke="#2f6fff" strokeWidth="0.6" />
                <rect x="67" y="74" width="3" height="8" rx="0.5" stroke="#00ff66" strokeWidth="0.6" />
                <rect x="71" y="74" width="3" height="8" rx="0.5" stroke="#2f6fff" strokeWidth="0.6" />

                {/* labels / circuit intelligence */}
                <text x="20" y="21" fontSize="1.9" fill="#d9ecff" opacity="0.72" letterSpacing="0.3">
                  I/O
                </text>
                <text x="70" y="23" fontSize="1.9" fill="#d9ecff" opacity="0.72" letterSpacing="0.3">
                  BUS
                </text>
                <text x="73" y="58" fontSize="1.9" fill="#d9ecff" opacity="0.72" letterSpacing="0.3">
                  MEM
                </text>
                <text x="20" y="64" fontSize="1.9" fill="#d9ecff" opacity="0.72" letterSpacing="0.3">
                  PWR
                </text>

                {/* terminals / pads */}
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
                      stroke={i % 2 === 0 ? "#00ff66" : "#2f6fff"}
                      strokeWidth="0.6"
                      fill={i % 2 === 0 ? "rgba(0,255,102,0.08)" : "rgba(47,111,255,0.09)"}
                    />
                    <circle
                      cx={cx}
                      cy={cy}
                      r="0.5"
                      fill={i % 3 === 0 ? "#d9ecff" : i % 2 === 0 ? "#00ff66" : "#2f6fff"}
                      className="pulse"
                    />
                  </g>
                ))}

                {/* vias */}
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
                    stroke={i % 2 === 0 ? "#00ff66" : "#2f6fff"}
                    strokeWidth="0.45"
                    fill="rgba(217,236,255,0.03)"
                  />
                ))}

                {/* main PCB traces */}
                <path className="line" d="M50 41 L50 26 L42 26 L42 18 L33 18" stroke="#2f6fff" strokeWidth="0.9" />
                <path className="line" d="M46 41 L46 32 L34 32 L34 24 L24 24 L24 20 L14 20" stroke="#00ff66" strokeWidth="0.75" />
                <path className="line" d="M54 41 L54 30 L66 30 L66 22 L80 22 L80 15" stroke="#2f6fff" strokeWidth="0.75" />
                <path className="line" d="M59 46 L70 46 L70 39 L82 39 L82 29 L88 29" stroke="#00ff66" strokeWidth="0.8" />
                <path className="line" d="M59 53 L69 53 L69 61 L78 61 L78 67 L86 67" stroke="#2f6fff" strokeWidth="0.8" />
                <path className="line" d="M54 59 L54 72 L61 72 L61 79 L67 79 L67 89" stroke="#00ff66" strokeWidth="0.75" />
                <path className="line" d="M46 59 L46 70 L37 70 L37 78 L33 78 L33 90" stroke="#2f6fff" strokeWidth="0.75" />
                <path className="line" d="M41 54 L29 54 L29 60 L21 60 L21 66 L14 66" stroke="#00ff66" strokeWidth="0.8" />
                <path className="line" d="M41 47 L31 47 L31 41 L20 41 L20 35 L11 35" stroke="#2f6fff" strokeWidth="0.8" />
                <path className="line" d="M50 59 L50 78 L50 92" stroke="#d9ecff" strokeWidth="0.85" />
                <path className="line" d="M50 41 L50 18 L50 8" stroke="#d9ecff" strokeWidth="0.85" />
                <path className="line" d="M41 50 L22 50 L12 50" stroke="#00ff66" strokeWidth="0.9" />
                <path className="line" d="M59 50 L79 50 L89 48" stroke="#2f6fff" strokeWidth="0.9" />

                {/* extra detail traces */}
                <path className="line" d="M28 26 L28 30 L24 30" stroke="#00ff66" strokeWidth="0.55" />
                <path className="line" d="M28 68 L28 74 L25 74" stroke="#2f6fff" strokeWidth="0.55" />
                <path className="line" d="M72 27 L72 25 L74 25 L74 19 L76 19" stroke="#d9ecff" strokeWidth="0.55" />
                <path className="line" d="M76 73 L76 79 L72 79" stroke="#00ff66" strokeWidth="0.55" />
                <path className="line" d="M37 19 L42 19 L42 14 L50 14" stroke="#2f6fff" strokeWidth="0.5" />
                <path className="line" d="M63 18 L68 18 L68 11" stroke="#00ff66" strokeWidth="0.5" />
                <path className="line" d="M36 82 L42 82 L42 87 L50 87" stroke="#2f6fff" strokeWidth="0.5" />
                <path className="line" d="M59 84 L64 84 L64 79" stroke="#00ff66" strokeWidth="0.5" />

                {/* circular board details */}
                <circle cx="24" cy="30" r="3.2" stroke="#00ff66" strokeWidth="0.55" strokeOpacity="0.7" />
                <circle cx="24" cy="30" r="1" fill="#2f6fff" fillOpacity="0.6" />
                <circle cx="76" cy="73" r="3.2" stroke="#2f6fff" strokeWidth="0.55" strokeOpacity="0.7" />
                <circle cx="76" cy="73" r="1" fill="#00ff66" fillOpacity="0.5" />
                <circle cx="74" cy="25" r="2.8" stroke="#d9ecff" strokeWidth="0.5" strokeOpacity="0.6" />
                <circle cx="25" cy="74" r="2.8" stroke="#2f6fff" strokeWidth="0.5" strokeOpacity="0.6" />
              </g>

              <g id="pulse-layer" />
            </svg>
          </div>

          <div className="ai-ring absolute inset-0 rounded-full border border-[#00ff66]/25 shadow-[0_0_20px_rgba(0,255,102,0.12)]" />
          <div className="ai-ring absolute inset-2 rounded-full border border-[#2f6fff]/30 shadow-[0_0_22px_rgba(47,111,255,0.14)]" />
          <div className="ai-ring absolute inset-4 rounded-full border border-[#d9ecff]/10" />
        </div>

        <div className="relative w-full max-w-3xl border border-[#00ff66]/20 bg-black/35 px-6 py-6 shadow-[0_0_30px_rgba(0,255,102,0.08)] backdrop-blur-sm">
          <div className="pointer-events-none absolute left-0 top-0 h-4 w-4 border-l border-t border-[#2f6fff]/70" />
          <div className="pointer-events-none absolute right-0 top-0 h-4 w-4 border-r border-t border-[#00ff66]/70" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-4 w-4 border-b border-l border-[#00ff66]/70" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-4 w-4 border-b border-r border-[#2f6fff]/70" />

          <div className="mb-4 flex items-center justify-between gap-4 border-b border-[#00ff66]/10 pb-3 text-[10px] uppercase tracking-[0.3em] text-[#d9ecff]/70">
            <span>Processor Mesh</span>
            <span>Signal Integrity 99.2%</span>
          </div>

          <h1 className="mb-3 text-center text-5xl font-bold uppercase tracking-[0.35em] text-[#e8fff2] drop-shadow-[0_0_10px_rgba(0,255,102,0.28)] md:text-6xl">
            AI CORE
          </h1>

          <p className="mx-auto mb-6 max-w-2xl text-center text-sm leading-7 text-[#b7ffd4]/70 md:text-base">
            Dense circuit-board intelligence architecture with active data pathways, processor routing,
            bus modules, and live signal monitoring across a stabilized neural core.
          </p>

          <div className="mb-6 grid grid-cols-1 gap-3 text-[11px] uppercase tracking-[0.22em] text-[#d9ecff]/80 md:grid-cols-3">
            <div className="border border-[#2f6fff]/20 bg-[#07111f]/50 px-4 py-3">
              <div className="mb-2 text-[#2f6fff]">Bus Load</div>
              <div className="data-bar h-[2px] w-full origin-left bg-[#2f6fff]/80" />
            </div>
            <div className="border border-[#00ff66]/20 bg-[#04120b]/50 px-4 py-3">
              <div className="mb-2 text-[#00ff66]">Core Flux</div>
              <div className="data-bar h-[2px] w-full origin-left bg-[#00ff66]/80" />
            </div>
            <div className="border border-[#d9ecff]/15 bg-[#0b1016]/50 px-4 py-3">
              <div className="mb-2 text-[#d9ecff]">Memory Sync</div>
              <div className="data-bar h-[2px] w-full origin-left bg-[#d9ecff]/75" />
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={() => alert("AI Sphere Activated!")}
              className="group relative overflow-hidden border border-[#00ff66]/70 bg-black px-10 py-4 text-sm font-bold uppercase tracking-[0.35em] text-[#00ff66] transition-all duration-200 hover:border-[#2f6fff] hover:text-[#d9ecff] hover:shadow-[0_0_24px_rgba(47,111,255,0.2)]"
            >
              <span className="absolute inset-y-0 left-0 w-10 bg-[linear-gradient(90deg,rgba(47,111,255,0.22),transparent)] opacity-70 transition-all duration-300 group-hover:left-full group-hover:w-16" />
              <span className="relative z-10">ENGAGE CORE</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}