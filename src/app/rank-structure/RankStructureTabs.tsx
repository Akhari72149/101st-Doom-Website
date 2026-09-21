"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, CircleDot, Crown, Layers3, Plane, Search, Star, Users, X } from "lucide-react";

export type Rank = { name: string; abbreviation: string; icon?: string; summary: string; requirements: string[]; note?: string };
export type RankTrack = { id: string; label: string; eyebrow: string; accent: "green" | "cyan" | "amber"; ranks: Rank[] };
type RankStructureTabsProps = { overallTracks: RankTrack[]; mosTracks: RankTrack[]; overallRankCount: number; mosRankCount: number };
type SelectedRank = { rank: Rank; track: RankTrack; position: number };

const accentClasses = {
  green: { border: "border-[#00ff66]/35", text: "text-[#00ff66]", background: "bg-[#00ff66]/10" },
  cyan: { border: "border-cyan-300/35", text: "text-cyan-300", background: "bg-cyan-300/10" },
  amber: { border: "border-amber-300/35", text: "text-amber-300", background: "bg-amber-300/10" },
} as const;

export default function RankStructureTabs({ overallTracks, mosTracks, overallRankCount, mosRankCount }: RankStructureTabsProps) {
  const [activeTab, setActiveTab] = useState<"overall" | "mos">("overall");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SelectedRank | null>(null);
  const activeTracks = activeTab === "overall" ? overallTracks : mosTracks;

  const visibleTracks = useMemo(() => {
    const search = query.trim().toLowerCase();
    if (!search) return activeTracks;
    return activeTracks.map((track) => ({
      ...track,
      ranks: track.ranks.filter((rank) => `${rank.name} ${rank.abbreviation} ${rank.summary} ${rank.requirements.join(" ")}`.toLowerCase().includes(search)),
    })).filter((track) => track.ranks.length > 0);
  }, [activeTracks, query]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);

  function changeTab(tab: "overall" | "mos") {
    setActiveTab(tab);
    setQuery("");
    setSelected(null);
  }

  return <>
    <div className="border-b border-[#00ff66]/20 bg-black/90">
      <div role="tablist" aria-label="Rank structure views" className="mx-auto grid max-w-7xl grid-cols-2 px-5 sm:px-8 lg:px-12">
        <button type="button" role="tab" id="rank-tab-overall" aria-controls="rank-panel-overall" aria-selected={activeTab === "overall"} onClick={() => changeTab("overall")} className={`flex min-h-16 items-center justify-center gap-3 border-x border-t px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition sm:text-sm ${activeTab === "overall" ? "border-[#00ff66]/60 bg-[#00ff66]/10 text-[#00ff66]" : "border-white/10 bg-black text-[#8ca095] hover:border-[#00ff66]/35 hover:text-white"}`}>
          <Layers3 size={18} aria-hidden="true" /><span>Overall</span><span className="hidden text-[10px] font-medium text-current/70 sm:inline">{overallRankCount} ranks</span>
        </button>
        <button type="button" role="tab" id="rank-tab-mos" aria-controls="rank-panel-mos" aria-selected={activeTab === "mos"} onClick={() => changeTab("mos")} className={`flex min-h-16 items-center justify-center gap-3 border-x border-t px-4 py-3 text-xs font-black uppercase tracking-[0.14em] transition sm:text-sm ${activeTab === "mos" ? "border-cyan-300/60 bg-cyan-300/10 text-cyan-300" : "border-white/10 bg-black text-[#8ca095] hover:border-cyan-300/35 hover:text-white"}`}>
          <Plane size={18} aria-hidden="true" /><span>MOS</span><span className="hidden text-[10px] font-medium text-current/70 sm:inline">{mosRankCount} ranks</span>
        </button>
      </div>
    </div>

    <div role="tabpanel" id={`rank-panel-${activeTab}`} aria-labelledby={`rank-tab-${activeTab}`} className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
      <div className="grid items-start gap-8 lg:grid-cols-[390px_1fr]">
        <aside className="border border-[#00ff66]/25 bg-black/75 lg:sticky lg:top-24">
          <header className="border-b border-[#00ff66]/15 p-4">
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#00ff66]">Rank index</p>
            <p className="mt-1 text-sm text-[#82958a]">Select a rank to view its progression requirements.</p>
            <label className="relative mt-4 block"><span className="sr-only">Search ranks</span><Search size={16} className="absolute left-3 top-3.5 text-[#62776b]" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rank or requirement" className="min-h-11 w-full border border-white/10 bg-[#020806] pl-10 pr-3 text-sm text-white outline-none focus:border-[#00ff66]/45" /></label>
          </header>
          <div className="max-h-[calc(100dvh-180px)] overflow-y-auto overscroll-contain">
            {visibleTracks.map((track) => {
              const accent = accentClasses[track.accent];
              return <section key={track.id}>
                <div className={`border-b border-t border-white/10 px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] first:border-t-0 ${accent.text}`}>{track.label}</div>
                {track.ranks.map((rank) => {
                  const position = activeTracks.find((item) => item.id === track.id)?.ranks.findIndex((item) => item.name === rank.name && item.abbreviation === rank.abbreviation) ?? 0;
                  return <button key={`${track.id}-${rank.name}-${rank.abbreviation}`} type="button" onClick={() => setSelected({ rank, track, position })} className="group flex min-h-16 w-full items-center gap-3 border-b border-white/10 px-4 py-3 text-left last:border-b-0 hover:bg-[#00ff66]/[.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#00ff66]">
                    <span className={`relative grid h-10 w-10 shrink-0 place-items-center border ${accent.border} ${accent.background} text-xs font-black ${accent.text}`}>{rank.icon ? <Image src={rank.icon} alt="" width={32} height={32} className="h-8 w-8 object-contain [image-rendering:pixelated]" /> : rank.abbreviation}</span>
                    <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-white group-hover:text-[#00ff66]">{rank.name}</strong><span className="mt-0.5 block font-mono text-xs text-[#71847a]">{rank.abbreviation}</span></span>
                    <ChevronRight size={16} className="shrink-0 text-[#52645a] group-hover:text-[#00ff66]" aria-hidden="true" />
                  </button>;
                })}
              </section>;
            })}
            {!visibleTracks.length && <p className="p-6 text-center text-sm text-[#71847a]">No ranks match that search.</p>}
          </div>
        </aside>

        <section className="border border-[#00ff66]/20 bg-[#031009]">
          <div className="border-b border-[#00ff66]/15 p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[0.2em] text-[#00ff66]">Progression reference</p><h2 className="mt-3 text-2xl font-black uppercase sm:text-3xl">Choose a rank from the index</h2><p className="mt-4 max-w-2xl text-sm leading-7 text-[#97aa9f]">Each rank opens a focused record containing its insignia, place in the progression track, description, and published requirements.</p></div>
          <div className="grid gap-px bg-[#00ff66]/15 md:grid-cols-3">
            <div className="bg-[#020806] p-5"><div className="flex items-center gap-3 text-[#00ff66]"><CircleDot size={18} /><strong>TIG</strong></div><p className="mt-2 text-sm leading-6 text-[#8ea397]">Time in Grade is counted from the effective date of the current rank.</p></div>
            <div className="bg-[#020806] p-5"><div className="flex items-center gap-3 text-cyan-300"><Users size={18} /><strong>Attendance</strong></div><p className="mt-2 text-sm leading-6 text-[#8ea397]">Thresholds represent minimum expected Main Operation participation.</p></div>
            <div className="bg-[#020806] p-5"><div className="flex items-center gap-3 text-amber-300"><Star size={18} /><strong>Approval</strong></div><p className="mt-2 text-sm leading-6 text-[#8ea397]">Minimum criteria do not replace billet availability or command approval.</p></div>
          </div>
        </section>
      </div>
    </div>

    {selected && (() => {
      const accent = accentClasses[selected.track.accent];
      return <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 p-2 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="rank-modal-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
        <section className={`flex max-h-[94dvh] w-full max-w-2xl flex-col border ${accent.border} bg-[#020806] shadow-[0_0_70px_rgba(0,255,102,.12)]`}>
          <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
            <div className="flex min-w-0 items-center gap-4"><div className={`relative grid h-16 w-16 shrink-0 place-items-center border ${accent.border} ${accent.background} text-sm font-black ${accent.text}`}>{selected.rank.icon ? <Image src={selected.rank.icon} alt={`${selected.rank.name} insignia`} width={48} height={48} className="h-12 w-12 object-contain [image-rendering:pixelated]" /> : selected.rank.abbreviation}</div><div className="min-w-0"><p className={`text-[11px] font-black uppercase tracking-[0.18em] ${accent.text}`}>{selected.track.label} · Rank {String(selected.position + 1).padStart(2, "0")}</p><h2 id="rank-modal-title" className="mt-2 text-xl font-black leading-tight sm:text-2xl">{selected.rank.name}</h2><p className="mt-1 font-mono text-sm text-[#80958a]">{selected.rank.abbreviation}</p></div></div>
            <button type="button" onClick={() => setSelected(null)} aria-label="Close rank details" className="shrink-0 border border-white/15 p-2 text-[#84968c] hover:border-[#00ff66]/40 hover:text-white"><X size={20} /></button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
            <section><p className="text-[11px] font-black uppercase tracking-[0.18em] text-[#708278]">Role summary</p><p className="mt-3 text-sm leading-7 text-[#bdcbc3]">{selected.rank.summary}</p></section>
            <section className="mt-7"><p className={`border-b pb-3 text-[11px] font-black uppercase tracking-[0.18em] ${accent.border} ${accent.text}`}>Promotion requirements</p>{selected.rank.requirements.length ? <ul className="mt-4 space-y-3">{selected.rank.requirements.map((requirement) => <li key={requirement} className="flex gap-3 border border-white/10 bg-white/[.02] p-3 text-sm leading-6 text-[#d4e1d9]"><CheckCircle2 size={17} className={`mt-1 shrink-0 ${accent.text}`} aria-hidden="true" /><span>{requirement}</span></li>)}</ul> : <p className="mt-4 border border-white/10 p-4 text-sm text-[#788e82]">No formal requirement is currently published.</p>}</section>
            {selected.rank.note && <div className="mt-6 flex items-center gap-3 border border-amber-300/25 bg-amber-300/5 p-4 text-xs font-bold uppercase tracking-[0.12em] text-amber-200"><Crown size={17} aria-hidden="true" />{selected.rank.note}</div>}
          </div>
          <footer className="flex justify-end border-t border-white/10 p-4"><button type="button" onClick={() => setSelected(null)} className={`min-h-10 border px-5 text-xs font-black uppercase tracking-[0.12em] ${accent.border} ${accent.text}`}>Close</button></footer>
        </section>
      </div>;
    })()}
  </>;
}
