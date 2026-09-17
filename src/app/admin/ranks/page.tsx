"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Save, Shield, ToggleLeft, ToggleRight } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Rank = { id: string; name: string; rank_level: number; discord_role_id: string | null; is_active: boolean; personnel_count: number };

export default function RankManagementPage() {
  const router = useRouter();
  const [ranks, setRanks] = useState<Rank[]>([]);
  const [access, setAccess] = useState("none");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [message, setMessage] = useState("");
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
    const response = await fetch("/api/admin/ranks", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify({ id: rank.id, name: rank.name, rankLevel: rank.rank_level, discordRoleId: rank.discord_role_id, isActive: rank.is_active }) });
    const body = await response.json();
    setSaving("");
    if (!response.ok) return setMessage(body.error || "Failed to update rank");
    setMessage("Rank updated."); await load();
  }

  async function create() {
    setSaving("new"); setMessage("");
    const response = await fetch("/api/admin/ranks", { method: "POST", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify(draft) });
    const body = await response.json(); setSaving("");
    if (!response.ok) return setMessage(body.error || "Failed to create rank");
    setDraft({ name: "", rankLevel: "", discordRoleId: "" }); setMessage("Rank created."); await load();
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
        {ranks.map((rank,index)=><div key={rank.id} className="grid gap-3 p-5 md:grid-cols-[1fr_120px_1fr_130px_48px] md:items-center">
          <input disabled={!canEdit} className="border border-white/10 bg-[#030b07] p-3 disabled:text-gray-400" value={rank.name} onChange={e=>setRanks(v=>v.map((r,i)=>i===index?{...r,name:e.target.value}:r))}/>
          <input disabled={!canEdit} type="number" className="border border-white/10 bg-[#030b07] p-3" value={rank.rank_level} onChange={e=>setRanks(v=>v.map((r,i)=>i===index?{...r,rank_level:Number(e.target.value)}:r))}/>
          <input disabled={!canEdit} className="border border-white/10 bg-[#030b07] p-3" placeholder="No Discord role" value={rank.discord_role_id||""} onChange={e=>setRanks(v=>v.map((r,i)=>i===index?{...r,discord_role_id:e.target.value||null}:r))}/>
          <div className="text-sm text-gray-400">{rank.personnel_count} personnel</div>
          {canEdit && <div className="flex gap-2"><button title={rank.is_active?"Retire rank":"Reactivate rank"} disabled={access!=="full"} onClick={()=>setRanks(v=>v.map((r,i)=>i===index?{...r,is_active:!r.is_active}:r))}>{rank.is_active?<ToggleRight className="text-[#00ff66]"/>:<ToggleLeft className="text-gray-500"/>}</button><button title="Save rank" onClick={()=>save(rank)}>{saving===rank.id?<Loader2 className="animate-spin"/>:<Save className="text-cyan-300"/>}</button></div>}
        </div>)}
      </div>
    </section>
  </main>;
}
