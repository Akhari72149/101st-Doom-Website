"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, ExternalLink, Search, ShieldCheck } from "lucide-react";
import DocumentRenderer, { documentHeadingId } from "@/components/documents/DocumentRenderer";
import type { DocumentBlock, SiteDocument } from "@/data/siteDocuments";
import { blockText, documentBackgroundAppearance, documentWordCount } from "@/data/siteDocuments";

type Section = { heading: DocumentBlock | null; headingIndex: number; blocks: Array<{ block: DocumentBlock; index: number }> };

function sectionsFor(content: DocumentBlock[]) {
  const sections: Section[] = [{ heading: null, headingIndex: -1, blocks: [] }];
  content.forEach((block, index) => {
    if (block.type === "heading1") sections.push({ heading: block, headingIndex: index, blocks: [] });
    else sections[sections.length - 1].blocks.push({ block, index });
  });
  return sections.filter((section) => section.heading || section.blocks.length);
}

export default function RulesDocumentClient() {
  const [document, setDocument] = useState<SiteDocument | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/site-documents?slug=rules-and-regulations", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { documents?: SiteDocument[]; error?: string };
        if (!response.ok || !body.documents?.[0]) throw new Error(body.error || "Rules and Regulations are unavailable");
        setDocument(body.documents[0]);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Rules and Regulations are unavailable"))
      .finally(() => setLoading(false));
  }, []);

  const sections = useMemo(() => sectionsFor(document?.content || []), [document]);
  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return sections;
    return sections.map((section) => {
      const headingMatches = section.heading && blockText(section.heading).toLowerCase().includes(needle);
      const blocks = headingMatches ? section.blocks : section.blocks.filter(({ block }) => blockText(block).toLowerCase().includes(needle));
      return { ...section, blocks };
    }).filter((section) => section.blocks.length || (section.heading && blockText(section.heading).toLowerCase().includes(needle)));
  }, [query, sections]);

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Rules and Regulations...</main>;
  if (error || !document) return <main className="min-h-screen bg-[#020806] p-10 text-red-200">{error || "Rules and Regulations are unavailable"}</main>;

  const ruleCount = document.content.filter((block) => block.type === "numbered").length;
  const updated = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(document.updatedAt));
  const appearance = documentBackgroundAppearance(document.background);
  return (
    <main className="min-h-screen bg-[#020806] text-white">
      <header className="border-b border-[#00ff66]/25 bg-[linear-gradient(90deg,rgba(0,255,102,0.08),transparent_58%)]">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-8 lg:grid-cols-[1fr_190px] lg:items-center lg:py-16">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]"><ShieldCheck size={16} /> Battalion Standards</div>
            <h1 className="mt-4 text-4xl font-black uppercase sm:text-5xl">{document.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[#9ab0a2] sm:text-base">{document.summary}</p>
            <dl className="mt-7 flex flex-wrap divide-x divide-[#00ff66]/20 border-y border-[#00ff66]/20 bg-black/35">
              <div className="px-4 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6d8175]">Published rules</dt><dd className="mt-1 font-black text-[#00ff66]">{ruleCount}</dd></div>
              <div className="px-4 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6d8175]">Sections</dt><dd className="mt-1 font-black text-cyan-200">{sections.filter((section) => section.heading).length}</dd></div>
              <div className="px-4 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.14em] text-[#6d8175]">Updated</dt><dd className="mt-1 text-sm font-black text-white">{updated}</dd></div>
            </dl>
          </div>
          <div className="hidden h-44 border border-[#00ff66]/20 bg-black/45 p-5 lg:grid lg:place-items-center"><Image src="/icons/DBLogo.jpg" alt="101st Doom Battalion" width={130} height={130} className="h-32 w-32 object-contain" /></div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-8 lg:grid-cols-[260px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#61766a]" size={16} />
            <span className="sr-only">Search rules</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search rules" className="h-12 w-full border border-[#00ff66]/25 bg-black pl-10 pr-3 text-sm outline-none placeholder:text-[#506158] focus:border-[#00ff66]/70" />
          </label>
          <nav className="mt-3 max-h-[calc(100vh-11rem)] overflow-y-auto border border-[#00ff66]/20 bg-black/45 p-2" aria-label="Rules sections">
            {sections.filter((section) => section.heading).map((section) => (
              <a key={section.headingIndex} href={`#${documentHeadingId(section.heading as DocumentBlock, section.headingIndex)}`} className="block border-l border-transparent px-3 py-3 text-xs font-bold leading-5 text-[#82988b] transition hover:border-[#00ff66] hover:bg-[#00ff66]/7 hover:text-white">{blockText(section.heading as DocumentBlock)}</a>
            ))}
          </nav>
          {document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 flex items-center justify-between border border-white/10 px-3 py-3 text-xs text-[#789082] hover:border-cyan-300/40 hover:text-cyan-200">Original source <ExternalLink size={14} /></a>}
        </aside>

        <article className="min-w-0 border px-5 py-7 sm:px-9 sm:py-10" style={{ backgroundColor: appearance.colour, borderColor: appearance.border, color: appearance.text }}>
          {query && <div className="mb-7 border border-cyan-300/25 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">Showing {visible.reduce((total, section) => total + section.blocks.length, 0)} matching passages for <strong>{query}</strong>.</div>}
          {visible.map((section, sectionIndex) => {
            const blocks = [...(section.heading ? [{ block: section.heading, index: section.headingIndex }] : []), ...section.blocks];
            return <DocumentRenderer key={`${section.headingIndex}-${sectionIndex}`} content={blocks.map(({ block }) => block)} background={document.background} />;
          })}
          {!visible.length && <div className="py-24 text-center"><BookOpenCheck className="mx-auto text-[#00ff66]" size={32} /><h2 className="mt-4 text-xl font-black">No matching rules</h2><p className="mt-2 text-sm text-[#789082]">Try a broader term or clear the search.</p></div>}
          <footer className="mt-12 border-t border-[#00ff66]/20 pt-5 text-xs text-[#61766a]">{documentWordCount(document.content).toLocaleString("en-GB")} words · Managed through the website document library</footer>
        </article>
      </div>
    </main>
  );
}
