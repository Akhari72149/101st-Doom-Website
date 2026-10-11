"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Clock3,
  Eye,
  EyeOff,
  ImageIcon,
  ImageUp,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type {
  UniformGuideCategory,
  UniformGuideEntry,
  UniformGuideLink,
  UniformGuideRevision,
  UniformGuideSection,
} from "@/data/uniformGuide";
import { uniformGuideCategorySuggestions } from "@/data/uniformGuide";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Draft = Omit<UniformGuideEntry, "updatedAt" | "updatedBy" | "sortOrder" | "entryKey">;

function newDraft(sectionKey: string): Draft {
  return {
    id: "",
    sectionKey,
    title: "",
    subtitle: "",
    summary: "",
    categories: [{ label: "Uniform", items: [] }],
    notes: [],
    links: [],
    imagePath: null,
    published: false,
  };
}

function itemLines(category: UniformGuideCategory) {
  return category.items.map((item) => item.url ? `${item.text} | ${item.url}` : item.text).join("\n");
}

function parseItemLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.lastIndexOf(" | http");
    if (separator < 0) return { text: line };
    return { text: line.slice(0, separator).trim(), url: line.slice(separator + 3).trim() };
  });
}

function linkLines(links: UniformGuideLink[]) {
  return links.map((link) => `${link.text} | ${link.url}`).join("\n");
}

function parseLinkLines(value: string) {
  return value.split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const separator = line.lastIndexOf(" | http");
    return separator < 0
      ? { text: line, url: "" }
      : { text: line.slice(0, separator).trim(), url: line.slice(separator + 3).trim() };
  });
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function UniformGuideAdminPage() {
  const router = useRouter();
  const [sections, setSections] = useState<UniformGuideSection[]>([]);
  const [revisions, setRevisions] = useState<UniformGuideRevision[]>([]);
  const [activeSection, setActiveSection] = useState("");
  const [access, setAccess] = useState("none");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    const response = await fetch("/api/uniform-guide?admin=1", { credentials: "same-origin", cache: "no-store", headers: await getAppAuthHeaders() });
    const body = await response.json() as { sections?: UniformGuideSection[]; revisions?: UniformGuideRevision[]; error?: string };
    if (!response.ok || !body.sections) throw new Error(body.error || "Failed to load the Uniform Guide");
    setSections(body.sections);
    setRevisions(body.revisions || []);
    setActiveSection((current) => current && body.sections?.some((section) => section.key === current) ? current : body.sections?.[0]?.key || "");
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session) return router.replace("/login");
      if (!hasAppPermission(session, "admin.uniform-guide", "read")) return router.replace("/");
      setAccess(session.permissions["admin.uniform-guide"] || "none");
      try { await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to load the Uniform Guide"); }
      finally { setLoading(false); }
    })();
  }, [load, router]);

  useEffect(() => {
    if (!draft) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [draft]);

  const canEdit = access === "edit" || access === "full";
  const canFull = access === "full";
  const current = sections.find((section) => section.key === activeSection) || sections[0];
  const entries = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!current || !query) return current?.entries || [];
    return current.entries.filter((entry) => [entry.title, entry.subtitle, entry.summary, ...entry.notes].join(" ").toLowerCase().includes(query));
  }, [current, search]);

  async function mutate(payload: Record<string, unknown>, successMessage: string) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/uniform-guide", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify(payload),
      });
      const body = await response.json() as { sections?: UniformGuideSection[]; revisions?: UniformGuideRevision[]; error?: string };
      if (!response.ok || !body.sections) throw new Error(body.error || "Failed to update the Uniform Guide");
      setSections(body.sections);
      setRevisions(body.revisions || []);
      setMessage(successMessage);
      setDraft(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to update the Uniform Guide");
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim()) return setError("Enter a title before saving.");
    if (draft.links.some((link) => !link.text || !link.url)) return setError("External links must use: Label | https://address");
    await mutate({ action: draft.id ? "update" : "create", ...draft }, draft.id ? "Uniform standard updated." : "Uniform standard created.");
  }

  async function uploadImage(file: File) {
    if (!draft?.id) return setError("Save the entry before uploading an image.");
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.set("entryId", draft.id);
      form.set("file", file);
      const response = await fetch("/api/uniform-guide/assets", { method: "POST", credentials: "same-origin", headers: await getAppAuthHeaders(), body: form });
      const body = await response.json() as { imagePath?: string; error?: string };
      if (!response.ok || !body.imagePath) throw new Error(body.error || "Failed to upload image");
      setDraft((currentDraft) => currentDraft ? { ...currentDraft, imagePath: body.imagePath || null } : null);
      await load();
      setMessage("Reference image updated.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Failed to upload image");
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Uniform Guide...</main>;

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/70">
        <header className="flex flex-col gap-5 border-b border-[#00ff66]/20 p-6 lg:flex-row lg:items-end lg:justify-between sm:p-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]"><BookOpenCheck size={16} /> Public Content</div>
            <h1 className="mt-2 text-3xl font-black uppercase">Uniform Guide</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8ba395]">Maintain published uniform and loadout standards. Changes are audited and appear on the public guide immediately.</p>
          </div>
          <div className="flex gap-2">
            <span className="border border-white/10 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#789082]">{access} access</span>
            {canEdit && <button type="button" onClick={() => setDraft(newDraft(current?.key || "recruits"))} className="flex min-h-10 items-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-4 text-xs font-black uppercase tracking-[0.12em] text-[#00ff66] hover:bg-[#00ff66]/15"><Plus size={16} /> Add standard</button>}
          </div>
        </header>

        {(message || error) && <div className={`border-b px-6 py-3 text-sm ${error ? "border-red-400/35 bg-red-950/20 text-red-200" : "border-[#00ff66]/25 bg-[#00ff66]/5 text-[#9dffbd]"}`}>{error || message}</div>}

        <div className="grid min-h-[680px] lg:grid-cols-[220px_minmax(0,1fr)_300px]">
          <nav className="border-b border-[#00ff66]/20 bg-black/45 p-3 lg:border-b-0 lg:border-r" aria-label="Uniform Guide sections">
            <div className="flex gap-1 overflow-x-auto lg:block lg:space-y-1">
              {sections.map((section) => (
                <button key={section.key} type="button" onClick={() => { setActiveSection(section.key); setSearch(""); }}
                  className={`flex min-w-max items-center justify-between gap-4 px-4 py-3 text-left text-xs font-black uppercase tracking-[0.11em] transition lg:w-full ${section.key === current?.key ? "bg-[#00ff66]/12 text-[#00ff66]" : "text-[#789082] hover:bg-white/5 hover:text-white"}`}>
                  {section.label}<span className="text-[9px] opacity-60">{section.entries.length}</span>
                </button>
              ))}
            </div>
          </nav>

          <section className="min-w-0 border-b border-[#00ff66]/20 lg:border-b-0 lg:border-r">
            <div className="border-b border-[#00ff66]/15 p-5">
              <h2 className="text-xl font-black text-white">{current?.label}</h2>
              <p className="mt-1 text-xs leading-5 text-[#789082]">{current?.description}</p>
              <label className="relative mt-4 block">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5f7567]" size={16} />
                <span className="sr-only">Search entries</span>
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search entries"
                  className="h-11 w-full border border-white/12 bg-black pl-10 pr-3 text-sm outline-none placeholder:text-[#506158] focus:border-[#00ff66]/60" />
              </label>
            </div>
            <div className="divide-y divide-[#00ff66]/12">
              {entries.map((entry, index) => (
                <article key={entry.id} className="flex items-center gap-4 p-4 transition hover:bg-[#00ff66]/4 sm:p-5">
                  <div className="relative grid h-16 w-12 shrink-0 place-items-center overflow-hidden border border-white/10 bg-black text-[#506158]">
                    {entry.imagePath ? <Image src={entry.imagePath} alt="" fill sizes="48px" className="object-contain" unoptimized /> : <ImageIcon size={18} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-black text-white">{entry.title}</h3>
                      {!entry.published && <span className="border border-amber-300/30 px-2 py-0.5 text-[8px] font-black uppercase text-amber-300">Draft</span>}
                    </div>
                    <p className="mt-1 truncate text-xs text-[#789082]">{entry.subtitle || `${entry.categories.length} categories`}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {canFull && <>
                      <button type="button" title="Move up" disabled={index === 0 || saving} onClick={() => void mutate({ action: "move", id: entry.id, direction: "up" }, "Entry moved.")} className="grid h-9 w-9 place-items-center border border-white/10 text-gray-400 hover:border-[#00ff66]/40 hover:text-[#00ff66] disabled:opacity-20"><ArrowUp size={15} /></button>
                      <button type="button" title="Move down" disabled={index === entries.length - 1 || saving} onClick={() => void mutate({ action: "move", id: entry.id, direction: "down" }, "Entry moved.")} className="grid h-9 w-9 place-items-center border border-white/10 text-gray-400 hover:border-[#00ff66]/40 hover:text-[#00ff66] disabled:opacity-20"><ArrowDown size={15} /></button>
                    </>}
                    {canEdit && <button type="button" title="Edit standard" onClick={() => setDraft({ ...entry })} className="grid h-9 w-9 place-items-center border border-[#00ff66]/25 text-[#00ff66] hover:bg-[#00ff66]/10"><Pencil size={15} /></button>}
                  </div>
                </article>
              ))}
              {!entries.length && <p className="p-10 text-center text-sm text-[#789082]">No entries match this search.</p>}
            </div>
          </section>

          <aside className="bg-black/30 p-5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.13em] text-[#00ff66]"><Clock3 size={15} /> Recent Changes</div>
            <div className="mt-4 space-y-4">
              {revisions.slice(0, 12).map((revision) => (
                <div key={revision.id} className="border-l border-[#00ff66]/25 pl-3">
                  <p className="text-xs font-bold text-white">{revision.title}</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-cyan-200">{revision.action}</p>
                  <p className="mt-1 text-[10px] leading-4 text-[#65796d]">{revision.changedBy || "Unknown"} · {formatDate(revision.changedAt)}</p>
                </div>
              ))}
              {!revisions.length && <p className="text-xs leading-5 text-[#65796d]">Changes made through this editor will appear here.</p>}
            </div>
          </aside>
        </div>
      </section>

      {draft && (
        <div className="fixed inset-0 z-[160] flex items-end justify-center bg-black/92 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" aria-labelledby="uniform-editor-title">
          <section className="flex max-h-[97vh] w-full max-w-5xl flex-col overflow-hidden border border-[#00ff66]/35 bg-[#020806] sm:max-h-[94vh]">
            <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[#00ff66]/20 bg-black px-5 py-4">
              <div><p className="text-[9px] font-black uppercase tracking-[0.15em] text-[#00ff66]">Uniform Guide Editor</p><h2 id="uniform-editor-title" className="mt-1 text-xl font-black">{draft.id ? `Edit ${draft.title}` : "Add Standard"}</h2></div>
              <button type="button" onClick={() => setDraft(null)} title="Close" className="grid h-10 w-10 place-items-center border border-white/15 text-gray-300 hover:border-red-400/50 hover:text-red-300"><X size={18} /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Title<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#00ff66]/60" /></label>
                <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Section<select value={draft.sectionKey} onChange={(event) => setDraft({ ...draft, sectionKey: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#00ff66]/60">{sections.map((section) => <option key={section.key} value={section.key}>{section.label}</option>)}</select></label>
                <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Subtitle<input value={draft.subtitle} onChange={(event) => setDraft({ ...draft, subtitle: event.target.value })} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm font-normal normal-case tracking-normal text-white outline-none focus:border-[#00ff66]/60" /></label>
                {canFull && <button type="button" onClick={() => setDraft({ ...draft, published: !draft.published })} className={`mt-5 flex h-11 items-center justify-center gap-2 border text-xs font-black uppercase tracking-[0.12em] ${draft.published ? "border-[#00ff66]/45 bg-[#00ff66]/8 text-[#00ff66]" : "border-amber-300/35 bg-amber-300/5 text-amber-300"}`}>{draft.published ? <Eye size={16} /> : <EyeOff size={16} />}{draft.published ? "Published" : "Draft"}</button>}
              </div>
              <label className="mt-4 block text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Summary<textarea rows={3} value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} className="mt-2 w-full resize-y border border-white/15 bg-black p-3 text-sm font-normal normal-case leading-6 tracking-normal text-white outline-none focus:border-[#00ff66]/60" /></label>

              <div className="mt-6 flex items-center justify-between gap-3 border-b border-[#00ff66]/20 pb-3"><h3 className="text-xs font-black uppercase tracking-[0.14em] text-[#00ff66]">Equipment Categories</h3><button type="button" onClick={() => setDraft({ ...draft, categories: [...draft.categories, { label: "Equipment", items: [] }] })} className="flex items-center gap-2 border border-[#00ff66]/30 px-3 py-2 text-[10px] font-black uppercase text-[#00ff66]"><Plus size={14} /> Category</button></div>
              <div className="mt-4 space-y-4">
                {draft.categories.map((category, categoryIndex) => (
                  <section key={categoryIndex} className="border border-white/12 bg-black/35 p-4">
                    <div className="flex gap-2">
                      <input list="uniform-category-suggestions" value={category.label} onChange={(event) => setDraft({ ...draft, categories: draft.categories.map((item, index) => index === categoryIndex ? { ...item, label: event.target.value } : item) })} placeholder="Category name" className="h-10 min-w-0 flex-1 border border-white/15 bg-black px-3 text-sm font-bold outline-none focus:border-[#00ff66]/60" />
                      <button type="button" title="Remove category" onClick={() => setDraft({ ...draft, categories: draft.categories.filter((_, index) => index !== categoryIndex) })} className="grid h-10 w-10 place-items-center border border-red-400/25 text-red-300 hover:bg-red-400/10"><Trash2 size={15} /></button>
                    </div>
                    <textarea rows={5} value={itemLines(category)} onChange={(event) => setDraft({ ...draft, categories: draft.categories.map((item, index) => index === categoryIndex ? { ...item, items: parseItemLines(event.target.value) } : item) })} placeholder="One item per line&#10;Linked item | https://address" className="mt-3 w-full resize-y border border-white/12 bg-black p-3 font-mono text-xs leading-5 outline-none focus:border-[#00ff66]/60" />
                  </section>
                ))}
              </div>
              <datalist id="uniform-category-suggestions">{uniformGuideCategorySuggestions.map((category) => <option key={category} value={category} />)}</datalist>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Additional Notes<textarea rows={5} value={draft.notes.join("\n")} onChange={(event) => setDraft({ ...draft, notes: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean) })} placeholder="One note per line" className="mt-2 w-full resize-y border border-white/15 bg-black p-3 text-sm font-normal normal-case leading-5 tracking-normal outline-none focus:border-[#00ff66]/60" /></label>
                <label className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">External Links<textarea rows={5} value={linkLines(draft.links)} onChange={(event) => setDraft({ ...draft, links: parseLinkLines(event.target.value) })} placeholder="Label | https://address" className="mt-2 w-full resize-y border border-white/15 bg-black p-3 font-mono text-xs font-normal normal-case leading-5 tracking-normal outline-none focus:border-[#00ff66]/60" /></label>
              </div>

              {draft.id && <div className="mt-6 border border-white/12 bg-black/35 p-4"><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#8ba395]">Reference Image</p><div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center"><div className="relative grid h-28 w-24 shrink-0 place-items-center overflow-hidden border border-white/12 bg-black text-[#506158]">{draft.imagePath ? <Image src={draft.imagePath} alt="" fill sizes="96px" className="object-contain" unoptimized /> : <ImageIcon size={22} />}</div><label className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 border border-[#00ff66]/35 px-4 text-xs font-black uppercase tracking-[0.11em] text-[#00ff66] ${uploading ? "pointer-events-none opacity-50" : "hover:bg-[#00ff66]/8"}`}>{uploading ? <Loader2 size={16} className="animate-spin" /> : <ImageUp size={16} />}{uploading ? "Uploading..." : "Upload image"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={uploading} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void uploadImage(file); }} /></label></div></div>}
            </div>
            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-[#00ff66]/20 bg-black p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>{canFull && draft.id && <button type="button" disabled={saving} onClick={() => window.confirm(`Delete ${draft.title}? This will remove it from the public guide.`) && void mutate({ action: "delete", id: draft.id }, "Uniform standard deleted.")} className="flex min-h-11 items-center gap-2 border border-red-400/35 px-4 text-xs font-black uppercase tracking-[0.1em] text-red-300 hover:bg-red-400/10"><Trash2 size={16} /> Delete</button>}</div>
              <div className="flex gap-2"><button type="button" onClick={() => setDraft(null)} className="min-h-11 border border-white/15 px-5 text-xs font-black uppercase tracking-[0.1em] text-gray-300">Cancel</button><button type="button" disabled={saving || uploading} onClick={() => void saveDraft()} className="flex min-h-11 items-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-5 text-xs font-black uppercase tracking-[0.1em] text-[#00ff66] disabled:opacity-40">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save standard</button></div>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
