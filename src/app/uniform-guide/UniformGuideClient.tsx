"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  ExternalLink,
  ImageIcon,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import type { UniformGuideEntry, UniformGuideSection } from "@/data/uniformGuide";

export default function UniformGuideClient() {
  const [sections, setSections] = useState<UniformGuideSection[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [selected, setSelected] = useState<UniformGuideEntry | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/uniform-guide", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { sections?: UniformGuideSection[]; error?: string };
        if (!response.ok || !body.sections) throw new Error(body.error || "Failed to load the Uniform Guide");
        setSections(body.sections);
        setActiveSection(body.sections[0]?.key || "");
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Failed to load the Uniform Guide"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => event.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", close);
    };
  }, [selected]);

  const current = sections.find((section) => section.key === activeSection) || sections[0];
  const visibleEntries = useMemo(() => {
    if (!current) return [];
    const query = search.trim().toLowerCase();
    if (!query) return current.entries;
    return current.entries.filter((entry) => [
      entry.title,
      entry.subtitle,
      entry.summary,
      ...entry.notes,
      ...entry.categories.flatMap((category) => [category.label, ...category.items.map((item) => item.text)]),
    ].join(" ").toLowerCase().includes(query));
  }, [current, search]);

  const totalEntries = sections.reduce((total, section) => total + section.entries.length, 0);

  return (
    <main className="min-h-screen bg-[#020806] text-white">
      <header className="border-b border-[#00ff66]/25 bg-[linear-gradient(90deg,rgba(0,255,102,0.08),transparent_55%)]">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-4 py-12 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:py-16">
          <div className="max-w-3xl">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]">
              <BookOpenCheck size={16} /> Personnel Standards
            </div>
            <h1 className="mt-4 text-4xl font-black uppercase sm:text-5xl">Uniform Guide</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#9ab0a2] sm:text-base">
              Approved uniforms, weapons, medical supplies, ammunition, equipment, and restricted items for battalion operations.
            </p>
          </div>
          <dl className="grid grid-cols-2 border-l border-t border-[#00ff66]/20 bg-black/35">
            <div className="min-w-36 border-b border-r border-[#00ff66]/20 p-4">
              <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-[#789082]">Sections</dt>
              <dd className="mt-1 text-2xl font-black text-[#00ff66]">{sections.length}</dd>
            </div>
            <div className="min-w-36 border-b border-r border-[#00ff66]/20 p-4">
              <dt className="text-[10px] font-black uppercase tracking-[0.15em] text-[#789082]">Standards</dt>
              <dd className="mt-1 text-2xl font-black text-cyan-200">{totalEntries}</dd>
            </div>
          </dl>
        </div>
      </header>

      <section className="border-b border-[#00ff66]/20 bg-black/60">
        <div className="mx-auto max-w-7xl overflow-x-auto px-4 sm:px-8">
          <div className="flex min-w-max">
            {sections.map((section) => (
              <button key={section.key} type="button" onClick={() => { setActiveSection(section.key); setSearch(""); }}
                className={`min-h-14 border-x border-transparent px-5 text-xs font-black uppercase tracking-[0.12em] transition ${section.key === current?.key ? "border-[#00ff66]/35 bg-[#00ff66]/10 text-[#00ff66]" : "text-[#789082] hover:text-white"}`}>
                {section.label} <span className="ml-2 text-[9px] opacity-65">{section.entries.length}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8 sm:py-10">
        {loading ? (
          <div className="border border-[#00ff66]/20 p-10 text-center text-sm font-black uppercase tracking-[0.15em] text-[#00ff66]">Loading uniform standards...</div>
        ) : error ? (
          <div className="flex items-center gap-3 border border-red-400/40 bg-red-950/20 p-5 text-red-200"><AlertTriangle /> {error}</div>
        ) : current ? (
          <>
            <div className="flex flex-col gap-5 border-b border-[#00ff66]/20 pb-6 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#00ff66]">{current.label}</p>
                <h2 className="mt-2 text-2xl font-black uppercase sm:text-3xl">Published Standards</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#789082]">{current.description}</p>
              </div>
              <label className="relative block w-full lg:max-w-md">
                <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#5f7567]" size={18} />
                <span className="sr-only">Search this section</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`Search ${current.label}`}
                  className="h-12 w-full border border-[#00ff66]/25 bg-black pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-[#506158] focus:border-[#00ff66]/70" />
              </label>
            </div>

            {current.key === "restricted-items" && (
              <div className="mt-6 flex gap-3 border border-amber-300/35 bg-amber-300/5 p-4 text-sm text-amber-100">
                <ShieldAlert className="mt-0.5 shrink-0 text-amber-300" size={20} />
                <p>These restrictions apply to Main Operations unless an authorised exception is explicitly recorded.</p>
              </div>
            )}

            <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visibleEntries.map((entry) => (
                <button key={entry.id} type="button" onClick={() => setSelected(entry)}
                  className="group min-h-52 border border-[#00ff66]/15 bg-[#020806] p-5 text-left transition hover:border-[#00ff66]/40 hover:bg-[#00ff66]/6 focus:outline-none focus:ring-1 focus:ring-inset focus:ring-[#00ff66]">
                  <div className="flex items-start gap-4">
                    <div className="relative grid h-20 w-16 shrink-0 place-items-center overflow-hidden border border-[#00ff66]/20 bg-black text-[#4c6255]">
                      {entry.imagePath ? <Image src={entry.imagePath} alt="" fill sizes="64px" className="object-contain" unoptimized /> : <ImageIcon size={22} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[#00ff66]/70">{entry.subtitle || current.label}</p>
                      <h3 className="mt-1 text-lg font-black leading-6 text-white group-hover:text-[#00ff66]">{entry.title}</h3>
                    </div>
                  </div>
                  {entry.summary && <p className="mt-4 line-clamp-2 text-xs leading-5 text-[#789082]">{entry.summary}</p>}
                  <div className="mt-5 flex flex-wrap gap-2">
                    {entry.categories.slice(0, 4).map((category) => (
                      <span key={category.label} className="border border-white/10 px-2 py-1 text-[9px] font-black uppercase tracking-[0.1em] text-[#8ba395]">{category.label}</span>
                    ))}
                    {entry.categories.length > 4 && <span className="px-2 py-1 text-[9px] text-[#5f7567]">+{entry.categories.length - 4}</span>}
                  </div>
                </button>
              ))}
            </div>
            {!visibleEntries.length && <p className="border border-[#00ff66]/15 p-10 text-center text-sm text-[#789082]">No standards match this search.</p>}
          </>
        ) : null}
      </section>

      {selected && (
        <div className="fixed inset-0 z-[150] flex items-end justify-center bg-black/90 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="uniform-entry-title">
          <section className="flex max-h-[96vh] w-full max-w-6xl flex-col overflow-hidden border border-[#00ff66]/35 bg-[#020806] shadow-[0_0_70px_rgba(0,255,102,0.12)] sm:max-h-[92vh]">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[#00ff66]/20 bg-black p-5 sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#00ff66]">{sections.find((section) => section.key === selected.sectionKey)?.label}</p>
                <h2 id="uniform-entry-title" className="mt-1 text-2xl font-black text-white sm:text-3xl">{selected.title}</h2>
                {selected.subtitle && <p className="mt-2 text-sm text-cyan-200">{selected.subtitle}</p>}
              </div>
              <button type="button" onClick={() => setSelected(null)} title="Close" className="grid h-11 w-11 shrink-0 place-items-center border border-white/15 text-gray-300 transition hover:border-red-400/50 hover:text-red-300"><X size={20} /></button>
            </header>
            <div className="min-h-0 overflow-y-auto">
              <div className="grid lg:grid-cols-[minmax(250px,0.7fr)_minmax(0,1.6fr)]">
                <aside className="border-b border-[#00ff66]/20 bg-black/35 p-5 lg:border-b-0 lg:border-r lg:p-6">
                  <div className="relative mx-auto aspect-[3/4] max-h-[520px] w-full overflow-hidden border border-[#00ff66]/20 bg-black">
                    {selected.imagePath ? <Image src={selected.imagePath} alt={`${selected.title} uniform reference`} fill sizes="(max-width: 1024px) 80vw, 420px" className="object-contain" unoptimized /> : <div className="grid h-full place-items-center text-[#4c6255]"><ImageIcon size={36} /></div>}
                  </div>
                  {selected.summary && <p className="mt-5 text-sm leading-6 text-[#9ab0a2]">{selected.summary}</p>}
                  {selected.links.length > 0 && (
                    <div className="mt-5 space-y-2">
                      {selected.links.map((link) => <a key={`${link.text}-${link.url}`} href={link.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 border border-cyan-300/25 px-3 py-2 text-xs font-bold text-cyan-200 hover:border-cyan-300/60">{link.text}<ExternalLink size={14} /></a>)}
                    </div>
                  )}
                </aside>
                <div className="p-5 sm:p-6">
                  <div className="grid gap-3 md:grid-cols-2">
                    {selected.categories.map((category) => (
                      <section key={category.label} className="border border-[#00ff66]/15 bg-[#020806] p-4 sm:p-5">
                        <h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#00ff66]">{category.label}</h3>
                        <ul className="mt-3 space-y-2">
                          {category.items.map((item, index) => (
                            <li key={`${item.text}-${index}`} className="flex gap-2 text-sm leading-5 text-[#b1c3b7]">
                              <span className="mt-2 h-1 w-1 shrink-0 bg-[#00ff66]" />
                              {item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="text-cyan-200 underline decoration-cyan-300/40 underline-offset-4 hover:text-white">{item.text}</a> : item.text}
                            </li>
                          ))}
                        </ul>
                      </section>
                    ))}
                  </div>
                  {selected.notes.length > 0 && (
                    <section className="mt-5 border border-amber-300/25 bg-amber-300/5 p-4">
                      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-amber-300">Additional Notes</h3>
                      <ul className="mt-3 space-y-2 text-sm leading-5 text-amber-100/85">{selected.notes.map((note) => <li key={note}>{note}</li>)}</ul>
                    </section>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
