"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpenText, ExternalLink, FileText, Search } from "lucide-react";
import type { DocumentLibrarySection, SiteDocument } from "@/data/siteDocuments";
import { documentLibrarySections } from "@/data/siteDocuments";

type LibraryItem = {
  id: string;
  title: string;
  summary: string;
  href: string;
  section: DocumentLibrarySection;
  group: string;
  external: boolean;
  managed?: boolean;
};

const existingDocuments: LibraryItem[] = [
  { id: "rules", title: "Rules & Regulations", summary: "Official battalion conduct, operation, community, and leadership standards.", href: "/rules-and-regulations", section: "General", group: "Battalion", external: false },
  { id: "wbk-melee", title: "WBK Melee Guide", summary: "Reference material for approved melee systems and use.", href: "https://docs.google.com/document/d/17esv78nonssi2lRVb8ZMcsc2ndfRkRdvUW-3HUpqXFU/edit?usp=sharing", section: "General", group: "Guide", external: true },
  { id: "funop-swap", title: "FunOp Weapon Swap List", summary: "Approved one-to-one weapon substitutions for Fun Operations.", href: "https://docs.google.com/spreadsheets/d/1myNKpUaGmGu_n3op23Nz-o-WSz0k8D62GPt9fMkhek0/edit?usp=sharing", section: "General", group: "Reference", external: true },
  { id: "uniform-guide", title: "Uniform Guide", summary: "Published uniform, equipment, and restricted-item guidance.", href: "/uniform-guide", section: "General", group: "Guide", external: false },
  { id: "cert-overview", title: "Certification Overview", summary: "Browse available certifications and their current holders.", href: "/certs", section: "Certifications", group: "Website", external: false },
  { id: "marksman-manual", title: "Marksman Operation Manual", summary: "Operational standards and procedures for Marksman-qualified personnel.", href: "https://docs.google.com/document/d/1INdLCZWSs9PG9CgccgqN0NO4m3mRFAwiv6_V2u-2nHw/edit?usp=sharing", section: "Certifications", group: "Marksman", external: true },
  { id: "ifv-sop", title: "IFV Standard Operating Procedure", summary: "Operating procedures for Infantry Fighting Vehicle crews.", href: "https://docs.google.com/document/d/1JdcGh0pVZoi4ZwrV8GzJ2gOun2fb5PLHsCtZd33t3wc/edit", section: "Certifications", group: "IFV", external: true },
  { id: "drone-manual", title: "Drone Operation Manual", summary: "Training and operating reference for certified drone operators.", href: "https://docs.google.com/document/d/10hNiOKNFsHbprXiEq3W8w8Td0I9W43WYUSkJbOTXNg0/edit?tab=t.0", section: "Certifications", group: "Drone", external: true },
  { id: "idf-document", title: "IDF Document", summary: "Restricted IDF reference. Certification access is required.", href: "https://discord.com/channels/445933549816774656/856978303520604211/1398743305348448498", section: "Certifications", group: "IDF", external: true },
  { id: "medic-handbook", title: "Medic Handbook V2", summary: "Core field medical handbook for the Medic MOS.", href: "https://docs.google.com/document/d/1kwMBfnKNZhh4EjDtxwT5Hhn1uDa3t7EFKeoEXBO2pYY/edit?usp=sharing", section: "MOS", group: "Medic", external: true },
  { id: "cls-shadow", title: "CLS Shadow Form", summary: "Record and submit supervised CLS shadow activity.", href: "https://forms.gle/KcRSkzyLP1BhKXacu3A", section: "MOS", group: "Medic", external: true },
  { id: "rto-guide", title: "RTO Guide", summary: "Primary procedures and references for RTO personnel.", href: "https://docs.google.com/document/d/109QilDCRANogRFltDDqcu0V1SJ670-G-w-iHIGn5EWo/edit?tab=t.0#heading=h.nfvr9ice89sf", section: "MOS", group: "RTO", external: true },
  { id: "rto-advanced", title: "RTO Advanced Guide", summary: "Advanced communications guidance for experienced RTO personnel.", href: "https://docs.google.com/document/d/1g5puYeS3ifNQmnnvvqILOcfAo55VQ113We9gcH1Ez6A/edit?tab=t.0", section: "MOS", group: "RTO", external: true },
  { id: "rto-cheat-sheet", title: "Virgil's Cheat Sheet", summary: "Condensed field reference for common RTO procedures.", href: "https://docs.google.com/document/d/1Q4vM6BHcT_GrPaGNExhTw85_gX4Bb0LqgxmQOx9Uams/edit?tab=t.0", section: "MOS", group: "RTO", external: true },
  { id: "hammer-sop", title: "Hammer SOP", summary: "Standard operating procedures for Hammer aviation personnel.", href: "https://docs.google.com/document/d/1iRgpcLMDEPJIcPnBUWChFMzFFh1j-IP6O8rl58wOCXU/edit?usp=sharing", section: "MOS", group: "Hammer", external: true },
  { id: "hammer-ride-along", title: "Ride Along Form", summary: "Submit and record a Hammer ride-along request.", href: "https://forms.gle/FYytpLP1BhKXacu3A", section: "MOS", group: "Hammer", external: true },
  { id: "mission-builder", title: "Mission Builder Documentation", summary: "Reference material for building and maintaining unit missions.", href: "https://docs.google.com/document/d/1nllJUj5EOlz6I9yxFSOs8ccsGWb9LWUASCwRMY6AV5M/edit?usp=sharing", section: "C-Shop", group: "Mission Building", external: true },
];

function managedHref(document: SiteDocument) {
  return document.slug === "rules-and-regulations" ? "/rules-and-regulations" : `/documents/${document.slug}`;
}

export default function DocumentsPage() {
  const [activeSection, setActiveSection] = useState<DocumentLibrarySection>("General");
  const [managedDocuments, setManagedDocuments] = useState<SiteDocument[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    void fetch("/api/site-documents", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as { documents?: SiteDocument[] };
        if (response.ok && body.documents) setManagedDocuments(body.documents);
      })
      .catch(() => undefined);
  }, []);

  const allDocuments = useMemo<LibraryItem[]>(() => {
    const managed = managedDocuments
      .filter((document) => document.slug !== "rules-and-regulations")
      .map((document) => ({
        id: `managed-${document.id}`,
        title: document.title,
        summary: document.summary || "Published website document.",
        href: managedHref(document),
        section: document.category,
        group: "Website document",
        external: false,
        managed: true,
      }));
    return [...existingDocuments, ...managed];
  }, [managedDocuments]);

  const visibleDocuments = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return allDocuments.filter((document) => document.section === activeSection && (!needle || [document.title, document.summary, document.group].join(" ").toLowerCase().includes(needle)));
  }, [activeSection, allDocuments, query]);

  const counts = useMemo(() => Object.fromEntries(documentLibrarySections.map((section) => [section, allDocuments.filter((document) => document.section === section).length])) as Record<DocumentLibrarySection, number>, [allDocuments]);

  return (
    <main className="min-h-screen bg-[#020806] text-white">
      <header className="border-b border-[#00ff66]/20 bg-[linear-gradient(90deg,rgba(0,255,102,0.07),transparent_62%)]">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-8 lg:py-16">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]"><BookOpenText size={16} /> Battalion Reference</div>
          <h1 className="mt-4 text-4xl font-black uppercase sm:text-5xl">Documents & Forms</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[#91a699] sm:text-base">Official policies, training material, forms, and operational references in one searchable library.</p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-8">
        <div className="grid border border-[#00ff66]/20 sm:grid-cols-2 lg:grid-cols-4" role="tablist" aria-label="Document sections">
          {documentLibrarySections.map((section) => (
            <button key={section} type="button" role="tab" aria-selected={activeSection === section} onClick={() => setActiveSection(section)} className={`flex min-h-16 items-center justify-between border-b border-[#00ff66]/15 px-5 text-left transition sm:border-r lg:border-b-0 ${activeSection === section ? "bg-[#00ff66]/12 text-[#00ff66]" : "bg-black/45 text-[#82958a] hover:bg-[#00ff66]/6 hover:text-white"}`}>
              <span className="text-xs font-black uppercase tracking-[0.12em]">{section}</span>
              <span className="text-[10px] font-black text-[#5e7467]">{counts[section]}</span>
            </button>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-4 border border-white/10 bg-black/45 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#00ff66]">{activeSection}</div><p className="mt-1 text-xs text-[#687c70]">{visibleDocuments.length} {visibleDocuments.length === 1 ? "entry" : "entries"} available</p></div>
          <label className="relative block w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#607369]" size={16} /><span className="sr-only">Search documents</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this section" className="h-11 w-full border border-white/12 bg-black pl-10 pr-3 text-sm outline-none placeholder:text-[#4f6056] focus:border-[#00ff66]/55" /></label>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {visibleDocuments.map((document) => (
            <a key={document.id} href={document.href} target={document.external ? "_blank" : undefined} rel={document.external ? "noreferrer" : undefined} className="group grid min-h-36 grid-cols-[auto_minmax(0,1fr)_auto] gap-4 border border-[#00ff66]/16 bg-black/55 p-5 transition hover:border-[#00ff66]/50 hover:bg-[#00ff66]/5 sm:p-6">
              <span className="grid h-11 w-11 place-items-center border border-[#00ff66]/25 bg-[#00ff66]/5 text-[#00ff66]"><FileText size={20} /></span>
              <span className="min-w-0"><span className="text-[9px] font-black uppercase tracking-[0.13em] text-cyan-300">{document.group}</span><strong className="mt-2 block text-base text-white group-hover:text-[#00ff66]">{document.title}</strong><span className="mt-2 block text-xs leading-5 text-[#778a7f]">{document.summary}</span>{document.managed && <span className="mt-3 inline-block border border-[#00ff66]/20 px-2 py-1 text-[8px] font-black uppercase tracking-[0.1em] text-[#00ff66]">Managed on website</span>}</span>
              {document.external ? <ExternalLink size={16} className="mt-1 text-[#52635a] group-hover:text-[#00ff66]" /> : <span className="mt-1 text-lg text-[#52635a] group-hover:text-[#00ff66]">›</span>}
            </a>
          ))}
        </div>

        {!visibleDocuments.length && <div className="mt-5 border border-white/10 bg-black/45 py-20 text-center"><Search className="mx-auto text-[#52635a]" size={28} /><h2 className="mt-4 font-black uppercase">No matching documents</h2><p className="mt-2 text-sm text-[#687c70]">Clear the search or try another section.</p></div>}
      </section>
    </main>
  );
}
