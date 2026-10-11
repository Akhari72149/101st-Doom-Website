"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlignCenter, AlignLeft, AlignRight, Bold, BookOpenText, Clock3, ExternalLink, Eye,
  FilePlus2, Italic, Link2, List, ListOrdered, Loader2, Pencil, Redo2, Save, Search, Trash2, Underline, Undo2, X,
} from "lucide-react";
import DocumentRenderer from "@/components/documents/DocumentRenderer";
import type { SiteDocument, SiteDocumentRevision } from "@/data/siteDocuments";
import { documentFonts, documentFontSizes, documentLibrarySections, documentWordCount } from "@/data/siteDocuments";
import { documentToEditorHtml, editorHtmlToDocument } from "@/lib/document-editor";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Draft = Pick<SiteDocument, "id" | "slug" | "title" | "summary" | "category" | "content" | "sourceUrl" | "published">;

function blankDraft(): Draft { return { id: "", slug: "", title: "", summary: "", category: "General", content: [{ type: "heading1", align: "left", runs: [{ text: "New document" }] }, { type: "paragraph", align: "left", runs: [{ text: "Start writing here." }] }], sourceUrl: null, published: false }; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }

export default function DocumentsAdminPage() {
  const router = useRouter();
  const editorRef = useRef<HTMLDivElement>(null);
  const [documents, setDocuments] = useState<SiteDocument[]>([]);
  const [revisions, setRevisions] = useState<SiteDocumentRevision[]>([]);
  const [access, setAccess] = useState("none");
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preview, setPreview] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/site-documents?admin=1", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
    const body = await response.json() as { documents?: SiteDocument[]; revisions?: SiteDocumentRevision[]; error?: string };
    if (!response.ok || !body.documents) throw new Error(body.error || "Failed to load documents");
    setDocuments(body.documents); setRevisions(body.revisions || []);
  }, []);

  useEffect(() => { void (async () => {
    const session = await getAppSession();
    if (!session) return router.replace("/login");
    if (!hasAppPermission(session, "admin.documents", "read")) return router.replace("/");
    setAccess(session.permissions["admin.documents"] || "none");
    try { await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to load documents"); } finally { setLoading(false); }
  })(); }, [load, router]);

  useEffect(() => {
    if (!draft || preview || !editorRef.current) return;
    editorRef.current.innerHTML = documentToEditorHtml(draft.content);
    // Re-initialize only when another document is selected or preview closes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.id, preview]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const canEdit = access === "edit" || access === "full";
  const canFull = access === "full";
  const visible = useMemo(() => { const query = search.trim().toLowerCase(); return query ? documents.filter((item) => [item.title,item.summary,item.category].join(" ").toLowerCase().includes(query)) : documents; }, [documents, search]);

  function selectDocument(item: SiteDocument) { setDraft({ id:item.id,slug:item.slug,title:item.title,summary:item.summary,category:item.category,content:item.content,sourceUrl:item.sourceUrl,published:item.published }); setPreview(!canEdit); setError(""); setMessage(""); }
  function syncEditor() { if (!draft || !editorRef.current || preview) return draft?.content || []; const content = editorHtmlToDocument(editorRef.current.innerHTML); setDraft({ ...draft, content }); return content; }
  function command(name: string, value?: string) { editorRef.current?.focus(); document.execCommand(name, false, value); }
  function addLink() { const url = window.prompt("Enter the full https:// link"); if (url) command("createLink", url); }
  function setBlock(tag: string) { command("formatBlock", tag); }

  async function mutate(payload: Record<string, unknown>, success: string) {
    setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/site-documents", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify(payload) });
      const body = await response.json() as { documents?: SiteDocument[]; revisions?: SiteDocumentRevision[]; error?: string };
      if (!response.ok || !body.documents) throw new Error(body.error || "Failed to update the document");
      setDocuments(body.documents); setRevisions(body.revisions || []); setMessage(success);
      const current = body.documents.find((item) => item.id === payload.id || item.slug === payload.slug);
      if (current) selectDocument(current); else setDraft(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Failed to update the document"); }
    finally { setSaving(false); }
  }

  async function save() {
    if (!draft) return;
    const content = syncEditor();
    if (!draft.title.trim() || !content.length) return setError("Enter a title and some document content before saving.");
    await mutate({ action: draft.id ? "update" : "create", ...draft, content }, draft.id ? "Document saved and revision recorded." : "Document created.");
  }

  async function remove() {
    if (!draft?.id || !window.confirm(`Delete ${draft.title}? Its revision history will be retained.`)) return;
    await mutate({ action: "delete", id: draft.id }, "Document deleted.");
  }

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading Document Library...</main>;
  return (
    <main className="min-h-screen bg-[#020806] px-4 py-10 text-white sm:px-8">
      <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/70">
        <header className="grid gap-7 border-b border-[#00ff66]/20 p-7 lg:grid-cols-[1fr_auto] lg:items-end sm:p-10">
          <div><div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#00ff66]"><BookOpenText size={16} /> Public Content</div><h1 className="mt-3 text-3xl font-black uppercase sm:text-4xl">Document Library</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[#8ba395]">Maintain official website documents with controlled formatting, publishing status, and a permanent revision trail.</p></div>
          <button type="button" onClick={() => { setOpen(true); setDraft(null); }} className="flex min-h-12 items-center justify-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-5 text-xs font-black uppercase tracking-[0.12em] text-[#00ff66] hover:bg-[#00ff66]/15"><BookOpenText size={17} /> Open library</button>
        </header>
        {(message || error) && <div className={`border-b px-7 py-3 text-sm ${error ? "border-red-400/35 bg-red-950/20 text-red-200" : "border-[#00ff66]/25 bg-[#00ff66]/5 text-[#9dffbd]"}`}>{error || message}</div>}
        <div className="grid gap-px bg-[#00ff66]/15 sm:grid-cols-3">
          <div className="bg-[#03100b] p-6"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6e8376]">Managed documents</div><div className="mt-2 text-3xl font-black text-[#00ff66]">{documents.length}</div></div>
          <div className="bg-[#03100b] p-6"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6e8376]">Published</div><div className="mt-2 text-3xl font-black text-cyan-200">{documents.filter((item) => item.published).length}</div></div>
          <div className="bg-[#03100b] p-6"><div className="text-[10px] font-black uppercase tracking-[0.15em] text-[#6e8376]">Your access</div><div className="mt-3 text-sm font-black uppercase text-white">{access}</div></div>
        </div>
        <div className="p-7 sm:p-10"><div className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#00ff66]"><Clock3 size={15} /> Recent changes</div><div className="divide-y divide-white/8 border border-white/10">{revisions.slice(0,5).map((revision) => <div key={revision.id} className="flex flex-wrap justify-between gap-2 px-4 py-3 text-xs"><span className="text-white"><strong>{revision.title}</strong> · {revision.action}</span><span className="text-[#728579]">{revision.changedBy || "System"} · {formatDate(revision.changedAt)}</span></div>)}{!revisions.length && <p className="p-5 text-sm text-[#728579]">No document changes have been recorded yet.</p>}</div></div>
      </section>

      {open && <div className="fixed inset-0 z-[160] flex bg-black/92 p-0 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true">
        <section className="mx-auto flex h-full w-full max-w-[1500px] flex-col border border-[#00ff66]/30 bg-[#020806] sm:h-[94vh]">
          <header className="flex min-h-16 items-center justify-between gap-3 border-b border-[#00ff66]/20 px-4 sm:px-6"><div className="min-w-0"><div className="text-[9px] font-black uppercase tracking-[0.16em] text-[#00ff66]">Document workspace</div><h2 className="truncate text-lg font-black">{draft ? draft.title || "New document" : "Library"}</h2></div><button type="button" title="Close library" onClick={() => { setOpen(false); setDraft(null); }} className="grid h-10 w-10 shrink-0 place-items-center border border-white/10 text-gray-400 hover:border-red-400/40 hover:text-red-300"><X size={18} /></button></header>

          {!draft ? <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-col gap-3 border-b border-[#00ff66]/15 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6"><label className="relative block w-full max-w-lg"><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#5d7166]" size={16}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search documents" className="h-11 w-full border border-white/12 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60" /></label>{canFull && <button type="button" onClick={() => { setDraft(blankDraft()); setPreview(false); }} className="flex h-11 items-center justify-center gap-2 border border-[#00ff66]/35 px-4 text-xs font-black uppercase text-[#00ff66] hover:bg-[#00ff66]/10"><FilePlus2 size={16}/> New document</button>}</div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6"><div className="grid gap-3 lg:grid-cols-2">{visible.map((item) => <button key={item.id} type="button" onClick={() => selectDocument(item)} className="group grid grid-cols-[1fr_auto] gap-4 border border-white/10 bg-black/45 p-5 text-left hover:border-[#00ff66]/45 hover:bg-[#00ff66]/5"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-white group-hover:text-[#00ff66]">{item.title}</h3><span className={`border px-2 py-0.5 text-[8px] font-black uppercase ${item.published ? "border-[#00ff66]/25 text-[#00ff66]" : "border-amber-300/25 text-amber-300"}`}>{item.published ? "Published" : "Draft"}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#788d80]">{item.summary || "No summary"}</p><div className="mt-3 text-[9px] font-black uppercase tracking-[0.12em] text-[#53645a]">{item.category} · {documentWordCount(item.content)} words · {formatDate(item.updatedAt)}</div></div><Pencil size={16} className="mt-1 text-[#607369] group-hover:text-[#00ff66]"/></button>)}</div></div>
          </div> : <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#00ff66]/15 bg-black/50 p-3 sm:px-5"><button type="button" onClick={() => { syncEditor(); setDraft(null); setPreview(false); }} className="h-9 border border-white/12 px-3 text-[10px] font-black uppercase text-gray-300 hover:border-[#00ff66]/40">Back to library</button><span className="mx-1 h-6 w-px bg-white/10" />
              {!preview && canEdit && <><button title="Undo" onClick={() => command("undo")} className="tool-button"><Undo2 size={15}/></button><button title="Redo" onClick={() => command("redo")} className="tool-button"><Redo2 size={15}/></button><select title="Text style" onChange={(event) => setBlock(event.target.value)} defaultValue="p" className="tool-select"><option value="p">Paragraph</option><option value="h2">Heading 1</option><option value="h3">Heading 2</option><option value="h4">Heading 3</option></select><select title="Font" onChange={(event) => command("fontName", event.target.value)} defaultValue="Orbitron" className="tool-select">{documentFonts.map((font) => <option key={font}>{font}</option>)}</select><select title="Font size" onChange={(event) => { const size=Number(event.target.value); const legacy=[8,10,12,14,18,24,36].reduce((best,value,index,array)=>Math.abs(value-size)<Math.abs(array[best]-size)?index:best,0)+1; command("fontSize",String(legacy)); }} defaultValue="14" className="tool-select">{documentFontSizes.map((size) => <option key={size} value={size}>{size}px</option>)}</select><button title="Bold" onClick={() => command("bold")} className="tool-button"><Bold size={15}/></button><button title="Italic" onClick={() => command("italic")} className="tool-button"><Italic size={15}/></button><button title="Underline" onClick={() => command("underline")} className="tool-button"><Underline size={15}/></button><button title="Bulleted list" onClick={() => command("insertUnorderedList")} className="tool-button"><List size={15}/></button><button title="Numbered list" onClick={() => command("insertOrderedList")} className="tool-button"><ListOrdered size={15}/></button><button title="Align left" onClick={() => command("justifyLeft")} className="tool-button"><AlignLeft size={15}/></button><button title="Align centre" onClick={() => command("justifyCenter")} className="tool-button"><AlignCenter size={15}/></button><button title="Align right" onClick={() => command("justifyRight")} className="tool-button"><AlignRight size={15}/></button><button title="Add link" onClick={addLink} className="tool-button"><Link2 size={15}/></button></>}
              <button type="button" onClick={() => { if (!preview) syncEditor(); setPreview((value) => !value); }} className="ml-auto flex h-9 items-center gap-2 border border-cyan-300/25 px-3 text-[10px] font-black uppercase text-cyan-200">{preview ? <Pencil size={14}/> : <Eye size={14}/>} {preview ? "Edit" : "Preview"}</button>
            </div>
            <div className="grid min-h-0 flex-1 lg:grid-cols-[320px_minmax(0,1fr)]"><aside className="overflow-y-auto border-b border-[#00ff66]/15 p-4 lg:border-b-0 lg:border-r sm:p-5"><label className="field-label">Document name<input value={draft.title} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, title:event.target.value })} className="field-input" /></label><label className="field-label">Address<input value={draft.slug} disabled={!canFull || Boolean(draft.id)} onChange={(event) => setDraft({ ...draft, slug:event.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-") })} className="field-input" /></label><label className="field-label">Documents tab<select value={draft.category} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, category:event.target.value as Draft["category"] })} className="field-input">{documentLibrarySections.map((section) => <option key={section} value={section}>{section}</option>)}</select></label><p className="-mt-2 mb-4 text-[10px] leading-4 text-[#607369]">Published documents appear automatically under this tab on the public Documents page.</p><label className="field-label">Summary<textarea value={draft.summary} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, summary:event.target.value })} rows={5} className="field-input resize-none py-3" /></label><label className="field-label">Original source<input value={draft.sourceUrl || ""} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, sourceUrl:event.target.value || null })} className="field-input" /></label>{canFull && <label className="mt-5 flex items-center gap-3 border border-white/10 p-3 text-xs font-bold"><input type="checkbox" checked={draft.published} onChange={(event) => setDraft({ ...draft, published:event.target.checked })} className="h-4 w-4 accent-[#00ff66]" /> Published on the website</label>}{draft.sourceUrl && <a href={draft.sourceUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-100">View source <ExternalLink size={13}/></a>}</aside>
              <section className="min-h-0 overflow-y-auto bg-[#03100b] p-3 sm:p-6">{preview ? <div className="mx-auto min-h-full max-w-4xl border border-[#00ff66]/20 bg-black/65 p-5 sm:p-10"><DocumentRenderer content={draft.content}/></div> : <div ref={editorRef} contentEditable={canEdit} suppressContentEditableWarning role="textbox" aria-multiline="true" className="document-editor mx-auto min-h-full max-w-4xl border border-[#00ff66]/20 bg-black/75 p-5 text-sm leading-7 text-[#d5e1d8] outline-none focus:border-[#00ff66]/55 sm:p-10" />}</section></div>
            {(error || message) && <div className={`border-t px-5 py-2 text-xs ${error ? "border-red-400/30 text-red-200" : "border-[#00ff66]/20 text-[#9dffbd]"}`}>{error || message}</div>}
            <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#00ff66]/20 bg-black px-4 py-3 sm:px-6"><div className="text-[10px] font-black uppercase tracking-[0.12em] text-[#65786d]">{draft.id ? `Last saved document · ${draft.published ? "Published" : "Draft"}` : "Unsaved document"}</div><div className="flex gap-2">{canFull && draft.id && <button type="button" disabled={saving} onClick={() => void remove()} className="flex h-10 items-center gap-2 border border-red-400/25 px-3 text-[10px] font-black uppercase text-red-300 hover:bg-red-950/25"><Trash2 size={14}/> Delete</button>}{canEdit && <button type="button" disabled={saving} onClick={() => void save()} className="flex h-10 items-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/10 px-4 text-[10px] font-black uppercase text-[#00ff66] hover:bg-[#00ff66]/15 disabled:opacity-40">{saving ? <Loader2 size={14} className="animate-spin"/> : <Save size={14}/>} Save document</button>}</div></footer>
          </div>}
        </section>
      </div>}
      <style jsx global>{`.tool-button{display:grid;height:36px;width:36px;place-items:center;border:1px solid rgba(255,255,255,.12);color:#a6b5ac;background:#000}.tool-button:hover{border-color:rgba(0,255,102,.5);color:#00ff66}.tool-select{height:36px;border:1px solid rgba(255,255,255,.12);background:#000;padding:0 8px;font-size:10px;color:#d5e1d8;outline:none}.field-label{display:block;margin-bottom:16px;font-size:9px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:#6d8175}.field-input{margin-top:7px;display:block;height:42px;width:100%;border:1px solid rgba(255,255,255,.12);background:#000;padding:0 12px;font-size:12px;color:white;outline:none}.field-input:focus{border-color:rgba(0,255,102,.55)}.document-editor h2{margin:24px 0 12px;font-size:26px;font-weight:900;color:white}.document-editor h3{margin:20px 0 10px;font-size:21px;font-weight:900;color:#00ff66}.document-editor h4{margin:18px 0 8px;font-size:16px;font-weight:900;color:#a5f3fc}.document-editor p{margin:8px 0}.document-editor ul,.document-editor ol{margin:10px 0;padding-left:28px}.document-editor ul{list-style:square}.document-editor ol{list-style:decimal}.document-editor a{color:#67e8f9;text-decoration:underline}.document-editor hr{margin:24px 0;border:0;border-top:1px solid rgba(0,255,102,.3)}`}</style>
    </main>
  );
}
