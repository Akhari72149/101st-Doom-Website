"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BookOpenText, ExternalLink, Search } from "lucide-react";
import DocumentRenderer from "@/components/documents/DocumentRenderer";
import type { DocumentBlock, SiteDocument } from "@/data/siteDocuments";
import { blockText, documentWordCount } from "@/data/siteDocuments";

export default function ManagedDocumentClient({ slug }: { slug: string }) {
  const [document, setDocument] = useState<SiteDocument | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch(`/api/site-documents?slug=${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { documents?: SiteDocument[]; error?: string };
        if (!response.ok || !body.documents?.[0]) throw new Error(body.error || "Document not found");
        setDocument(body.documents[0]);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Document not found"))
      .finally(() => setLoading(false));
  }, [slug]);

  const visibleContent = useMemo<DocumentBlock[]>(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return document?.content || [];
    return (document?.content || []).filter((block) => blockText(block).toLowerCase().includes(needle));
  }, [document, query]);

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading document...</main>;
  if (error || !document) return <main className="min-h-screen bg-[#020806] p-10 text-red-200">{error || "Document not found"}</main>;

  const updated = new Intl.DateTimeFormat("en-GB", { dateStyle: "long" }).format(new Date(document.updatedAt));

  return (
    <main className="min-h-screen bg-[#020806] text-white">
      <header className="border-b border-[#00ff66]/20 bg-[linear-gradient(90deg,rgba(0,255,102,0.07),transparent_62%)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-8 lg:py-14">
          <Link href="/documents" className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#7e9387] hover:text-[#00ff66]"><ArrowLeft size={14} /> Document library</Link>
          <div className="mt-7 flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]"><BookOpenText size={16} /> {document.category}</div>
          <h1 className="mt-4 text-3xl font-black uppercase sm:text-5xl">{document.title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#91a699] sm:text-base">{document.summary}</p>
          <dl className="mt-7 flex flex-wrap divide-x divide-[#00ff66]/20 border-y border-[#00ff66]/20 bg-black/35">
            <div className="px-4 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#61756a]">Words</dt><dd className="mt-1 font-black text-[#00ff66]">{documentWordCount(document.content).toLocaleString("en-GB")}</dd></div>
            <div className="px-4 py-3"><dt className="text-[9px] font-black uppercase tracking-[0.13em] text-[#61756a]">Updated</dt><dd className="mt-1 text-sm font-black">{updated}</dd></div>
          </dl>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block w-full sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#607369]" size={16} /><span className="sr-only">Search document</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this document" className="h-11 w-full border border-white/12 bg-black pl-10 pr-3 text-sm outline-none placeholder:text-[#4f6056] focus:border-[#00ff66]/55" /></label>
          {document.sourceUrl && <a href={document.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center justify-center gap-2 border border-cyan-300/20 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-cyan-200 hover:bg-cyan-300/5">Original source <ExternalLink size={14} /></a>}
        </div>
        <article className="border border-[#00ff66]/20 bg-black/55 px-5 py-7 sm:px-9 sm:py-10">
          {query && <div className="mb-7 border border-cyan-300/25 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">Showing {visibleContent.length} matching passages for <strong>{query}</strong>.</div>}
          <DocumentRenderer content={visibleContent} />
          {!visibleContent.length && <div className="py-20 text-center text-sm text-[#73877b]">No passages match that search.</div>}
        </article>
      </div>
    </main>
  );
}
