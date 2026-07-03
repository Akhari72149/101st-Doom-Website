"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  Grid3X3,
  ImageIcon,
  Search,
  X,
} from "lucide-react";

type Commander = {
  name: string;
  folder: string;
  images: string[];
};

type GalleryItem = {
  src: string;
  commanderName: string;
  folder: string;
  fileName: string;
  folderIndex: number;
  globalIndex: number;
};

type SortMode = "az" | "za" | "newest" | "folder";

const sortLabels: Record<SortMode, string> = {
  az: "Name A-Z",
  za: "Name Z-A",
  newest: "Newest First",
  folder: "Folder Order",
};

function getFileName(src: string) {
  return decodeURIComponent(src.split("/").pop() || src);
}

export default function ArtOfWarPage() {
  const router = useRouter();

  const [commanders, setCommanders] = useState<Commander[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeFolder, setActiveFolder] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("folder");
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  useEffect(() => {
    let active = true;

    async function fetchArt() {
      try {
        setError(null);

        const res = await fetch("/api/art-local");

        if (!res.ok) {
          throw new Error(`Request failed with status ${res.status}`);
        }

        const data = await res.json();

        if (active) {
          setCommanders(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.error("Failed loading art data", err);

        if (active) {
          setError("Unable to load archive records right now.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    fetchArt();

    return () => {
      active = false;
    };
  }, []);

  const allItems = useMemo<GalleryItem[]>(() => {
    return commanders.flatMap((commander) =>
      commander.images.map((src, index) => ({
        src,
        commanderName: commander.name,
        folder: commander.folder,
        fileName: getFileName(src),
        folderIndex: index,
        globalIndex: 0,
      })),
    ).map((item, index) => ({
      ...item,
      globalIndex: index,
    }));
  }, [commanders]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = allItems.filter((item) => {
      const matchesFolder = activeFolder === "all" || item.folder === activeFolder;
      const haystack = `${item.commanderName} ${item.folder} ${item.fileName}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);

      return matchesFolder && matchesSearch;
    });

    const sorted = [...filtered];

    switch (sortMode) {
      case "az":
        sorted.sort((a, b) => a.fileName.localeCompare(b.fileName));
        break;
      case "za":
        sorted.sort((a, b) => b.fileName.localeCompare(a.fileName));
        break;
      case "newest":
        sorted.sort((a, b) => b.globalIndex - a.globalIndex);
        break;
      case "folder":
        sorted.sort((a, b) => {
          const folderCompare = a.commanderName.localeCompare(b.commanderName);
          return folderCompare || a.folderIndex - b.folderIndex;
        });
        break;
    }

    return sorted;
  }, [activeFolder, allItems, search, sortMode]);

  const activeViewerItem =
    viewerIndex === null ? null : filteredItems[viewerIndex] || null;

  const totalFiles = allItems.length;
  const activeFolderName =
    activeFolder === "all"
      ? "All Archives"
      : commanders.find((commander) => commander.folder === activeFolder)?.name ||
        activeFolder;

  const openViewer = (index: number) => {
    setViewerIndex(index);
  };

  const closeViewer = useCallback(() => {
    setViewerIndex(null);
  }, []);

  const showPrevious = useCallback(() => {
    setViewerIndex((current) => {
      if (current === null || filteredItems.length === 0) return current;
      return (current - 1 + filteredItems.length) % filteredItems.length;
    });
  }, [filteredItems.length]);

  const showNext = useCallback(() => {
    setViewerIndex((current) => {
      if (current === null || filteredItems.length === 0) return current;
      return (current + 1) % filteredItems.length;
    });
  }, [filteredItems.length]);

  useEffect(() => {
    if (viewerIndex === null) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeViewer, showNext, showPrevious, viewerIndex]);

  useEffect(() => {
    setViewerIndex(null);
  }, [activeFolder, search, sortMode]);

  return (
    <div className="min-h-screen bg-[#020704] text-white font-orbitron">
      <div
        className="fixed inset-0 bg-center bg-cover opacity-10"
        style={{ backgroundImage: "url('/background/bg.jpg')" }}
      />
      <div className="fixed inset-0 bg-[linear-gradient(90deg,rgba(0,255,102,0.05)_1px,transparent_1px),linear-gradient(rgba(0,255,102,0.04)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_top,rgba(0,255,102,0.12),transparent_36%),linear-gradient(180deg,rgba(2,7,4,0.58),#020704_82%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-5 border-b border-[#00ff66]/15 pb-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-md border border-[#00ff66]/35 bg-black/35 px-3 text-sm text-[#00ff66] transition hover:border-[#00ff66]/70 hover:bg-[#00ff66]/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Home
            </button>

            <div>
              <p className="text-[11px] uppercase tracking-[0.34em] text-[#00ff66]/60">
                War Archive System
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-normal text-[#00ff66] sm:text-5xl lg:text-6xl">
                Art of War
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-gray-400">
                Visual records, commander galleries, and campaign artwork from
                the 101st archive.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 sm:w-[520px]">
            <div className="border-l border-[#00ff66]/30 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                Folders
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {commanders.length}
              </p>
            </div>
            <div className="border-l border-[#00ff66]/30 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                Images
              </p>
              <p className="mt-1 text-2xl font-bold text-white">{totalFiles}</p>
            </div>
            <div className="border-l border-[#00ff66]/30 bg-black/20 px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.22em] text-gray-500">
                Showing
              </p>
              <p className="mt-1 text-2xl font-bold text-white">
                {filteredItems.length}
              </p>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-5 py-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="h-fit border border-[#00ff66]/15 bg-black/35 backdrop-blur-md lg:sticky lg:top-5">
            <div className="border-b border-[#00ff66]/15 px-4 py-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#00ff66]/65" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search images..."
                  className="h-11 w-full rounded-md border border-[#00ff66]/20 bg-black/55 pl-10 pr-10 text-sm text-white outline-none transition placeholder:text-gray-600 focus:border-[#00ff66]/60"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-gray-500 transition hover:bg-white/5 hover:text-white"
                    aria-label="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <label className="mt-4 block text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/55">
                Sort
              </label>
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="mt-2 h-11 w-full rounded-md border border-[#00ff66]/20 bg-black/55 px-3 text-sm text-white outline-none transition focus:border-[#00ff66]/60"
              >
                {Object.entries(sortLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div className="px-3 py-4">
              <p className="px-2 text-[10px] uppercase tracking-[0.24em] text-[#00ff66]/55">
                Folders
              </p>
              <div className="mt-3 space-y-1">
                <button
                  type="button"
                  onClick={() => setActiveFolder("all")}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                    activeFolder === "all"
                      ? "bg-[#00ff66]/12 text-[#00ff66]"
                      : "text-gray-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Grid3X3 className="h-4 w-4" />
                    All
                  </span>
                  <span className="text-xs text-gray-500">{totalFiles}</span>
                </button>

                {commanders.map((commander) => (
                  <button
                    key={commander.folder}
                    type="button"
                    onClick={() => setActiveFolder(commander.folder)}
                    className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm transition ${
                      activeFolder === commander.folder
                        ? "bg-[#00ff66]/12 text-[#00ff66]"
                        : "text-gray-400 hover:bg-white/5 hover:text-white"
                    }`}
                  >
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <ImageIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{commander.name}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {commander.images.length}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          <main className="min-w-0">
            <div className="mb-5 flex flex-col gap-3 border-b border-[#00ff66]/15 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.28em] text-[#00ff66]/55">
                  Current View
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {activeFolderName}
                </h2>
              </div>
              <p className="text-sm text-gray-500">
                {loading
                  ? "Indexing archive..."
                  : `${filteredItems.length} of ${totalFiles} images`}
              </p>
            </div>

            {loading && (
              <div className="border border-[#00ff66]/15 bg-black/30 px-5 py-8 text-sm text-[#00ff66]">
                Loading archive records...
              </div>
            )}

            {error && !loading && (
              <div className="border border-red-500/35 bg-red-950/20 px-5 py-8 text-sm text-red-300">
                {error}
              </div>
            )}

            {!loading && !error && filteredItems.length === 0 && (
              <div className="grid min-h-[320px] place-items-center border border-[#00ff66]/15 bg-black/25 px-5 py-10 text-center">
                <div>
                  <ImageIcon className="mx-auto h-10 w-10 text-[#00ff66]/65" />
                  <p className="mt-4 text-lg text-[#00ff66]">
                    No archive matches found
                  </p>
                  <p className="mt-2 text-sm text-gray-500">
                    Try another folder, search term, or sort mode.
                  </p>
                </div>
              </div>
            )}

            {!loading && !error && filteredItems.length > 0 && (
              <div className="columns-1 gap-4 sm:columns-2 2xl:columns-3 [column-fill:_balance]">
                {filteredItems.map((item, index) => (
                  <button
                    key={`${item.src}-${item.globalIndex}`}
                    type="button"
                    onClick={() => openViewer(index)}
                    className="group mb-4 block w-full break-inside-avoid overflow-hidden border border-[#00ff66]/15 bg-black/35 text-left transition hover:border-[#00ff66]/60 hover:shadow-[0_0_30px_rgba(0,255,102,0.12)] focus:outline-none focus:ring-2 focus:ring-[#00ff66]/50"
                  >
                    <div
                      className={`relative ${
                        index % 5 === 0
                          ? "aspect-[4/5]"
                          : index % 4 === 0
                            ? "aspect-[16/10]"
                            : "aspect-[4/3]"
                      }`}
                    >
                      <Image
                        src={item.src}
                        alt={`${item.commanderName} artwork ${item.folderIndex + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1536px) 50vw, 33vw"
                        className="object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent opacity-80 transition group-hover:opacity-60" />
                      <div className="absolute inset-x-0 bottom-0 p-4">
                        <p className="text-sm font-semibold text-[#00ff66]">
                          {item.commanderName}
                        </p>
                        <p className="mt-1 truncate text-xs text-gray-400">
                          {item.fileName}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {activeViewerItem && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95 text-white"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between border-b border-[#00ff66]/15 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#00ff66]/60">
                {activeViewerItem.commanderName}
              </p>
              <p className="mt-1 truncate text-sm text-gray-300">
                {activeViewerItem.fileName}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeViewerItem.src}
                download
                className="grid h-10 w-10 place-items-center rounded-md border border-[#00ff66]/20 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                aria-label="Download image"
              >
                <Download className="h-4 w-4" />
              </a>
              <a
                href={activeViewerItem.src}
                target="_blank"
                rel="noreferrer"
                className="grid h-10 w-10 place-items-center rounded-md border border-[#00ff66]/20 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                aria-label="Open image in new tab"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={closeViewer}
                className="grid h-10 w-10 place-items-center rounded-md border border-red-500/35 text-red-300 transition hover:bg-red-500/10"
                aria-label="Close viewer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center px-12 py-6">
            {filteredItems.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={showPrevious}
                  className="absolute left-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md border border-[#00ff66]/20 bg-black/50 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                  aria-label="Previous image"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
                <button
                  type="button"
                  onClick={showNext}
                  className="absolute right-3 top-1/2 z-10 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-md border border-[#00ff66]/20 bg-black/50 text-[#00ff66] transition hover:bg-[#00ff66]/10"
                  aria-label="Next image"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              </>
            )}

            <div className="relative h-full w-full">
              <Image
                src={activeViewerItem.src}
                alt={`${activeViewerItem.commanderName} artwork`}
                fill
                sizes="100vw"
                className="object-contain"
                priority
              />
            </div>
          </div>

          <div className="border-t border-[#00ff66]/15 px-4 py-3 text-center text-xs text-gray-500">
            {(viewerIndex || 0) + 1} / {filteredItems.length}
          </div>
        </div>
      )}
    </div>
  );
}
