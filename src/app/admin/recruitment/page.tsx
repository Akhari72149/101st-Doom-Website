"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, ClipboardList, Eye, FilePenLine, Plus, Save, Search, Trash2, X } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";
import type { RecruitmentBlock, RecruitmentStatus } from "@/lib/recruitment";

type ResponseRecord = {
  id: string;
  answers: Record<string, string | string[]>;
  service_number: string;
  nickname: string;
  discord_name: string;
  selected_platoons: string[];
  status: RecruitmentStatus;
  internal_notes: string;
  submitted_at: string;
  updated_at: string;
  processed_by_name: string | null;
};

const statuses: Array<{ value: RecruitmentStatus; label: string }> = [
  { value: "new", label: "New" }, { value: "contacted", label: "Contacted" },
  { value: "accepted", label: "Accepted" }, { value: "archived", label: "Archived" },
];

export default function RecruitmentAdminPage() {
  const router = useRouter();
  const [view, setView] = useState<"responses" | "form">("responses");
  const [responses, setResponses] = useState<ResponseRecord[]>([]);
  const [blocks, setBlocks] = useState<RecruitmentBlock[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<RecruitmentStatus | "active" | "all">("active");
  const [selected, setSelected] = useState<ResponseRecord | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/recruitment", { headers: await getAppAuthHeaders(), cache: "no-store" });
      const body = await response.json() as { blocks?: RecruitmentBlock[]; responses?: ResponseRecord[]; canEdit?: boolean; canFull?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load recruitment administration");
      setBlocks(body.blocks || []); setResponses(body.responses || []); setCanEdit(Boolean(body.canEdit)); setCanFull(Boolean(body.canFull));
      setSelected((current) => current ? (body.responses || []).find((item) => item.id === current.id) || null : null);
      setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to load recruitment administration"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void (async () => {
    const session = await getAppSession();
    if (!session) return router.replace("/login");
    if (!hasAppPermission(session, "admin.recruitment", "read")) return router.replace("/");
    await load();
  })(); }, [load, router]);

  const filtered = useMemo(() => responses.filter((item) => {
    const statusMatch = filter === "all" || (filter === "active" ? item.status !== "archived" : item.status === filter);
    const query = search.trim().toLowerCase();
    return statusMatch && (!query || `${item.nickname} ${item.service_number} ${item.discord_name} ${item.selected_platoons.join(" ")}`.toLowerCase().includes(query));
  }), [filter, responses, search]);

  async function updateResponse(item: ResponseRecord) {
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/recruitment", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify({ id: item.id, status: item.status, internalNotes: item.internal_notes }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Unable to update response");
      setNotice("Recruitment response updated and audited."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to update response"); }
    finally { setSaving(false); }
  }

  async function deleteResponse(item: ResponseRecord) {
    if (!canFull || !window.confirm(`Permanently delete ${item.nickname}'s recruitment response? This cannot be undone.`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/admin/recruitment", { method: "DELETE", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify({ id: item.id }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Unable to delete response");
      setSelected(null); setNotice("Recruitment response permanently deleted."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to delete response"); }
    finally { setSaving(false); }
  }

  async function saveForm() {
    if (!canFull) return; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/recruitment", { method: "PUT", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify({ blocks }) });
      const body = await response.json() as { error?: string }; if (!response.ok) throw new Error(body.error || "Unable to save form");
      setNotice("Recruitment form published."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to save form"); }
    finally { setSaving(false); }
  }

  function patchBlock(index: number, patch: Partial<RecruitmentBlock>) { setBlocks((current) => current.map((block, i) => i === index ? { ...block, ...patch } : block)); }
  function moveBlock(index: number, direction: -1 | 1) { setBlocks((current) => { const next = [...current]; const target = index + direction; if (target < 0 || target >= next.length) return current; [next[index], next[target]] = [next[target], next[index]]; return next; }); }
  function addBlock(type: "information" | "question") { setBlocks((current) => [...current, { id: `new-${crypto.randomUUID()}`, block_type: type, field_key: type === "question" ? `question_${Date.now()}` : null, title: type === "question" ? "New question" : "New information section", description: "", input_type: type === "question" ? "text" : null, options: [], required: false, active: true, sort_order: (current.length + 1) * 10 }]); }

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading recruitment administration...</main>;

  return <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-[1500px]">
      <header className="border border-[#00ff66]/25 bg-black/65 p-6 sm:p-8"><p className="text-xs font-black uppercase tracking-[.2em] text-[#00ff66]">Personnel intake</p><div className="mt-2 flex flex-wrap items-end justify-between gap-5"><div><h1 className="text-3xl font-black uppercase sm:text-5xl">Recruitment</h1><p className="mt-3 max-w-3xl text-[#8ba095]">Review applications, record contact progress, archive completed entries, and maintain the public form.</p></div><a href="/recruitment" target="_blank" className="flex h-11 items-center gap-2 border border-cyan-300/40 px-5 text-xs font-black uppercase text-cyan-200"><Eye size={16}/>View public form</a></div></header>
      {(error || notice) && <div className={`mt-4 border px-5 py-4 ${error ? "border-red-500/40 bg-red-950/25 text-red-200" : "border-[#00ff66]/30 bg-[#00ff66]/8 text-[#00ff66]"}`}>{error || notice}</div>}
      <div className="mt-5 grid grid-cols-2 border border-[#00ff66]/20"><button onClick={() => setView("responses")} className={`flex h-14 items-center justify-center gap-2 font-black uppercase ${view === "responses" ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#73877c]"}`}><ClipboardList size={18}/>Responses</button><button onClick={() => setView("form")} className={`flex h-14 items-center justify-center gap-2 font-black uppercase ${view === "form" ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#73877c]"}`}><FilePenLine size={18}/>Form editor</button></div>

      {view === "responses" ? <>
        <section className="mt-4 grid gap-3 border border-white/10 bg-black/55 p-4 lg:grid-cols-[1fr_240px]"><label className="flex items-center gap-3 border border-white/15 bg-black px-4"><Search size={18} className="text-[#00ff66]"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search nickname, number, Discord or platoon" className="h-12 min-w-0 flex-1 bg-transparent outline-none" /></label><select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)} className="h-12 border border-white/15 bg-black px-4"><option value="active">Active responses</option><option value="all">All responses</option>{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></section>
        <section className="mt-4 overflow-hidden border border-white/10 bg-black/55"><div className="grid grid-cols-[1fr_auto] border-b border-white/10 px-5 py-3 text-xs font-black uppercase tracking-[.15em] text-[#73877c]"><span>{filtered.length} responses</span><span>Status</span></div>{filtered.length ? filtered.map((item) => <button key={item.id} onClick={() => setSelected(item)} className="grid w-full gap-3 border-b border-white/10 px-5 py-4 text-left last:border-0 hover:bg-[#00ff66]/5 sm:grid-cols-[1fr_160px_180px_auto] sm:items-center"><span><strong className="block text-lg text-white">{item.nickname}</strong><small className="text-[#71877b]">{item.service_number} · {item.discord_name}</small></span><span className="text-sm text-[#9ab0a4]">{item.selected_platoons.length} platoon{item.selected_platoons.length === 1 ? "" : "s"}</span><span className="text-sm text-[#71877b]">{new Date(item.submitted_at).toLocaleString()}</span><Status value={item.status}/></button>) : <div className="p-12 text-center text-[#71877b]">No recruitment responses match this view.</div>}</section>
      </> : <section className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border border-white/10 bg-black/60 p-4"><div><h2 className="font-black uppercase">Published form blocks</h2><p className="mt-1 text-sm text-[#71877b]">Full recruitment access is required to publish changes.</p></div>{canFull && <div className="flex flex-wrap gap-2"><button onClick={() => addBlock("information")} className="flex h-10 items-center gap-2 border border-cyan-300/35 px-4 text-sm text-cyan-200"><Plus size={15}/>Information</button><button onClick={() => addBlock("question")} className="flex h-10 items-center gap-2 border border-violet-300/35 px-4 text-sm text-violet-200"><Plus size={15}/>Question</button><button onClick={saveForm} disabled={saving} className="flex h-10 items-center gap-2 bg-[#00ff66] px-5 font-black text-black disabled:opacity-50"><Save size={15}/>{saving ? "Saving..." : "Publish form"}</button></div>}</div>
        <div className="mt-3 space-y-3">{blocks.map((block, index) => <BlockEditor key={block.id} block={block} disabled={!canFull} first={index === 0} last={index === blocks.length - 1} onPatch={(patch) => patchBlock(index, patch)} onMove={(direction) => moveBlock(index, direction)} onRemove={() => setBlocks((current) => current.filter((_, i) => i !== index))}/>)}</div>
      </section>}
    </div>
    {selected && <ResponseModal item={selected} blocks={blocks} canEdit={canEdit} canFull={canFull} saving={saving} onClose={() => setSelected(null)} onChange={setSelected} onSave={updateResponse} onDelete={deleteResponse}/>} 
  </main>;
}

function Status({ value }: { value: RecruitmentStatus }) { const style = value === "accepted" ? "border-[#00ff66]/40 text-[#00ff66]" : value === "archived" ? "border-gray-600 text-gray-400" : value === "contacted" ? "border-cyan-400/40 text-cyan-200" : "border-yellow-400/40 text-yellow-200"; return <span className={`border px-3 py-1 text-xs font-black uppercase ${style}`}>{value}</span>; }

function ResponseModal({ item, blocks, canEdit, canFull, saving, onClose, onChange, onSave, onDelete }: { item: ResponseRecord; blocks: RecruitmentBlock[]; canEdit: boolean; canFull: boolean; saving: boolean; onClose: () => void; onChange: (item: ResponseRecord) => void; onSave: (item: ResponseRecord) => void; onDelete: (item: ResponseRecord) => void }) {
  return <div className="fixed inset-0 z-[100] flex justify-end bg-black/85" role="dialog" aria-modal="true"><div className="flex h-full w-full max-w-3xl flex-col border-l border-[#00ff66]/25 bg-[#020806]"><header className="flex items-start justify-between border-b border-white/10 p-5 sm:p-6"><div><p className="text-xs font-black uppercase tracking-[.18em] text-[#00ff66]">Recruitment response</p><h2 className="mt-2 text-3xl font-black">{item.nickname}</h2><p className="mt-1 text-[#71877b]">{item.service_number} · {item.discord_name}</p></div><button onClick={onClose} className="border border-white/15 p-3"><X/></button></header><div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6"><div className="grid gap-3 sm:grid-cols-2">{blocks.filter((block) => block.block_type === "question" && block.field_key).map((block) => { const answer = item.answers[block.field_key as string]; return <div key={block.id} className="border border-white/10 bg-black/50 p-4"><p className="text-xs font-black uppercase text-[#71877b]">{block.title}</p><p className="mt-2 whitespace-pre-wrap text-white">{Array.isArray(answer) ? answer.join("\n") : answer || "Not answered"}</p></div>; })}</div><div className="mt-5 grid gap-4 sm:grid-cols-[220px_1fr]"><label><span className="mb-2 block text-xs font-black uppercase text-[#71877b]">Status</span><select disabled={!canEdit} value={item.status} onChange={(event) => onChange({ ...item, status: event.target.value as RecruitmentStatus })} className="h-12 w-full border border-white/15 bg-black px-3 disabled:opacity-60">{statuses.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label><label><span className="mb-2 block text-xs font-black uppercase text-[#71877b]">Internal notes</span><textarea disabled={!canEdit} value={item.internal_notes} onChange={(event) => onChange({ ...item, internal_notes: event.target.value })} rows={5} className="w-full border border-white/15 bg-black p-3 disabled:opacity-60" /></label></div>{item.processed_by_name && <p className="mt-3 text-xs text-[#71877b]">Last processed by {item.processed_by_name}</p>}</div><footer className="flex flex-wrap justify-between gap-3 border-t border-white/10 p-5">{canFull ? <button onClick={() => onDelete(item)} disabled={saving} className="flex items-center gap-2 border border-red-500/40 px-4 py-3 font-bold text-red-300"><Trash2 size={16}/>Delete permanently</button> : <span/>}<div className="flex gap-2"><button onClick={onClose} className="border border-white/15 px-5 py-3">Close</button>{canEdit && <button onClick={() => onSave(item)} disabled={saving} className="flex items-center gap-2 bg-[#00ff66] px-5 py-3 font-black text-black"><Save size={16}/>{saving ? "Saving..." : "Save response"}</button>}</div></footer></div></div>;
}

function BlockEditor({ block, disabled, first, last, onPatch, onMove, onRemove }: { block: RecruitmentBlock; disabled: boolean; first: boolean; last: boolean; onPatch: (patch: Partial<RecruitmentBlock>) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const choices = ["yes_no", "single_choice", "multi_choice"].includes(block.input_type || "");
  return <article className={`border p-4 ${block.active ? "border-[#00ff66]/20 bg-black/55" : "border-white/10 bg-black/30 opacity-70"}`}><div className="grid gap-3 lg:grid-cols-[auto_1fr_190px_auto]"><div className="flex lg:flex-col"><button disabled={disabled || first} onClick={() => onMove(-1)} className="border border-white/10 p-2 disabled:opacity-20"><ChevronUp size={16}/></button><button disabled={disabled || last} onClick={() => onMove(1)} className="border border-white/10 p-2 disabled:opacity-20"><ChevronDown size={16}/></button></div><div className="space-y-3"><input disabled={disabled} value={block.title} onChange={(event) => onPatch({ title: event.target.value })} className="h-11 w-full border border-white/15 bg-black px-3 font-bold"/><textarea disabled={disabled} value={block.description} onChange={(event) => onPatch({ description: event.target.value })} rows={2} placeholder="Description or guidance" className="w-full border border-white/15 bg-black p-3 text-sm"/>{block.block_type === "question" && <div className="grid gap-2 sm:grid-cols-2"><input disabled={disabled || ["service_number","nickname","discord_name","platoons"].includes(block.field_key || "")} value={block.field_key || ""} onChange={(event) => onPatch({ field_key: event.target.value })} placeholder="field_key" className="h-10 border border-white/15 bg-black px-3 text-sm"/><select disabled={disabled} value={block.input_type || "text"} onChange={(event) => onPatch({ input_type: event.target.value as RecruitmentBlock["input_type"] })} className="h-10 border border-white/15 bg-black px-3 text-sm"><option value="text">Short text</option><option value="textarea">Long text</option><option value="yes_no">Yes / No</option><option value="single_choice">Single choice</option><option value="multi_choice">Multiple choice</option></select></div>}{block.block_type === "question" && choices && block.input_type !== "yes_no" && <textarea disabled={disabled} value={block.options.join("\n")} onChange={(event) => onPatch({ options: event.target.value.split("\n") })} rows={4} placeholder="One option per line" className="w-full border border-violet-300/20 bg-black p-3 text-sm"/>}</div><div className="space-y-2"><span className="block text-xs font-black uppercase text-[#71877b]">{block.block_type === "question" ? "Question" : "Information"}</span><label className="flex h-10 items-center gap-2 border border-white/10 px-3"><input disabled={disabled} type="checkbox" checked={block.active} onChange={(event) => onPatch({ active: event.target.checked })}/>Published</label>{block.block_type === "question" && <label className="flex h-10 items-center gap-2 border border-white/10 px-3"><input disabled={disabled} type="checkbox" checked={block.required} onChange={(event) => onPatch({ required: event.target.checked })}/>Required</label>}</div><button disabled={disabled || ["service_number","nickname","discord_name","platoons"].includes(block.field_key || "")} onClick={onRemove} className="self-start border border-red-500/30 p-3 text-red-300 disabled:opacity-20" aria-label="Remove block"><Trash2 size={17}/></button></div></article>;
}
