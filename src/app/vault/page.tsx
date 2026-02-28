"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export default function VaultPage() {
  const router = useRouter();

  /* ================= STATE ================= */

  const [password, setPassword] = useState("");
  const [stage, setStage] = useState<
    "locked" | "scanning" | "terminal" | "unlocked"
  >("locked");

  const [logs, setLogs] = useState<string[]>([]);
  const [sideOpOpen, setSideOpOpen] = useState(false);

  const VAULT_CODE = "OMEGA";

  const terminalRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [landfallArchiveOpen, setLandfallArchiveOpen] = useState(false);

  /* ========================================================= */
  /* ================= PASSWORD / HACK LOGIC ================== */
  /* ========================================================= */

  const handleUnlock = () => {
    const reversed = VAULT_CODE.split("").reverse().join("");

    // 🔥 Hidden Backdoor
    if (password === reversed) {
      alert("🕶 BACKDOOR DETECTED...");
      setStage("scanning");

      setTimeout(() => {
        setStage("terminal");
        setLogs((prev) => [
          ...prev,
          "Backdoor access route exploited.",
          "Unauthorized admin privileges granted.",
          "Secret archive unlocked..."
        ]);
      }, 1200);

      return;
    }

    // ❌ Wrong password
    if (password !== VAULT_CODE) {
      alert("ACCESS DENIED");
      setPassword("");
      return;
    }

    // ✅ Correct password
    setStage("scanning");

    setTimeout(() => {
      setStage("terminal");
    }, 1500);
  };

  /* ========================================================= */
  /* ================= TERMINAL ANIMATION ==================== */
  /* ========================================================= */

  useEffect(() => {
    if (stage !== "terminal") return;

    const messages = [
      "Initializing access sequence...",
      "Bypassing firewall...",
      "Decrypting archive headers...",
      "Scanning security layers...",
      "Injecting authentication token...",
      "Access key verified.",
      "Reconstructing classified data...",
      "fkin cwos"
    ];

    let index = 0;

    const interval = setInterval(() => {
      if (index >= messages.length) {
        clearInterval(interval);

        setTimeout(() => {
          setStage("unlocked");
        }, 1000);

        return;
      }

      setLogs((prev) => [
        ...prev,
        `[${Math.random().toString(36).substring(2, 6)}] ${messages[index]}`
      ]);

      index++;
    }, 200);

    return () => clearInterval(interval);
  }, [stage]);

  /* Auto Scroll Terminal */
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop =
        terminalRef.current.scrollHeight;
    }
  }, [logs]);

  /* ========================================================= */
  /* ================= MATRIX BACKGROUND ====================== */
  /* ========================================================= */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const letters = "01".split("");
    const fontSize = 16;
    const columns = canvas.width / fontSize;

    const drops: number[] = [];

    for (let i = 0; i < columns; i++) {
      drops[i] = 1;
    }

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#00ff88";
      ctx.font = fontSize + "px monospace";

      for (let i = 0; i < drops.length; i++) {
        const text =
          letters[Math.floor(Math.random() * letters.length)];

        ctx.fillText(text, i * fontSize, drops[i] * fontSize);

        if (
          drops[i] * fontSize > canvas.height &&
          Math.random() > 0.97
        ) {
          drops[i] = 0;
        }

        drops[i]++;
      }
    };

    const interval = setInterval(draw, 40);

    return () => clearInterval(interval);
  }, []);

  /* ========================================================= */
  /* ================= RENDER ================================ */
  /* ========================================================= */

  return (
    <div className="relative min-h-screen bg-black text-white p-10 font-mono overflow-hidden">

      {/* MATRIX */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
      />

      <div className="relative z-10">

        {/* BACK BUTTON */}
        <button
          onClick={() => router.push("/")}
          className="mb-6 px-4 py-2 border border-purple-500 text-purple-400 hover:bg-purple-500/20 transition"
        >
          ← Return to Command
        </button>

        <h1 className="text-4xl text-green-400 font-bold mb-8 tracking-widest">
          📁 REPUBLIC WAR ARCHIVE
        </h1>

        {/* ================= LOCKED ================= */}
        {stage === "locked" && (
          <div className="border border-green-500/40 bg-black/70 rounded-3xl p-10 max-w-md">

            <h2 className="text-2xl mb-4 text-green-400">
              🔐 Classified Access Required
            </h2>

            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter Vault Code"
              className="w-full p-3 bg-black border border-green-500 text-white rounded mb-4"
            />

            <button
              onClick={handleUnlock}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 transition rounded font-bold"
            >
              Initiate Access
            </button>
          </div>
        )}

        {/* ================= SCANNING ================= */}
        {stage === "scanning" && (
          <div className="border border-green-500 bg-black/80 rounded-3xl p-10">
            <p className="text-green-400 text-xl animate-pulse">
              SYSTEM SCANNING...
            </p>
          </div>
        )}

        {/* ================= TERMINAL ================= */}
        {stage === "terminal" && (
          <div
            ref={terminalRef}
            className="border border-green-500/50 bg-black/90 rounded-3xl p-6 h-[400px] overflow-y-auto shadow-[0_0_30px_rgba(0,255,100,0.4)]"
          >
            {logs.map((log, i) => (
              <p key={i} className="text-green-400 mb-2">
                &gt; {log}
              </p>
            ))}
          </div>
        )}

        {/* ================= UNLOCKED ================= */}
        {stage === "unlocked" && (
          <div className="space-y-8">

            {/* MAIN OPERATION CARD */}
            <div className="border border-green-500/40 bg-black/70 rounded-3xl p-8 shadow-[0_0_50px_rgba(0,255,100,0.4)]">

              <h2 className="text-2xl text-green-400 mb-6">
                ✅ ACCESS GRANTED
              </h2>

              <h3 className="text-xl font-bold">
                Doom Batalion Battle Logs
              </h3>

              <span className="inline-block mt-2 px-3 py-1 rounded bg-yellow-500/20 text-yellow-400 text-sm border border-yellow-500/40">
                Commander Level Clearence
              </span>

            </div>

            {/* ================= SIDE OP ARCHIVE ================= */}

            <div className="border border-green-500/40 bg-black/60 rounded-3xl overflow-hidden">

              <button
                onClick={() => setSideOpOpen(!sideOpOpen)}
                className="w-full flex justify-between items-center p-6 hover:bg-green-500/10 transition"
              >
                <div className="text-left">
                  <h3 className="text-xl text-green-400 font-bold">
                    🛑 GC Side Operation Archive
                  </h3>

                  <div>
                    <span className="text-sm text-red-400">
                      📅 Operation Concluded
                    </span>

                    <div className="text-sm text-red-500 font-bold">
                      STATUS: Operation Over - B3 ARF are in extreme danger
                    </div>
                  </div>
                </div>

                <span className="text-green-400 text-xl">
                  {sideOpOpen ? "▲" : "▼"}
                </span>
              </button>

              <div
                className={`transition-all duration-500 overflow-hidden ${
                  sideOpOpen
                    ? "max-h-[2000px] opacity-100 p-6"
                    : "max-h-0 opacity-0"
                }`}
              >

                <div className="space-y-4 text-sm text-gray-300">

                  <p className="text-red-400 font-semibold">
                    The side operation has concluded. Heavy casualties sustained.
                  </p>

                  <p>
                    The platoon was compromised behind enemy lines.
                    Extraction attempts failed for most personnel.
                  </p>

                  <p className="text-yellow-400">
                    Survivors successfully returned to friendly territory.
                  </p>

                  <div className="border-t border-green-500/20 pt-4">

                    <p className="text-green-400 font-semibold">
                      Team One — Longbow Omegon
                    </p>

                    <ul className="ml-4 space-y-1">
                      <li className="line-through text-red-500">
                        Team Lead: Akhari — KIA
                      </li>
                      <li className="text-green-400 font-semibold">
                        Sniper: Sick — SURVIVED
                      </li>
                      <li className="text-green-400 font-semibold">
                        Spotter: Toxic — SURVIVED
                      </li>
                      <li className="text-green-400 font-semibold">
                        Medic: Advisor — SURVIVED
                      </li>
                      <li className="line-through text-red-500">
                        Assault: Sour — KIA
                      </li>
                      <li className="text-green-400 font-semibold">
                        Assault: Yami — SURVIVED
                      </li>
                    </ul>

                    <p className="text-green-400 font-semibold mt-6">
                      Team Two — Longbow Epsilon
                    </p>

                    <ul className="ml-4 space-y-1">
                      <li className="text-yellow-400 font-semibold">
                        Team Lead: Shy — POW
                      </li>
                      <li className="line-through text-red-500">
                        Sniper: Wulf — KIA
                      </li>
                      <li className="line-through text-red-500">
                        Spotter: Joker — KIA
                      </li>
                      <li className="text-yellow-400 font-semibold">
                        Medic: Warden — POW
                      </li>
                      <li className="line-through text-red-500">
                        Assault: York — KIA
                      </li>
                      <li className="line-through text-red-500">
                        Assault: Blitz — KIA
                      </li>
                    </ul>

                    

                  </div>
                </div>
              </div>
            </div>
{/* ================= C2 LANDFALL ARCHIVE ================= */}

<div className="border border-red-500/40 bg-black/60 rounded-3xl overflow-hidden">

  {/* HEADER */}
  <button
    onClick={() => setLandfallArchiveOpen(!landfallArchiveOpen)}
    className="w-full flex justify-between items-center p-6 hover:bg-red-500/10 transition"
  >
    <div className="text-left">
      <h3 className="text-xl text-red-500 font-bold">
        🚀 C2 LANDFALL — TRITON
      </h3>

      <div>
        <span className="text-sm text-green-400">
          STATUS: Foothold Established
        </span>

        <div className="text-sm text-yellow-400 font-bold">
          853 Confirmed Eliminations
        </div>
      </div>
    </div>

    <span className="text-red-500 text-xl">
      {landfallArchiveOpen ? "▲" : "▼"}
    </span>
  </button>

  {/* COLLAPSIBLE CONTENT */}
  <div
    className={`transition-all duration-500 overflow-hidden ${
      landfallArchiveOpen
        ? "max-h-[2000px] opacity-100 p-6"
        : "max-h-0 opacity-0"
    }`}
  >
    <div className="space-y-4 text-sm text-gray-300 leading-relaxed">

      <p className="text-green-400 font-semibold">
        Landfall Successful.
      </p>

      <p>
        Initial assault forces breached Triton's defensive perimeter
        under sustained orbital and surface artillery fire.
        Defensive emplacements were neutralized through coordinated
        ground and orbital strikes.
      </p>

      <p>
        TASK FORCE DOOM Acclamators are now able to provide sustained
        orbital support. Triton is no longer a denial zone.
        A stable planetary foothold has been achieved.
      </p>

      <div className="border-t border-red-500/30 pt-4 space-y-2">

        <p className="text-yellow-400 font-bold">
          ⚔ Engagement Summary
        </p>

        <p>
          Confirmed Enemy Eliminations:
          <span className="text-red-500 font-bold"> 853</span>
        </p>

        <p>
          Friendly Casualties:
          <span className="text-yellow-400 font-bold">
            {" "}Deaths Currently Being Counted
          </span>
        </p>

        <p className="text-green-400 font-semibold">
          Triton Secured. Orbital dominance achieved.
        </p>

      </div>
    </div>
  </div>
</div>
          </div>
        )}



      </div>
    </div>
  );
}