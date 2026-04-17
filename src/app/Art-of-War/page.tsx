"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Commander = {
  name: string;
  folder: string;
  images: string[];
};

type SortMode = "az" | "za" | "most-files" | "least-files";

export default function ArtOfWarPage() {
  const router = useRouter();

  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("az");
  const [animationState, setAnimationState] = useState<
    "idle" | "opening" | "closing"
  >("idle");

  const animationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchArt = async () => {
      try {
        setError(null);

        const res = await fetch("/api/art-local");

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();
        setCommanders(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed loading art data", err);
        setError("Unable to load archive records right now.");
      } finally {
        setLoading(false);
      }
    };

    fetchArt();

    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  const activeCommander = commanders.find((c) => c.folder === selected);

  const filteredAndSortedCommanders = useMemo(() => {
    const filtered = commanders.filter((commander) =>
      commander.name.toLowerCase().includes(search.toLowerCase())
    );

    const sorted = [...filtered];

    switch (sortMode) {
      case "az":
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "za":
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case "most-files":
        sorted.sort((a, b) => b.images.length - a.images.length);
        break;
      case "least-files":
        sorted.sort((a, b) => a.images.length - b.images.length);
        break;
    }

    return sorted;
  }, [commanders, search, sortMode]);

  const totalFiles = useMemo(() => {
    return commanders.reduce((sum, commander) => sum + commander.images.length, 0);
  }, [commanders]);

  const openCommander = (folder: string) => {
    if (animationState !== "idle") return;

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    setAnimationState("opening");

    animationTimeoutRef.current = setTimeout(() => {
      setSelected(folder);
      setAnimationState("idle");
    }, 250);
  };

  const closeCommander = () => {
    if (animationState !== "idle") return;

    if (animationTimeoutRef.current) {
      clearTimeout(animationTimeoutRef.current);
    }

    setAnimationState("closing");

    animationTimeoutRef.current = setTimeout(() => {
      setSelected(null);
      setAnimationState("idle");
    }, 250);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-black text-white font-orbitron">
      <div
        className="absolute inset-0 bg-center bg-cover opacity-15 pointer-events-none"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000a06_100%)]" />
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(rgba(0,255,102,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,102,0.05)_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="relative z-10 p-6 md:p-10">
        <button
          onClick={() => router.push("/")}
          className="
            mb-6 px-6 py-2 rounded-lg
            border border-[#00ff66]/60
            text-[#00ff66]
            bg-black/40
            hover:bg-[#00ff66]/10
            hover:shadow-[0_0_15px_rgba(0,255,102,0.25)]
            transition-all
          "
        >
          ← Back to Home
        </button>

        {!selected && (
          <>
            <div className="mb-6 rounded-3xl border border-[#00ff66]/25 bg-black/45 backdrop-blur-md shadow-[0_0_35px_rgba(0,255,102,0.08)] overflow-hidden">
              <div className="border-b border-[#00ff66]/15 px-6 py-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="text-xs tracking-[0.35em] text-[#00ff66]/65 uppercase">
                    War Archive System
                  </div>
                  <h1 className="mt-2 text-3xl md:text-5xl font-bold text-[#00ff66]">
                    Art of War
                  </h1>
                  <p className="mt-3 text-sm md:text-base text-gray-400 max-w-3xl">
                    Browse archived commander galleries, campaign visuals, and
                    reference imagery through the 101st visual archive interface.
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 min-w-full lg:min-w-[420px]">
                  <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#00ff66]/55">
                      Folders
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                      {commanders.length}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#00ff66]/55">
                      Files
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                      {totalFiles}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3 col-span-2 md:col-span-1">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#00ff66]/55">
                      Visible
                    </div>
                    <div className="mt-2 text-2xl font-bold text-white">
                      {filteredAndSortedCommanders.length}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 flex flex-col xl:flex-row xl:items-center gap-4">
                <div className="flex-1">
                  <label className="block text-[11px] uppercase tracking-[0.25em] text-[#00ff66]/55 mb-2">
                    Search Archive
                  </label>
                  <input
                    type="text"
                    placeholder="Search commander folders..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="
                      w-full px-4 py-3 rounded-xl
                      border border-[#00ff66]/25
                      bg-black/50
                      text-white
                      placeholder:text-gray-500
                      outline-none
                      focus:border-[#00ff66]/60
                      focus:shadow-[0_0_15px_rgba(0,255,102,0.18)]
                      transition-all
                    "
                  />
                </div>

                <div className="w-full xl:w-[260px]">
                  <label className="block text-[11px] uppercase tracking-[0.25em] text-[#00ff66]/55 mb-2">
                    Sort Records
                  </label>
                  <select
                    value={sortMode}
                    onChange={(e) => setSortMode(e.target.value as SortMode)}
                    className="
                      w-full px-4 py-3 rounded-xl
                      border border-[#00ff66]/25
                      bg-black/50
                      text-white
                      outline-none
                      focus:border-[#00ff66]/60
                      transition-all
                    "
                  >
                    <option value="az">Name A–Z</option>
                    <option value="za">Name Z–A</option>
                    <option value="most-files">Most Files</option>
                    <option value="least-files">Least Files</option>
                  </select>
                </div>
              </div>
            </div>

            {loading && (
              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-6 py-8 text-[#00ff66]">
                Loading archive records...
              </div>
            )}

            {error && !loading && (
              <div className="rounded-2xl border border-red-500/40 bg-red-950/25 px-6 py-8 text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && filteredAndSortedCommanders.length === 0 && (
              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-6 py-10 text-center">
                <div className="text-xl text-[#00ff66]">No archive matches found</div>
                <div className="mt-2 text-sm text-gray-400">
                  Try changing the search term or sort mode.
                </div>
              </div>
            )}

            {!loading && !error && filteredAndSortedCommanders.length > 0 && (
              <div
                className={`
                  grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6
                  transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
                  ${
                    animationState === "opening"
                      ? "opacity-0 -translate-y-4 scale-[0.99]"
                      : animationState === "closing"
                      ? "opacity-0 translate-y-4 scale-[0.99]"
                      : "opacity-100 translate-y-0 scale-100"
                  }
                `}
              >
                {filteredAndSortedCommanders.map((commander) => (
                  <button
                    key={commander.folder}
                    type="button"
                    onClick={() => openCommander(commander.folder)}
                    className="
                      group relative text-left rounded-3xl overflow-hidden
                      border border-[#00ff66]/25
                      bg-black/60
                      hover:border-[#00ff66]/70
                      hover:scale-[1.02]
                      hover:shadow-[0_0_40px_rgba(0,255,102,0.18)]
                      transition-all duration-300
                      focus:outline-none focus:ring-2 focus:ring-[#00ff66]/50
                    "
                  >
                    <div className="relative aspect-[5/4]">
                      {commander.images[0] ? (
                        <Image
                          src={commander.images[0]}
                          alt={`${commander.name} preview`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                          className="object-cover opacity-30 group-hover:opacity-45 transition-all duration-300"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-black/50" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-transparent" />

                      <div className="absolute top-0 left-0 right-0 px-5 py-3 border-b border-[#00ff66]/15 bg-black/55 backdrop-blur-sm">
                        <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ff66]/65">
                          Commander Archive
                        </div>
                      </div>

                      <div className="absolute top-4 right-4 rounded-full border border-[#00ff66]/25 bg-black/60 px-3 py-1 text-xs text-[#00ff66]">
                        {commander.images.length} files
                      </div>

                      <div className="absolute inset-x-0 bottom-0 p-6">
                        <div className="text-2xl md:text-3xl font-bold text-[#00ff66]">
                          {commander.name}
                        </div>

                        <div className="mt-2 text-xs uppercase tracking-[0.25em] text-gray-400">
                          /archive/{commander.folder}
                        </div>

                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            Visual records indexed
                          </span>
                          <span className="text-xs text-[#00ff66]/75 opacity-0 group-hover:opacity-100 transition-all">
                            Open Folder →
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {selected && activeCommander && (
          <div
            className={`
              transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
              ${
                animationState === "opening"
                  ? "opacity-100 translate-y-0"
                  : animationState === "closing"
                  ? "opacity-0 -translate-y-4"
                  : "opacity-100 translate-y-0"
              }
            `}
          >
            <div className="sticky top-0 z-20 mb-6 rounded-3xl border border-[#00ff66]/20 bg-black/75 backdrop-blur-md shadow-[0_0_25px_rgba(0,255,102,0.08)] overflow-hidden">
              <div className="px-6 py-5 border-b border-[#00ff66]/15 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.3em] text-[#00ff66]/60">
                    Archive Folder
                  </div>
                  <h2 className="mt-2 text-3xl md:text-4xl font-bold text-[#00ff66]">
                    {activeCommander.name}
                  </h2>
                  <div className="mt-2 text-sm text-gray-400">
                    /archive/{activeCommander.folder}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-4 py-3 min-w-[130px]">
                    <div className="text-[10px] uppercase tracking-[0.25em] text-[#00ff66]/55">
                      Files
                    </div>
                    <div className="mt-2 text-xl font-bold text-white">
                      {activeCommander.images.length}
                    </div>
                  </div>

                  <button
                    onClick={closeCommander}
                    className="
                      px-6 py-3 rounded-xl
                      border border-red-500/60
                      text-red-400
                      bg-black/40
                      hover:bg-red-500/10
                      hover:shadow-[0_0_15px_rgba(239,68,68,0.2)]
                      transition-all
                    "
                  >
                    ← Back to Folders
                  </button>
                </div>
              </div>
            </div>

            {activeCommander.images.length === 0 ? (
              <div className="rounded-2xl border border-[#00ff66]/20 bg-black/40 px-6 py-8 text-gray-400">
                No artwork found in this archive folder.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
                {activeCommander.images.map((img, index) => (
                  <div
                    key={`${img}-${index}`}
                    className="
                      group relative rounded-3xl overflow-hidden
                      border border-[#00ff66]/25
                      bg-black/50
                      hover:border-[#00ff66]/65
                      hover:shadow-[0_0_30px_rgba(0,255,102,0.14)]
                      transition-all
                    "
                  >
                    <div className="relative aspect-[4/3]">
                      <Image
                        src={img}
                        alt={`${activeCommander.name} artwork ${index + 1}`}
                        fill
                        sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                      <div className="absolute top-4 left-4 rounded-full border border-[#00ff66]/25 bg-black/60 px-3 py-1 text-xs text-[#00ff66]">
                        File {index + 1}
                      </div>

                      <div className="absolute bottom-0 left-0 right-0 px-5 py-4">
                        <div className="text-sm font-semibold text-[#00ff66]">
                          {activeCommander.name}
                        </div>
                        <div className="mt-1 text-xs text-gray-400 break-all">
                          {img}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}