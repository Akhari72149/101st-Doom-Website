"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import HTMLFlipBookBase from "react-pageflip";

const HTMLFlipBook = HTMLFlipBookBase as any;

const issueFolders = [
  {
    title: "Minora IV",
    subtitle: "101st Doom Battalion Operational Archive",
    folder: "minora",
    cover: "/news/cover_campaign.jpg",
  },
  {
    title: "TARSUS PRIME",
    subtitle: "101st Doom Battalion Operational Archive",
    folder: "tarsus prime",
    cover: "/news/cover_campaign.jpg",
  },
  {
    title: "YOABOS",
    subtitle: "Republic Intelligence Brief",
    folder: "yoabos",
    cover: "/news/cover_campaign.jpg",
  },
];

export default function NewsPage() {
  const [activeBook, setActiveBook] = useState<number | null>(null);
  const [issues, setIssues] = useState<
    { title: string; subtitle: string; cover: string; pages: string[] }[]
  >([]);
  const [pagesCache, setPagesCache] = useState<{ [folder: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const flipbookRef = useRef<any>(null);

  useEffect(() => {
    const loaded = issueFolders.map((issue) => ({
      title: issue.title,
      subtitle: issue.subtitle,
      cover: issue.cover,
      pages: [],
    }));
    setIssues(loaded);
  }, []);

  useEffect(() => {
    if (activeBook === null) return;

    const folder = issueFolders[activeBook].folder;
    let cancelled = false;
    setLoading(true);
    setCurrentPage(0);

    const loadPages = async () => {
      if (pagesCache[folder]) {
        if (cancelled) return;

        setIssues((prev) => {
          const updated = [...prev];
          updated[activeBook] = { ...updated[activeBook], pages: pagesCache[folder] };
          return updated;
        });
        setLoading(false);
        return;
      }

      const pages: string[] = [];
      let index = 1;

      while (true) {
        const path = `/news/${folder}/page${index}.jpg`;
        try {
          const res = await fetch(path, { method: "HEAD" });
          if (!res.ok) break;
          pages.push(path);
          index++;
        } catch {
          break;
        }
      }

      await Promise.all(
        pages.map(
          (src) =>
            new Promise<void>((resolve) => {
              const img = new Image();
              img.src = src;
              img.onload = () => resolve();
              img.onerror = () => resolve();
            })
        )
      );

      if (cancelled) return;

      setPagesCache((prev) => ({ ...prev, [folder]: pages }));

      setIssues((prev) => {
        const updated = [...prev];
        updated[activeBook] = { ...updated[activeBook], pages };
        return updated;
      });

      setLoading(false);
    };

    loadPages();

    return () => {
      cancelled = true;
    };
  }, [activeBook, pagesCache]);

  const handleCloseBook = () => {
    setActiveBook(null);
    setCurrentPage(0);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const book = flipbookRef.current?.pageFlip?.();
      if (!book) return;

      const pageCount = book.getPageCount();

      if (e.key === "ArrowRight") {
        if (currentPage < pageCount - 1) {
          book.flipNext();
        }
      }

      if (e.key === "ArrowLeft") {
        if (currentPage > 0) {
          book.flipPrev();
        }
      }

      if (e.key === "Escape") {
        handleCloseBook();
      }
    },
    [currentPage]
  );

  useEffect(() => {
    if (activeBook !== null) {
      window.addEventListener("keydown", handleKeyDown);
    } else {
      window.removeEventListener("keydown", handleKeyDown);
    }

    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeBook, handleKeyDown]);

  return (
    <div className="relative min-h-screen overflow-hidden font-orbitron text-white">
      <div className="absolute inset-0 bg-black" />
      <div
        className="absolute inset-0 pointer-events-none opacity-10
        bg-[linear-gradient(#00ff66_1px,transparent_1px),linear-gradient(90deg,#00ff66_1px,transparent_1px)]
        bg-[size:40px_40px] animate-gridMove"
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-10
        bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ff66_3px)] animate-gridMoveSlow"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#001f11_0%,#000000_85%)]" />

      <style>
        {`
          @keyframes gridMove {
            0% { background-position: 0 0, 0 0; }
            100% { background-position: 40px 40px, 40px 40px; }
          }
          @keyframes gridMoveSlow {
            0% { background-position: 0 0; }
            100% { background-position: 0 80px; }
          }
          .animate-gridMove { animation: gridMove 30s linear infinite; }
          .animate-gridMoveSlow { animation: gridMoveSlow 60s linear infinite; }

          @keyframes flicker {
            0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
            20%, 22%, 24%, 55% { opacity: 0.5; }
          }
          .flicker { animation: flicker 1.5s infinite; }
        `}
      </style>

      <div className="relative z-10 pt-28 text-center">
        <div className="flicker text-5xl tracking-[0.5em] text-[#00ff66]">
          REPUBLIC INTELLIGENCE
        </div>
        <div className="mt-3 font-mono text-sm tracking-widest text-blue-400">
          GRAND ARMY OF THE REPUBLIC
        </div>
        <div className="mt-2 font-mono text-xs tracking-widest text-[#00ff66]">
          101ST DOOM BATTALION ARCHIVE TERMINAL
        </div>
        <div className="mt-4 font-mono text-xs tracking-widest text-[#00ff66]/70">
          CLASSIFICATION: MILITARY REPORTS
        </div>
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-24 pt-20">
        {activeBook === null && (
          <div className="flex justify-center gap-8">
            {issues.map((issue, index) => (
              <div
                key={issue.title}
                onClick={() => {
                  setActiveBook(index);
                  setCurrentPage(0);
                }}
                className="perspective-200 relative h-[280px] w-[200px] cursor-pointer overflow-hidden rounded-md shadow-[0_0_30px_rgba(0,255,100,0.4)] transition duration-300 hover:scale-110 hover:rotate-x-2 hover:rotate-y-3"
              >
                <img
                  src={issue.cover}
                  alt={`${issue.title} cover`}
                  className="absolute inset-0 h-full w-full rounded-md object-cover"
                />
                <div className="absolute inset-0 flex flex-col items-center justify-end rounded-md bg-black/30 px-2 pb-4 text-center">
                  <div className="rounded bg-black/50 px-1 py-1">
                    <div className="text-sm tracking-widest text-[#00ff66]">
                      {issue.title}
                    </div>
                    <div className="mt-1 text-xs text-blue-400">{issue.subtitle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeBook !== null && (
          <div className="relative mt-10 flex flex-col items-center">
            {loading && (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80">
                <div className="mb-4 h-16 w-16 animate-spin rounded-full border-4 border-gray-600 border-t-[#00ff66]"></div>
                <div className="tracking-widest text-[#00ff66]">Loading Archive...</div>
              </div>
            )}

            <button
              onClick={handleCloseBook}
              className="z-10 mb-10 border border-[#00ff66] px-6 py-2 text-[#00ff66] transition hover:bg-[#00ff66] hover:text-black"
            >
              RETURN TO ARCHIVE
            </button>

            {!loading && issues[activeBook] && (
              <HTMLFlipBook
                ref={flipbookRef}
                width={540}
                height={720}
                showCover
                flippingTime={900}
                drawShadow
                maxShadowOpacity={0.5}
                className="shadow-[0_0_60px_rgba(0,255,100,0.4)]"
                onFlip={(e: any) => setCurrentPage(e.data)}
              >
                <div className="relative flex items-center justify-center border border-[#00ff66]/40 bg-black">
                  <img
                    src={issues[activeBook].cover}
                    alt={`${issues[activeBook].title} archive cover`}
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                  <div className="absolute bottom-6 w-full px-6 text-center">
                    <div className="inline-block rounded bg-black/50 px-3 py-2">
                      <div className="text-3xl tracking-widest text-[#00ff66]">
                        {issues[activeBook].title}
                      </div>
                      <div className="mt-2 font-mono text-sm text-blue-400">
                        {issues[activeBook].subtitle}
                      </div>
                      <div className="mt-4 font-mono text-xs tracking-widest text-[#00ff66]/70">
                        GRAND ARMY OF THE REPUBLIC
                      </div>
                      <div className="mt-1 font-mono text-xs text-gray-400">
                        MILITARY ARCHIVE RECORD
                      </div>
                    </div>
                  </div>
                </div>

                {issues[activeBook].pages.map((img: string, pageIndex: number) => (
                  <div
                    key={img}
                    className="flex items-center justify-center border border-[#00ff66]/30 bg-black"
                  >
                    <img
                      src={img}
                      alt={`report page ${pageIndex + 1}`}
                      loading="lazy"
                      className="h-full w-full object-contain"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-center border border-[#00ff66]/30 bg-black">
                  <div className="font-mono text-sm tracking-widest text-[#00ff66]/40">
                    END OF ARCHIVE
                  </div>
                </div>
              </HTMLFlipBook>
            )}
          </div>
        )}
      </div>
    </div>
  );
}