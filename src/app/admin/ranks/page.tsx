"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronDown, ChevronUp, GripVertical, Loader2, Plus, Save, Shield, ToggleLeft, ToggleRight, Trash2, X } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Rank = { id: string; name: string; rank_level: number; discord_role_id: string | null; is_active: boolean; personnel_count: number };

export default function RankManagementPage() {
  const router = useRouter();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [access, setAccess] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
  const [draggedRankId, setDraggedRankId] = useState<string | null>(null);
  const [deletingRank, setDeletingRank] = useState<Rank | null>(null);
  const [draft, setDraft] = useState({ name: "", rankLevel: "", discordRoleId: "" });

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/ranks", { cache: "no-store", headers: await getAppAuthHeaders() });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load ranks");
    setRanks(body.ranks);
  }, []);

  useEffect(() => { void (async () => {
    const session = await getAppSession();
    if (!session || !hasAppPermission(session, "admin.ranks", "read")) return router.replace(session ? "/" : "/login");
    setAccess(session.permissions["admin.ranks"] || "none");
    try { await load(); } catch (caught) { setMessage(caught instanceof Error ? caught.message : "Failed to load ranks"); }
    finally { setLoading(false); }
  })(); }, [load, router]);

  async function save(rank: Rank) {
    setSaving(rank.id); setMessage("");
    try {
      const response = await fetch("/api/admin/ranks", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify({ id: rank.id, name: rank.name, rankLevel: rank.rank_level, discordRoleId: rank.discord_role_id, isActive: rank.is_active }) });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) return setMessage(body?.error || "Failed to update rank");
      setMessage("Rank updated."); await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to update rank");
    } finally {
      setSaving("");
    }
  }

  async function create() {
    setSaving("new"); setMessage("");
    const response = await fetch("/api/admin/ranks", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify(draft) });
    const body = await response.json(); setSaving("");
    if (!response.ok) return setMessage(body.error || "Failed to create rank");
    setDraft({ name: "", rankLevel: "", discordRoleId: "" }); setMessage("Rank created."); await load();
  }

  async function removeRank() {
    if (!deletingRank) return;
    setSaving(`delete-${deletingRank.id}`); setMessage("");
    try {
      const response = await fetch(`/api/admin/ranks?id=${encodeURIComponent(deletingRank.id)}`, {
        method: "DELETE",
        headers: await getAppAuthHeaders(),
      });
      const body = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) return setMessage(body?.error || "Failed to delete rank");
      setDeletingRank(null); setMessage(`${deletingRank.name} deleted.`); await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Failed to delete rank");
    } finally {
      setSaving("");
    }
  }

  async function persistOrder(nextRanks: Rank[]) {
    setRanks(nextRanks.map((rank, index) => ({ ...rank, rank_level: index })));
    setSaving("order"); setMessage("");
    const response = await fetch("/api/admin/ranks", {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
      body: JSON.stringify({ orderedIds: nextRanks.map((rank) => rank.id) }),
    });
    const body = await response.json().catch(() => null) as { error?: string } | null;
    setSaving("");
    if (!response.ok) { setMessage(body?.error || "Failed to reorder ranks"); await load(); return; }
    setMessage("Rank order updated.");
  }

  function moveRank(rankId: string, targetIndex: number) {
    const sourceIndex = ranks.findIndex((rank) => rank.id === rankId);
    if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= ranks.length || sourceIndex === targetIndex) return;
    const next = [...ranks];
    const [moved] = next.splice(sourceIndex, 1);
    next.splice(targetIndex, 0, moved);
    void persistOrder(next);
  }

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading rank management...</main>;
  const canEdit = access === "edit" || access === "full";
  return <main className="min-h-screen bg-[#020806] px-4 py-10 text-white sm:px-8">
    <section className="mx-auto max-w-7xl border border-[#00ff66]/25 bg-black/80">
      <header className="flex items-center gap-4 border-b border-[#00ff66]/20 p-6"><Shield className="text-[#00ff66]"/><div><p className="text-xs uppercase tracking-[.22em] text-[#00ff66]">Personnel Administration</p><h1 className="text-3xl font-black uppercase">Rank Management</h1></div></header>
      {message && <div className="border-b border-cyan-400/20 bg-cyan-400/5 px-6 py-3 text-cyan-200">{message}</div>}
      {access === "full" && <div className="grid gap-3 border-b border-[#00ff66]/15 p-6 md:grid-cols-[1fr_140px_1fr_auto]">
        <input className="border border-[#00ff66]/25 bg-black p-3" placeholder="Rank name" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/>
        <input className="border border-[#00ff66]/25 bg-black p-3" type="number" placeholder="Level" value={draft.rankLevel} onChange={e=>setDraft({...draft,rankLevel:e.target.value})}/>
        <input className="border border-[#00ff66]/25 bg-black p-3" placeholder="Discord role ID" value={draft.discordRoleId} onChange={e=>setDraft({...draft,discordRoleId:e.target.value})}/>
        <button onClick={create} disabled={saving==="new"} className="flex items-center justify-center gap-2 border border-[#00ff66]/40 bg-[#00ff66]/10 px-5 text-[#00ff66]"><Plus size={18}/>Create</button>
      </div>}
      <div className="divide-y divide-[#00ff66]/10">
        {ranks.map((rank,index)=><div key={rank.id} onDragOver={(event)=>{if(canEdit)event.preventDefault();}} onDrop={(event)=>{event.preventDefault();if(draggedRankId)moveRank(draggedRankId,index);setDraggedRankId(null);}} className={`grid gap-3 p-5 transition md:grid-cols-[40px_1fr_90px_1fr_130px_150px] md:items-center ${draggedRankId===rank.id?"bg-[#00ff66]/10 opacity-60":""}`}>
          <div draggable={canEdit} onDragStart={(event)=>{setDraggedRankId(rank.id);event.dataTransfer.effectAllowed="move";}} onDragEnd={()=>setDraggedRankId(null)} role="button" tabIndex={canEdit?0:-1} title="Drag to reorder" className={`hidden h-10 w-10 place-items-center border border-white/10 text-gray-500 md:grid ${canEdit?"cursor-grab hover:border-[#00ff66]/40 hover:text-[#00ff66]":"cursor-not-allowed opacity-30"}`}><GripVertical size={19}/></div>
          <input disabled={!canEdit} className="border border-white/10 bg-[#030b07] p-3 disabled:text-gray-400" value={rank.name} onChange={e=>setRanks(v=>v.map((r,i)=>i===index?{...r,name:e.target.value}:r))}/>
          <div className="border border-white/10 bg-[#030b07] p-3 text-center text-sm text-gray-400">{index + 1}</div>
          <input disabled={!canEdit} className="border border-white/10 bg-[#030b07] p-3" placeholder="No Discord role" value={rank.discord_role_id||""} onChange={e=>setRanks(v=>v.map((r,i)=>i===index?{...r,discord_role_id:e.target.value||null}:r))}/>
          <div className="text-sm text-gray-400">{rank.personnel_count} personnel</div>
          {canEdit && <div className="flex items-center gap-3"><button title="Move rank up" disabled={index===0||saving==="order"} onClick={()=>moveRank(rank.id,index-1)} className="md:hidden"><ChevronUp size={18}/></button><button title="Move rank down" disabled={index===ranks.length-1||saving==="order"} onClick={()=>moveRank(rank.id,index+1)} className="md:hidden"><ChevronDown size={18}/></button><button title={rank.is_active?"Retire rank":"Reactivate rank"} disabled={access!=="full"} onClick={()=>setRanks(v=>v.map((r,i)=>i===index?{...r,is_active:!r.is_active}:r))}>{rank.is_active?<ToggleRight className="text-[#00ff66]"/>:<ToggleLeft className="text-gray-500"/>}</button><button title="Save rank" onClick={()=>save(rank)}>{saving===rank.id?<Loader2 className="animate-spin"/>:<Save className="text-cyan-300"/>}</button>{access==="full"&&<button title={rank.personnel_count?"Reassign personnel before deleting this rank":"Delete rank"} disabled={rank.personnel_count>0||Boolean(saving)} onClick={()=>setDeletingRank(rank)} className="text-red-300 transition hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-25"><Trash2 size={19}/></button>}</div>}
        </div>)}
      </div>
    </section>
    {deletingRank&&<div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-labelledby="delete-rank-title">
      <section className="w-full max-w-lg border border-red-400/35 bg-[#020806] shadow-2xl shadow-red-950/30">
        <header className="flex items-start justify-between border-b border-red-400/20 p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 text-red-300" size={22}/><div><p className="text-xs font-bold uppercase tracking-[.18em] text-red-300">Permanent action</p><h2 id="delete-rank-title" className="mt-1 text-2xl font-black">Delete {deletingRank.name}?</h2></div></div><button onClick={()=>setDeletingRank(null)} title="Close" className="grid size-9 place-items-center border border-white/10 text-gray-400 hover:text-white"><X size={18}/></button></header>
        <div className="space-y-4 p-5 text-sm text-gray-300"><p>This removes the rank definition permanently. It cannot be restored from Rank Management.</p><p className="border border-yellow-300/20 bg-yellow-300/5 p-3 text-yellow-100">Deletion will be refused if personnel, promotion history, approvals, or other retained records still reference this rank. Use <strong>Retire rank</strong> when the historical record must remain.</p></div>
        <footer className="flex justify-end gap-3 border-t border-white/10 p-5"><button onClick={()=>setDeletingRank(null)} disabled={Boolean(saving)} className="h-11 border border-white/15 px-5 font-bold text-gray-300">Cancel</button><button onClick={()=>void removeRank()} disabled={saving===`delete-${deletingRank.id}`} className="flex h-11 items-center gap-2 border border-red-400/40 bg-red-500/10 px-5 font-bold text-red-200 disabled:opacity-50">{saving===`delete-${deletingRank.id}`?<Loader2 className="animate-spin" size={18}/>:<Trash2 size={18}/>}Delete rank</button></footer>
      </section>
    </div>}
  </main>;
}
