"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import HTMLFlipBookBase from "react-pageflip";

const HTMLFlipBook = HTMLFlipBookBase as any;

const issueFolders = [
  { title: "Minora IV", subtitle: "101st Doom Battalion Operational Archive", folder: "minora", cover: "/news/cover_campaign.jpg" },
  { title: "TARSUS PRIME", subtitle: "101st Doom Battalion Operational Archive", folder: "tarsus prime", cover: "/news/cover_campaign.jpg" },
  { title: "YOABOS", subtitle: "Republic Intelligence Brief", folder: "yoabos", cover: "/news/cover_campaign.jpg" },
];

export default function NewsPage() {
  const [activeBook, setActiveBook] = useState<number | null>(null);
  const [issues, setIssues] = useState<{ title: string; subtitle: string; cover: string; pages: string[] }[]>([]);
  const [pagesCache, setPagesCache] = useState<{ [folder: string]: string[] }>({});
  const [loading, setLoading] = useState(false);
  const flipbookRef = useRef<any>(null);

  // ------------------- Load initial covers -------------------
  useEffect(() => {
    const loadCovers = async () => {
      const loaded = issueFolders.map(issue => ({
        title: issue.title,
        subtitle: issue.subtitle,
        cover: issue.cover,
        pages: [], // initially empty
      }));
      setIssues(loaded);
    };
    loadCovers();
  }, []);

  // ------------------- Load pages on-demand -------------------
  useEffect(() => {
    if (activeBook === null) return;

    const folder = issueFolders[activeBook].folder;
    setLoading(true);

    const loadPages = async () => {
      // skip if cached
      if (pagesCache[folder]) {
        setIssues(prev => {
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

      // Preload all images
      await Promise.all(
        pages.map(src => new Promise<void>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }))
      );

      setPagesCache(prev => ({ ...prev, [folder]: pages }));

      setIssues(prev => {
        const updated = [...prev];
        updated[activeBook] = { ...updated[activeBook], pages };
        return updated;
      });

      setLoading(false);
    };

    loadPages();
  }, [activeBook, pagesCache]);

  // ------------------- Keyboard navigation -------------------
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!flipbookRef.current) return;
      if (e.key === "ArrowRight") flipbookRef.current.pageFlip().flipNext();
      if (e.key === "ArrowLeft") flipbookRef.current.pageFlip().flipPrev();
      if (e.key === "Escape") setActiveBook(null);
    },
    [flipbookRef]
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
    <div className="relative min-h-screen text-white font-orbitron overflow-hidden">

      {/* ================= BACKGROUND ================= */}
      <div className="absolute inset-0 bg-black" />
      <div className="absolute inset-0 pointer-events-none opacity-10
        bg-[linear-gradient(#00ff66_1px,transparent_1px),linear-gradient(90deg,#00ff66_1px,transparent_1px)]
        bg-[size:40px_40px] animate-gridMove
      " />
      <div className="absolute inset-0 pointer-events-none opacity-10
        bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#00ff66_3px)] animate-gridMoveSlow
      " />
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

      {/* ================= HEADER ================= */}
      <div className="relative z-10 pt-28 text-center">
        <div className="text-[#00ff66] tracking-[0.5em] text-5xl flicker font-orbitron">REPUBLIC INTELLIGENCE</div>
        <div className="mt-3 text-blue-400 tracking-widest text-sm font-mono">GRAND ARMY OF THE REPUBLIC</div>
        <div className="mt-2 text-[#00ff66] text-xs tracking-widest font-mono">101ST DOOM BATTALION ARCHIVE TERMINAL</div>
        <div className="mt-4 text-[#00ff66]/70 text-xs tracking-widest font-mono">CLASSIFICATION: MILITARY REPORTS</div>
      </div>

      {/* ================= CONTENT ================= */}
      <div className="relative z-10 max-w-7xl mx-auto pt-20 pb-24 px-6">

        {/* ================= BOOKSHELF VIEW ================= */}
        {activeBook === null && (
          <div className="flex justify-center gap-8">
            {issues.map((issue, index) => (
              <div
                key={index}
                onClick={() => setActiveBook(index)}
                className="relative cursor-pointer transform transition duration-300 hover:scale-110 w-[200px] h-[280px] shadow-[0_0_30px_rgba(0,255,100,0.4)] rounded-md overflow-hidden hover:rotate-y-3 hover:rotate-x-2 perspective-200"
              >
                <img src={issue.cover} className="absolute inset-0 w-full h-full object-cover rounded-md" />
                <div className="absolute inset-0 bg-black/30 rounded-md flex flex-col items-center justify-end text-center px-2 pb-4">
                  <div className="bg-black/50 rounded px-1 py-1">
                    <div className="text-[#00ff66] text-sm tracking-widest">{issue.title}</div>
                    <div className="text-blue-400 text-xs mt-1">{issue.subtitle}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ================= READER VIEW ================= */}
        {activeBook !== null && (
          <div className="flex flex-col items-center mt-10 relative">

            {/* Loading overlay */}
            {loading && (
              <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center">
                <div className="animate-spin border-4 border-t-[#00ff66] border-gray-600 rounded-full w-16 h-16 mb-4"></div>
                <div className="text-[#00ff66] tracking-widest">Loading Archive...</div>
              </div>
            )}

            <button
              onClick={() => setActiveBook(null)}
              className="mb-10 px-6 py-2 border border-[#00ff66] text-[#00ff66] hover:bg-[#00ff66] hover:text-black transition z-10"
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
              >
                {/* COVER */}
                <div className="relative bg-black border border-[#00ff66]/40 flex items-center justify-center">
                  <img
                    src={issues[activeBook].cover}
                    className="absolute inset-0 w-full h-full object-cover opacity-40"
                  />
                  <div className="absolute bottom-6 w-full text-center px-6">
                    <div className="bg-black/50 inline-block rounded px-3 py-2">
                      <div className="text-[#00ff66] text-3xl tracking-widest font-orbitron">{issues[activeBook].title}</div>
                      <div className="text-blue-400 text-sm mt-2 font-mono">{issues[activeBook].subtitle}</div>
                      <div className="mt-4 text-xs text-[#00ff66]/70 tracking-widest font-mono">GRAND ARMY OF THE REPUBLIC</div>
                      <div className="text-xs text-gray-400 mt-1 font-mono">MILITARY ARCHIVE RECORD</div>
                    </div>
                  </div>
                </div>

                {/* PAGES */}
                {issues[activeBook].pages.map((img: string, pageIndex: number) => (
                  <div key={pageIndex} className="bg-black border border-[#00ff66]/30 flex items-center justify-center">
                    <img src={img} alt="report page" loading="lazy" className="w-full h-full object-contain" />
                  </div>
                ))}
              </HTMLFlipBook>
            )}
          </div>
        )}

      </div>
    </div>
  );
}