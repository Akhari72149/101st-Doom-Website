"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, Check, ChevronRight, ClipboardCheck, ExternalLink,
  FileWarning, Gavel, Loader2, Plus, Search, X,
} from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Certification = { id: string; name: string; discordRoleId: string | null };
type Person = { id: string; name: string; status: string | null; birth_number: string | null; certifications: Certification[] };
type CatalogAction = { id: string; slug: string; name: string; category: "formal" | "community"; description: string | null; active: boolean };
type CaseAction = { id: string; action_name: string; action_category: string; status: "pending" | "completed"; target_data: { certificationIds?: string[] }; completion_notes: string | null; completed_at: string | null; slug: string | null };
type Appeal = { id: string; document_url: string; notes: string | null; status: string; submitted_by_name: string; reviewed_by_name: string | null; review_notes: string | null; submitted_at: string; reviewed_at: string | null };
type CaseEvent = { id: string; event_type: string; details: string; actor_name: string; created_at: string };
type DisciplineCase = {
  id: string; reference: string; personnel_id: string; personnel_name: string; birth_number: string | null;
  case_kind: "warning" | "da"; status: string; effective_status: string; incident_on: string;
  summary: string; reason: string; expires_at: string | null; issued_by: string; issuer_name: string;
  approved_by: string | null; approver_name: string | null; approved_at: string | null;
  void_reason: string | null; created_at: string; active_warning_count: number;
  actions: CaseAction[]; appeals: Appeal[]; evidence: { id: string; label: string; url: string }[]; events: CaseEvent[];
};
type Payload = { currentUserId: string; access: "read" | "edit" | "full"; personnel: Person[]; catalog: CatalogAction[]; cases: DisciplineCase[] };
type Tab = "active" | "approval" | "appeals" | "archive" | "catalog";

const date = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));
const dateTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
const labelStatus = (value: string) => value.replaceAll("_", " ");

export default function DisciplinePage() {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [tab, setTab] = useState<Tab>("active");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [issuing, setIssuing] = useState(false);
  const [selected, setSelected] = useState<DisciplineCase | null>(null);
  const [caseKind, setCaseKind] = useState<"warning" | "da">("warning");
  const [personnelId, setPersonnelId] = useState("");
  const [incidentOn, setIncidentOn] = useState(new Date().toISOString().slice(0, 10));
  const [expiresAt, setExpiresAt] = useState("");
  const [summary, setSummary] = useState("");
  const [reason, setReason] = useState("");
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [appealUrl, setAppealUrl] = useState("");
  const [newActionName, setNewActionName] = useState("");
  const [newActionDescription, setNewActionDescription] = useState("");
  const [newActionCategory, setNewActionCategory] = useState<"formal" | "community">("formal");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/discipline", { cache: "no-store", headers: await getAppAuthHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load disciplinary records");
    setData(body);
    setSelected((current) => current ? body.cases.find((item: DisciplineCase) => item.id === current.id) || null : null);
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.discipline", "read")) return router.replace(session ? "/" : "/login");
      try { await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Failed to load records"); }
      finally { setLoading(false); }
    })();
  }, [load, router]);

  const canEdit = data?.access === "edit" || data?.access === "full";
  const canFull = data?.access === "full";
  const person = data?.personnel.find((item) => item.id === personnelId);
  const stripsTags = data?.catalog.some((item) => item.slug === "strip-tags" && selectedActions.includes(item.id));
  const counts = useMemo(() => ({
    warnings: data?.cases.filter((item) => item.case_kind === "warning" && item.effective_status === "active").length || 0,
    das: data?.cases.filter((item) => item.case_kind === "da" && item.status === "active").length || 0,
    approval: data?.cases.filter((item) => item.status === "pending_approval").length || 0,
    appeals: data?.cases.filter((item) => item.status === "appealed").length || 0,
  }), [data]);
  const visibleCases = useMemo(() => (data?.cases || []).filter((item) => {
    const text = `${item.reference} ${item.personnel_name} ${item.summary}`.toLowerCase();
    if (query && !text.includes(query.toLowerCase())) return false;
    if (tab === "active") return item.effective_status === "active";
    if (tab === "approval") return item.status === "pending_approval";
    if (tab === "appeals") return item.status === "appealed";
    if (tab === "archive") return ["expired", "overturned", "voided"].includes(item.effective_status);
    return false;
  }), [data, query, tab]);

  async function mutate(operation: string, values: Record<string, unknown>) {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/admin/discipline", {
        method: "POST", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ operation, ...values }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Update failed");
      await load();
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Update failed"); return false; }
    finally { setSaving(false); }
  }

  function resetIssue() {
    setPersonnelId(""); setCaseKind("warning"); setIncidentOn(new Date().toISOString().slice(0, 10)); setExpiresAt("");
    setSummary(""); setReason(""); setSelectedActions([]); setSelectedTags([]); setEvidenceLabel(""); setEvidenceUrl("");
  }

  async function createCase() {
    const actions = selectedActions.map((catalogActionId) => ({ catalogActionId, certificationIds: stripsTags ? selectedTags : [] }));
    const evidence = evidenceUrl ? [{ label: evidenceLabel, url: evidenceUrl }] : [];
    if (await mutate("create-case", { personnelId, caseKind, incidentOn, expiresAt, summary, reason, actions, evidence })) {
      setIssuing(false); resetIssue(); setMessage(`${caseKind === "da" ? "DA submitted for approval" : "Warning issued"}.`);
    }
  }

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "active", label: "Active", count: counts.warnings + counts.das },
    { key: "approval", label: "Awaiting Approval", count: counts.approval },
    { key: "appeals", label: "Appeals", count: counts.appeals },
    { key: "archive", label: "Archive" }, { key: "catalog", label: "Action Catalogue" },
  ];

  return <main className="min-h-screen bg-[#020806] px-3 py-8 text-white sm:px-6 lg:px-8">
    <section className="mx-auto max-w-[1500px] border border-[#00ff66]/25 bg-black/80">
      <header className="flex flex-col gap-5 border-b border-[#00ff66]/20 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4"><span className="border border-[#00ff66]/35 bg-[#00ff66]/10 p-3 text-[#00ff66]"><Gavel /></span><div><p className="text-xs font-bold uppercase tracking-[.22em] text-[#00ff66]">Personnel Records</p><h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">Warnings & Disciplinary Actions</h1><p className="mt-2 max-w-3xl text-sm text-[#8aa092]">Issue, approve, track, and appeal official personnel actions with a permanent history.</p></div></div>
        {canEdit && <button onClick={() => setIssuing(true)} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/12 px-5 text-sm font-bold uppercase tracking-[.12em] text-[#00ff66] hover:bg-[#00ff66]/20"><Plus size={17}/>Issue action</button>}
      </header>
      {message && <div className="border-b border-cyan-300/20 bg-cyan-300/5 px-5 py-3 text-sm text-cyan-100">{message}</div>}
      <div className="grid grid-cols-2 border-b border-[#00ff66]/15 sm:grid-cols-4">
        {[['Active warnings',counts.warnings],['Active DAs',counts.das],['Awaiting approval',counts.approval],['Open appeals',counts.appeals]].map(([label,value])=><div key={String(label)} className="border-b border-r border-[#00ff66]/10 p-4 last:border-r-0 sm:border-b-0"><p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#6f8778]">{label}</p><p className="mt-1 text-2xl font-black text-[#00ff66]">{value}</p></div>)}
      </div>
      <nav className="flex overflow-x-auto border-b border-[#00ff66]/15" aria-label="Disciplinary record views">{tabs.map((item)=><button key={item.key} onClick={()=>setTab(item.key)} className={`min-h-12 shrink-0 border-r border-[#00ff66]/10 px-4 text-xs font-bold uppercase tracking-[.12em] ${tab===item.key?"bg-[#00ff66]/12 text-[#00ff66]":"text-[#829388] hover:bg-white/[.03] hover:text-white"}`}>{item.label}{item.count ? ` ${item.count}` : ""}</button>)}</nav>
      {tab !== "catalog" && <div className="p-4 sm:p-6">
        <label className="relative block max-w-lg"><Search className="absolute left-3 top-3.5 text-[#607066]" size={17}/><input value={query} onChange={(event)=>setQuery(event.target.value)} placeholder="Search person, reference, or summary" className="min-h-11 w-full border border-white/10 bg-[#030b07] pl-10 pr-3 outline-none focus:border-[#00ff66]/40"/></label>
        <div className="mt-5 border border-white/10">{loading?<div className="flex items-center gap-3 p-6 text-[#8aa092]"><Loader2 className="animate-spin"/>Loading records</div>:visibleCases.length?visibleCases.map((item)=><button key={item.id} onClick={()=>{setSelected(item);setNotes("");setAppealUrl("");}} className="grid w-full gap-3 border-b border-white/10 p-4 text-left last:border-b-0 hover:bg-[#00ff66]/[.04] md:grid-cols-[150px_1fr_160px_36px] md:items-center">
          <span><span className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-[.12em] ${item.case_kind==="da"?"border-red-400/35 bg-red-400/10 text-red-200":"border-amber-300/35 bg-amber-300/10 text-amber-100"}`}>{item.case_kind==="da"?"DA":"Warning"}</span><span className="mt-2 block font-mono text-xs text-[#00ff66]">{item.reference}</span></span>
          <span className="min-w-0"><strong className="block text-base">{item.personnel_name}</strong><span className="mt-1 block truncate text-sm text-[#96a39b]">{item.summary}</span>{item.active_warning_count>=3&&<span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-red-300"><AlertTriangle size={13}/>DA threshold reached</span>}</span>
          <span className="text-xs text-[#7d8b82]"><span className="block uppercase text-[#a9b5ae]">{labelStatus(item.effective_status)}</span><span className="mt-1 block">Issued {date(item.created_at)}</span></span><ChevronRight className="text-[#00ff66]/60"/>
        </button>):<p className="p-8 text-center text-[#74837a]">No records in this view.</p>}</div>
      </div>}
      {tab === "catalog" && <div className="grid gap-0 lg:grid-cols-[1fr_360px]">
        <section className="border-b border-[#00ff66]/15 p-4 sm:p-6 lg:border-b-0 lg:border-r"><h2 className="mb-4 text-sm font-black uppercase tracking-[.16em] text-[#00ff66]">Approved actions</h2><div className="divide-y divide-white/10 border border-white/10">{data?.catalog.map((item)=><article key={item.id} className="flex items-start gap-4 p-4"><span className={`mt-1 h-2 w-2 shrink-0 ${item.active?"bg-[#00ff66]":"bg-gray-600"}`}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{item.name}</strong><span className="border border-white/10 px-2 py-0.5 text-[10px] uppercase text-[#8da097]">{item.category}</span></div>{item.description&&<p className="mt-1 text-sm text-[#819087]">{item.description}</p>}</div>{canFull&&<button disabled={saving} onClick={()=>void mutate("catalog-toggle",{catalogActionId:item.id,active:!item.active})} className="border border-white/15 px-3 py-2 text-xs uppercase text-gray-300 hover:border-[#00ff66]/35">{item.active?"Disable":"Enable"}</button>}</article>)}</div></section>
        <aside className="p-5 sm:p-6"><h2 className="text-sm font-black uppercase tracking-[.16em] text-[#00ff66]">Add action</h2>{canFull?<><input value={newActionName} onChange={e=>setNewActionName(e.target.value)} placeholder="Action name" className="mt-4 min-h-11 w-full border border-white/10 bg-[#030b07] px-3"/><select value={newActionCategory} onChange={e=>setNewActionCategory(e.target.value as "formal"|"community")} className="mt-3 min-h-11 w-full border border-white/10 bg-[#030b07] px-3"><option value="formal">Formal</option><option value="community">Community / in-game</option></select><textarea value={newActionDescription} onChange={e=>setNewActionDescription(e.target.value)} placeholder="Optional instructions" className="mt-3 min-h-28 w-full border border-white/10 bg-[#030b07] p-3"/><button disabled={saving||newActionName.trim().length<3} onClick={async()=>{if(await mutate("catalog-add",{name:newActionName,description:newActionDescription,category:newActionCategory})){setNewActionName("");setNewActionDescription("");}}} className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/10 text-sm font-bold uppercase text-[#00ff66] disabled:opacity-40"><Plus size={16}/>Add to catalogue</button></>:<p className="mt-4 text-sm text-[#7e8e84]">Full permission is required to manage the catalogue.</p>}</aside>
      </div>}
    </section>

    {issuing && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-5" role="dialog" aria-modal="true"><section className="flex max-h-[96dvh] w-full max-w-4xl flex-col border border-[#00ff66]/35 bg-[#020806] shadow-[0_0_70px_rgba(0,255,102,.12)]"><header className="flex items-start justify-between border-b border-[#00ff66]/15 p-5"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-[#00ff66]">New personnel action</p><h2 className="mt-1 text-xl font-black uppercase">Issue warning or DA</h2></div><button onClick={()=>setIssuing(false)} aria-label="Close" className="border border-white/10 p-2 text-gray-400 hover:text-white"><X/></button></header><div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="grid gap-4 sm:grid-cols-2"><label><span className="field-label">Type</span><select value={caseKind} onChange={e=>{setCaseKind(e.target.value as "warning"|"da");setSelectedActions([]);setSelectedTags([]);}} className="field"><option value="warning">Warning</option><option value="da">Disciplinary Action</option></select></label><label><span className="field-label">Personnel</span><select value={personnelId} onChange={e=>{setPersonnelId(e.target.value);setSelectedTags([]);}} className="field"><option value="">Select personnel</option>{data?.personnel.map(item=><option key={item.id} value={item.id}>{item.name}{item.birth_number?` · ${item.birth_number}`:""}</option>)}</select></label><label><span className="field-label">Incident date</span><input type="date" value={incidentOn} onChange={e=>setIncidentOn(e.target.value)} className="field"/></label>{caseKind==="warning"&&<label><span className="field-label">Warning expires</span><input type="date" value={expiresAt} min={incidentOn} onChange={e=>setExpiresAt(e.target.value)} className="field"/></label>}<label className="sm:col-span-2"><span className="field-label">Summary</span><input value={summary} maxLength={180} onChange={e=>setSummary(e.target.value)} className="field" placeholder="Short description shown in case lists"/></label><label className="sm:col-span-2"><span className="field-label">Full reason</span><textarea value={reason} maxLength={5000} onChange={e=>setReason(e.target.value)} className="field min-h-32 py-3" placeholder="Record the incident and reason for this action"/></label></div>
      <h3 className="mt-7 border-b border-[#00ff66]/15 pb-2 text-xs font-black uppercase tracking-[.17em] text-[#00ff66]">Assigned actions</h3><div className="mt-3 grid gap-2 sm:grid-cols-2">{data?.catalog.filter(item=>item.active&&(caseKind==="da"||item.slug!=="strip-tags")).map(item=><label key={item.id} className="flex cursor-pointer items-start gap-3 border border-white/10 p-3 hover:border-[#00ff66]/25"><input type="checkbox" checked={selectedActions.includes(item.id)} onChange={()=>setSelectedActions(current=>current.includes(item.id)?current.filter(id=>id!==item.id):[...current,item.id])} className="mt-1 accent-[#00ff66]"/><span><strong className="block text-sm">{item.name}</strong><span className="text-xs uppercase text-[#738279]">{item.category}</span></span></label>)}</div>
      {stripsTags&&<div className="mt-4 border border-amber-300/25 bg-amber-300/5 p-4"><h3 className="text-xs font-black uppercase tracking-[.15em] text-amber-200">Tags removed after DA approval</h3>{person?.certifications.length?<div className="mt-3 grid gap-2 sm:grid-cols-2">{person.certifications.map(cert=><label key={cert.id} className="flex items-center gap-3 border border-white/10 p-3"><input type="checkbox" checked={selectedTags.includes(cert.id)} onChange={()=>setSelectedTags(current=>current.includes(cert.id)?current.filter(id=>id!==cert.id):[...current,cert.id])} className="accent-red-400"/><span className="text-sm">{cert.name}</span></label>)}</div>:<p className="mt-2 text-sm text-amber-100/70">This person has no assigned certification or MOS tags.</p>}</div>}
      <h3 className="mt-7 border-b border-[#00ff66]/15 pb-2 text-xs font-black uppercase tracking-[.17em] text-[#00ff66]">Evidence link</h3><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_2fr]"><input value={evidenceLabel} onChange={e=>setEvidenceLabel(e.target.value)} className="field" placeholder="Label, e.g. Incident report"/><input value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} className="field" placeholder="https://..."/></div>{caseKind==="da"&&<p className="mt-5 border border-cyan-300/20 bg-cyan-300/5 p-4 text-sm text-cyan-100">The DA will remain inactive until approved by a different editor. Selected tags are removed only after approval.</p>}
    </div><footer className="flex shrink-0 flex-col gap-3 border-t border-[#00ff66]/15 bg-[#020806] p-4 sm:flex-row sm:justify-end"><button onClick={()=>setIssuing(false)} className="min-h-11 border border-white/15 px-5 text-sm uppercase text-gray-300">Cancel</button><button disabled={saving||!personnelId||summary.trim().length<3||reason.trim().length<3||!incidentOn||(caseKind==="warning"&&!expiresAt)||(stripsTags&&!selectedTags.length)} onClick={createCase} className="inline-flex min-h-11 items-center justify-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/12 px-5 text-sm font-bold uppercase text-[#00ff66] disabled:opacity-40">{saving?<Loader2 className="animate-spin" size={17}/>:<FileWarning size={17}/>}Issue {caseKind==="da"?"DA":"warning"}</button></footer></section></div>}

    {selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-2 sm:p-5" role="dialog" aria-modal="true"><section className="flex max-h-[96dvh] w-full max-w-4xl flex-col border border-[#00ff66]/35 bg-[#020806]"><header className="flex items-start justify-between border-b border-[#00ff66]/15 p-5"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm text-[#00ff66]">{selected.reference}</span><span className="border border-white/15 px-2 py-1 text-[10px] font-bold uppercase">{labelStatus(selected.effective_status)}</span></div><h2 className="mt-2 text-xl font-black">{selected.personnel_name}: {selected.summary}</h2></div><button onClick={()=>setSelected(null)} aria-label="Close" className="border border-white/10 p-2 text-gray-400 hover:text-white"><X/></button></header><div className="min-h-0 flex-1 overflow-y-auto p-5">
      <div className="grid gap-4 border border-white/10 p-4 sm:grid-cols-3"><div><span className="meta-label">Type</span><strong className="block uppercase">{selected.case_kind==="da"?"Disciplinary Action":"Warning"}</strong></div><div><span className="meta-label">Incident</span><strong className="block">{date(selected.incident_on)}</strong></div><div><span className="meta-label">Issued by</span><strong className="block">{selected.issuer_name}</strong></div>{selected.expires_at&&<div><span className="meta-label">Expiry</span><strong className="block">{date(selected.expires_at)}</strong></div>}{selected.approver_name&&<div><span className="meta-label">Approved by</span><strong className="block">{selected.approver_name}</strong></div>}<div><span className="meta-label">Active warnings</span><strong className={selected.active_warning_count>=3?"block text-red-300":"block"}>{selected.active_warning_count}{selected.active_warning_count>=3?" · DA threshold reached":""}</strong></div></div>
      <section className="mt-5"><h3 className="section-title">Reason</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#c1cbc5]">{selected.reason}</p></section>
      <section className="mt-6"><h3 className="section-title">Evidence</h3>{!!selected.evidence.length&&<div className="mt-3 flex flex-wrap gap-2">{selected.evidence.map(item=><a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 border border-cyan-300/25 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-300/5">{item.label}<ExternalLink size={14}/></a>)}</div>}{canEdit&&<div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]"><input value={evidenceLabel} onChange={e=>setEvidenceLabel(e.target.value)} className="field" placeholder="Evidence label"/><input value={evidenceUrl} onChange={e=>setEvidenceUrl(e.target.value)} className="field" placeholder="https://..."/><button disabled={saving||!evidenceLabel.trim()||!evidenceUrl.trim()} onClick={async()=>{if(await mutate("add-evidence",{caseId:selected.id,label:evidenceLabel,url:evidenceUrl})){setEvidenceLabel("");setEvidenceUrl("");}}} className="min-h-11 border border-cyan-300/30 px-4 text-xs font-bold uppercase text-cyan-200 disabled:opacity-40">Add link</button></div>}</section>
      {!!selected.actions.length&&<section className="mt-6"><h3 className="section-title">Assigned actions</h3><div className="mt-3 divide-y divide-white/10 border border-white/10">{selected.actions.map(action=><article key={action.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><span className={`border p-2 ${action.status==="completed"?"border-[#00ff66]/35 text-[#00ff66]":"border-amber-300/30 text-amber-200"}`}>{action.status==="completed"?<Check size={16}/>:<ClipboardCheck size={16}/>}</span><div className="min-w-0 flex-1"><strong>{action.action_name}</strong><p className="mt-1 text-xs uppercase text-[#74847a]">{action.status}{action.completion_notes?` · ${action.completion_notes}`:""}</p>{action.slug==="strip-tags"&&<p className="mt-1 text-xs text-amber-100/70">{action.target_data.certificationIds?.length||0} selected tag(s)</p>}</div>{canEdit&&selected.status==="active"&&action.status==="pending"&&<button disabled={saving} onClick={async()=>{const completion=window.prompt("Optional completion note")||"";await mutate("complete-action",{caseId:selected.id,actionId:action.id,notes:completion});}} className="border border-[#00ff66]/30 px-3 py-2 text-xs font-bold uppercase text-[#00ff66]">Mark complete</button>}</article>)}</div></section>}
      {selected.status==="pending_approval"&&canEdit&&<section className="mt-6 border border-amber-300/25 bg-amber-300/5 p-4"><h3 className="font-black uppercase text-amber-100">Secondary approval</h3>{selected.issued_by===data?.currentUserId?<p className="mt-2 text-sm text-amber-100/70">A different editor must approve this DA.</p>:<><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Optional decision notes" className="field mt-3 min-h-24 py-3"/><div className="mt-3 flex flex-col gap-2 sm:flex-row"><button disabled={saving} onClick={()=>void mutate("approve-case",{caseId:selected.id,decision:"rejected",notes})} className="min-h-11 flex-1 border border-red-400/35 text-sm font-bold uppercase text-red-200">Reject</button><button disabled={saving} onClick={()=>void mutate("approve-case",{caseId:selected.id,decision:"approved",notes})} className="min-h-11 flex-1 border border-[#00ff66]/40 bg-[#00ff66]/10 text-sm font-bold uppercase text-[#00ff66]">Approve DA</button></div></>}</section>}
      {["active","appealed"].includes(selected.status)&&canEdit&&!selected.appeals.some(item=>["pending","more_info"].includes(item.status))&&<section className="mt-6"><h3 className="section-title">Appeal</h3><div className="mt-3 grid gap-3"><input value={appealUrl} onChange={e=>setAppealUrl(e.target.value)} placeholder="Google Docs appeal link" className="field"/><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Appeal notes" className="field min-h-24 py-3"/><button disabled={saving||!appealUrl} onClick={async()=>{if(await mutate("submit-appeal",{caseId:selected.id,documentUrl:appealUrl,notes})){setAppealUrl("");setNotes("");}}} className="min-h-11 border border-cyan-300/35 bg-cyan-300/5 text-sm font-bold uppercase text-cyan-200">Record appeal</button></div></section>}
      {!!selected.appeals.length&&<section className="mt-6"><h3 className="section-title">Appeal history</h3><div className="mt-3 divide-y divide-white/10 border border-white/10">{selected.appeals.map(appeal=><article key={appeal.id} className="p-4"><div className="flex flex-wrap items-center justify-between gap-2"><a href={appeal.document_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan-200">Open appeal document<ExternalLink size={14}/></a><span className="text-xs font-bold uppercase text-[#00ff66]">{labelStatus(appeal.status)}</span></div><p className="mt-2 text-sm text-[#9ba9a0]">Submitted by {appeal.submitted_by_name} on {dateTime(appeal.submitted_at)}</p>{appeal.review_notes&&<p className="mt-2 text-sm">{appeal.review_notes}</p>}{canEdit&&["pending","more_info"].includes(appeal.status)&&<div className="mt-4"><textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Required review notes" className="field min-h-20 py-3"/><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{[["upheld","Uphold"],["amended","Amend"],["overturned","Overturn"],["more_info","More info"]].map(([outcome,label])=><button key={outcome} disabled={saving||notes.trim().length<3} onClick={()=>void mutate("review-appeal",{caseId:selected.id,appealId:appeal.id,outcome,notes})} className="min-h-10 border border-white/15 text-xs font-bold uppercase hover:border-[#00ff66]/40 disabled:opacity-40">{label}</button>)}</div></div>}</article>)}</div></section>}
      <section className="mt-6"><h3 className="section-title">Case history</h3><div className="mt-3 border-l border-[#00ff66]/25 pl-4">{selected.events.map(event=><article key={event.id} className="relative pb-5 before:absolute before:-left-[21px] before:top-1 before:h-2 before:w-2 before:bg-[#00ff66]"><strong className="text-sm uppercase">{labelStatus(event.event_type)}</strong><p className="mt-1 text-sm text-[#a5b1aa]">{event.details}</p><p className="mt-1 text-xs text-[#69776e]">{event.actor_name} · {dateTime(event.created_at)}</p></article>)}</div></section>
      {canFull&&selected.status!=="voided"&&<section className="mt-6 border border-red-400/20 bg-red-400/5 p-4"><h3 className="text-sm font-black uppercase text-red-200">Administrative correction</h3><button disabled={saving} onClick={async()=>{const voidReason=window.prompt("Reason for voiding this record");if(voidReason)await mutate("void-case",{caseId:selected.id,reason:voidReason});}} className="mt-3 min-h-10 border border-red-400/35 px-4 text-xs font-bold uppercase text-red-200">Void record</button></section>}
    </div><footer className="shrink-0 border-t border-[#00ff66]/15 p-4 text-right"><button onClick={()=>setSelected(null)} className="min-h-10 border border-white/15 px-5 text-sm uppercase text-gray-300">Close</button></footer></section></div>}
    <style jsx>{`.field{min-height:44px;width:100%;border:1px solid rgba(255,255,255,.12);background:#030b07;padding-left:12px;padding-right:12px;color:white;outline:none}.field:focus{border-color:rgba(0,255,102,.45)}.field-label,.meta-label{display:block;margin-bottom:6px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.13em;color:#718178}.section-title{border-bottom:1px solid rgba(0,255,102,.16);padding-bottom:8px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.17em;color:#00ff66}`}</style>
  </main>;
}
