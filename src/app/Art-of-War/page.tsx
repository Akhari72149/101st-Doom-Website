"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Commander = {
  name: string;
  folder: string;
  images: string[];
};

export default function ArtOfWarPage() {
  const router = useRouter();

  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [animationState, setAnimationState] = useState<
    "idle" | "opening" | "closing"
  >("idle");

  /* ================= FETCH ================= */

  useEffect(() => {
    const fetchArt = async () => {
      try {
        const res = await fetch("/api/art-local");
        const data = await res.json();
        setCommanders(data);
      } catch (err) {
        console.error("Failed loading art data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchArt();
  }, []);

  const activeCommander = commanders.find(
    (c) => c.name === selected
  );

  return (
    <div className="relative min-h-screen text-white font-orbitron">

      {/* Background */}
      <div
        className="absolute inset-0 bg-center bg-cover opacity-20 pointer-events-none"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]" />

      <div className="relative z-10 p-10">

        {/* Back */}
        <button
          onClick={() => router.push("/")}
          className="mb-8 px-6 py-2 border border-[#00ff66] rounded-lg text-[#00ff66]
          hover:bg-[#00ff66] hover:text-black transition-all"
        >
          ← Back to Home
        </button>

        {loading && (
          <div className="text-[#00ff66]">
            Loading Art Folders...
          </div>
        )}

        {/* ================= GRID VIEW ================= */}
        {!selected && !loading && (
          <div
            className={`
              grid grid-cols-1 md:grid-cols-3 gap-6
              transition-all duration-300
              ${
                animationState === "opening"
                  ? "opacity-0 -translate-y-4"
                  : animationState === "closing"
                  ? "opacity-0 translate-y-4"
                  : "opacity-100 translate-y-0"
              }
            `}
          >
            {commanders.map((commander) => {
              const isSelected = selected === commander.name;

              return (
                <div
                  key={commander.folder}
                  onClick={() => {
                    if (animationState !== "idle") return;

                    setAnimationState("opening");

                    setTimeout(() => {
                      setSelected(commander.name);
                      setAnimationState("idle");
                    }, 250);
                  }}
                  className={`
                    group relative cursor-pointer rounded-2xl overflow-hidden
                    border transition-all duration-300
                    bg-black/60
                    ${
                      isSelected
                        ? "border-[#00ff66] scale-105"
                        : "border-[#00ff66]/30 hover:border-[#00ff66] hover:scale-102"
                    }
                  `}
                >
                  {/* Preview Background */}
                  {commander.images[0] && (
                    <img
                      src={commander.images[0]}
                      className="absolute inset-0 w-full h-full object-cover opacity-20
                      group-hover:opacity-40 transition-all duration-300"
                    />
                  )}

                  {/* Content */}
                  <div className="relative p-8 text-center">
                    <div className="text-[#00ff66] text-2xl font-bold">
                      {commander.name}
                    </div>

                    <div className="text-xs text-gray-400 mt-3">
                      {commander.images.length} Files
                    </div>

                    {/* Click Indicator */}
                    <div className="mt-4 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-all">
                      Click to Open
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ================= EXPANDED VIEW ================= */}
        {selected && activeCommander && (
          <div
            className={`
              transition-all duration-300
              ${
                animationState === "opening"
                  ? "opacity-100 translate-y-0"
                  : animationState === "closing"
                  ? "opacity-0 -translate-y-4"
                  : "opacity-100 translate-y-0"
              }
            `}
          >
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-3xl text-[#00ff66]">
                {activeCommander.name}
              </h2>

              <button
                onClick={() => {
                  if (animationState !== "idle") return;

                  setAnimationState("closing");

                  setTimeout(() => {
                    setSelected(null);
                    setAnimationState("idle");
                  }, 250);
                }}
                className="px-6 py-2 border border-red-500 text-red-500 rounded-lg
                hover:bg-red-500 hover:text-black transition-all"
              >
                ← Back to Folders
              </button>
            </div>

            {/* Images */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeCommander.images.map((img) => (
                <div
                  key={img}
                  className="rounded-2xl overflow-hidden border border-[#00ff66]/30 hover:border-[#00ff66] transition-all"
                >
                  <img
                    src={img}
                    alt="Art"
                    className="w-full h-full object-cover transition-transform duration-500 hover:scale-110"
                  />
                </div>
              ))}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}