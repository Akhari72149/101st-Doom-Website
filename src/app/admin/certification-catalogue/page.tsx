"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Check, Pencil, Plus, RefreshCw, Search, ShieldOff, X } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Certification = {
  id: string;
  name: string;
  discord_role_id: string;
  is_active: boolean;
  is_trainer_cert: boolean;
  lead_personnel_id: string | null;
  lead_name: string | null;
  holder_count: number;
};

type Draft = { id: string | null; name: string; discordRoleId: string; isActive: boolean };
const emptyDraft: Draft = { id: null, name: "", discordRoleId: "", isActive: true };
const field = "h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60";

export default function CertificationCataloguePage() {
  const router = useRouter();
  const [items, setItems] = useState<Certification[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/admin/certification-catalogue", { cache: "no-store", headers: await getAppAuthHeaders() });
    const body = await response.json().catch(() => ({})) as { certifications?: Certification[]; error?: string };
    if (response.ok) setItems(body.certifications || []);
    else setNotice({ tone: "error", text: body.error || "Unable to load certifications." });
    setLoading(false);
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.certification-catalogue", "read")) {
        router.replace("/");
        return;
      }
      setCanEdit(hasAppPermission(session, "admin.certification-catalogue", "edit"));
      await load();
    })();
  }, [load, router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => showInactive || item.is_active).filter((item) =>
      !term || `${item.name} ${item.discord_role_id} ${item.lead_name || ""}`.toLowerCase().includes(term));
  }, [items, search, showInactive]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    setNotice(null);
    const response = await fetch("/api/admin/certification-catalogue", {
      method: draft.id ? "PATCH" : "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify({ id: draft.id, name: draft.name, discordRoleId: draft.discordRoleId, isActive: draft.isActive }),
    });
    const body = await response.json().catch(() => ({})) as { error?: string };
    setSaving(false);
    if (!response.ok) {
      setNotice({ tone: "error", text: body.error || "The certification could not be saved." });
      return;
    }
    setDraft(null);
    setNotice({ tone: "ok", text: draft.id ? "Certification updated." : "Certification added." });
    await load();
  };

  const edit = (item: Certification) => setDraft({ id: item.id, name: item.name, discordRoleId: item.discord_role_id || "", isActive: item.is_active });
  const activeCount = items.filter((item) => item.is_active).length;

  return <main className="min-h-screen bg-[#010805] p-4 text-white sm:p-6 lg:p-8">
    <div className="mx-auto max-w-7xl border border-[#00ff66]/20 bg-black/25">
      <header className="flex flex-col gap-4 border-b border-[#00ff66]/20 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-[#00ff66]">Personnel Configuration</p><h1 className="mt-1 text-2xl font-black">Certification Catalogue</h1><p className="mt-2 max-w-3xl text-sm text-gray-500">Control which certifications can be awarded. Retired entries remain on existing personnel records.</p></div>
        <div className="flex gap-2"><button type="button" onClick={()=>void load()} title="Refresh catalogue" className="grid size-11 place-items-center border border-white/15 text-gray-400 hover:text-[#00ff66]"><RefreshCw className={loading?"animate-spin":""} size={17}/></button>{canEdit&&<button type="button" onClick={()=>setDraft({...emptyDraft})} className="flex h-11 items-center gap-2 bg-[#00ff66] px-4 text-sm font-black text-black"><Plus size={17}/>Add Certification</button>}</div>
      </header>

      {notice&&<div className={`mx-5 mt-5 flex items-center justify-between border px-4 py-3 text-sm ${notice.tone==="ok"?"border-[#00ff66]/30 bg-[#00ff66]/5 text-[#70ff9d]":"border-red-400/30 bg-red-950/20 text-red-200"}`}><span>{notice.text}</span><button type="button" onClick={()=>setNotice(null)}><X size={15}/></button></div>}

      <section className="grid grid-cols-2 border-b border-[#00ff66]/15 sm:grid-cols-4"><div className="p-4"><p className="text-[10px] font-bold uppercase text-gray-600">Total definitions</p><p className="mt-1 text-xl font-black">{items.length}</p></div><div className="border-l border-white/10 p-4"><p className="text-[10px] font-bold uppercase text-gray-600">Available</p><p className="mt-1 text-xl font-black text-[#00ff66]">{activeCount}</p></div><div className="border-l border-white/10 p-4"><p className="text-[10px] font-bold uppercase text-gray-600">Retired</p><p className="mt-1 text-xl font-black text-amber-200">{items.length-activeCount}</p></div><div className="border-l border-white/10 p-4"><p className="text-[10px] font-bold uppercase text-gray-600">Personnel assignments</p><p className="mt-1 text-xl font-black text-cyan-200">{items.reduce((total,item)=>total+Number(item.holder_count||0),0)}</p></div></section>

      <section className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={16}/><input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Search name, Discord role, or lead" className={`${field} pl-10`}/></div><label className="flex h-11 items-center gap-3 border border-white/15 px-4 text-sm text-gray-400"><input type="checkbox" checked={showInactive} onChange={event=>setShowInactive(event.target.checked)} className="accent-[#00ff66]"/>Show retired</label></section>

      <div className="overflow-x-auto"><div className="min-w-[850px]"><header className="grid grid-cols-[minmax(230px,1fr)_210px_120px_170px_60px] gap-3 border-b border-white/10 bg-[#03100b] px-4 py-3 text-[10px] font-bold uppercase text-gray-600"><span>Certification</span><span>Discord role ID</span><span>Holders</span><span>Status / lead</span><span></span></header>{filtered.map(item=><article key={item.id} className="grid grid-cols-[minmax(230px,1fr)_210px_120px_170px_60px] items-center gap-3 border-b border-white/10 px-4 py-3 hover:bg-white/[.025]"><div><p className="font-bold">{item.name}</p>{item.is_trainer_cert&&<p className="mt-1 text-[10px] uppercase text-cyan-300">Trainer certification</p>}</div><code className="text-xs text-gray-400">{item.discord_role_id||"Not configured"}</code><span className="text-sm text-gray-300">{item.holder_count}</span><div><span className={`text-xs font-bold uppercase ${item.is_active?"text-[#00ff66]":"text-amber-200"}`}>{item.is_active?"Available":"Retired"}</span><p className="mt-1 truncate text-xs text-gray-600">{item.lead_name?`Lead: ${item.lead_name}`:"No lead assigned"}</p></div>{canEdit?<button type="button" onClick={()=>edit(item)} title={`Edit ${item.name}`} className="grid size-9 place-items-center border border-white/15 text-gray-400 hover:border-[#00ff66]/40 hover:text-[#00ff66]"><Pencil size={15}/></button>:<span/>}</article>)}{!loading&&filtered.length===0&&<p className="p-12 text-center text-gray-600">No certifications match the current filters.</p>}</div></div>
    </div>

    {draft&&<div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4" onMouseDown={event=>{if(event.currentTarget===event.target&&!saving)setDraft(null);}}><section className="w-full max-w-xl border border-[#00ff66]/30 bg-[#020806]"><header className="flex items-start justify-between border-b border-white/10 p-5"><div><p className="text-xs font-bold uppercase text-[#00ff66]">Certification Definition</p><h2 className="mt-1 text-xl font-black">{draft.id?"Edit Certification":"Add Certification"}</h2></div><button type="button" onClick={()=>setDraft(null)} className="grid size-10 place-items-center border border-white/15 text-gray-400"><X size={17}/></button></header><div className="space-y-4 p-5"><label className="block"><span className="text-xs font-bold uppercase text-gray-500">Name</span><input autoFocus className={`${field} mt-2`} value={draft.name} onChange={event=>setDraft({...draft,name:event.target.value})} placeholder="Certification name"/></label><label className="block"><span className="text-xs font-bold uppercase text-gray-500">Discord role ID</span><input className={`${field} mt-2 font-mono`} inputMode="numeric" value={draft.discordRoleId} onChange={event=>setDraft({...draft,discordRoleId:event.target.value.replace(/\D/g,"").slice(0,22)})} placeholder="16-22 digit role ID"/></label>{draft.id&&<button type="button" onClick={()=>setDraft({...draft,isActive:!draft.isActive})} className={`flex w-full items-center gap-3 border p-4 text-left ${draft.isActive?"border-[#00ff66]/25 bg-[#00ff66]/5":"border-amber-300/25 bg-amber-300/5"}`}>{draft.isActive?<BadgeCheck className="text-[#00ff66]"/>:<ShieldOff className="text-amber-200"/>}<span><strong className="block">{draft.isActive?"Available for assignment":"Retired from assignment"}</strong><span className="mt-1 block text-xs text-gray-500">Click to {draft.isActive?"retire":"restore"}. Existing holders are not changed.</span></span></button>}</div><footer className="flex justify-end gap-2 border-t border-white/10 p-4"><button type="button" onClick={()=>setDraft(null)} disabled={saving} className="h-10 border border-white/15 px-4 text-sm text-gray-300">Cancel</button><button type="button" onClick={()=>void save()} disabled={saving||!draft.name.trim()||!/^\d{16,22}$/.test(draft.discordRoleId)} className="flex h-10 items-center gap-2 bg-[#00ff66] px-5 text-sm font-black text-black disabled:opacity-40"><Check size={16}/>{saving?"Saving...":"Save Certification"}</button></footer></section></div>}
  </main>;
}
