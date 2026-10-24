"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Coins, Loader2, Search, Settings2, ShieldCheck, Tags } from "lucide-react";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type RankConfig = { id: string; name: string; rank_level: number; configured: boolean; points: number; cumulative_points: number; unrestricted: boolean; equivalent_rank: string | null; track: "standard" | "pilot" | "alias" };
type ItemConfig = { id: string; name: string; category: string; point_cost: number; rank_requirement: string | null; active: boolean; sort_order: number };
type Tab = "ranks" | "catalogue";

const rankRequirements = ["", "CST+", "VCT+", "CTS+", "CP+", "CS+", "CSM+", "SSM+", "Clone 2nd Lieutenant+", "Authorised command ranks"];

export default function ArmourPointsConfigPage() {
  const router = useRouter();
  const [ranks, setRanks] = useState<RankConfig[]>([]);
  const [items, setItems] = useState<ItemConfig[]>([]);
  const [rankDrafts, setRankDrafts] = useState<Record<string, { points: number; unrestricted: boolean }>>({});
  const [itemDrafts, setItemDrafts] = useState<Record<string, { pointCost: number; rankRequirement: string }>>({});
  const [tab, setTab] = useState<Tab>("ranks");
  const [query, setQuery] = useState("");
  const [access, setAccess] = useState("none");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/armour-points-config", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load armour points configuration");
    const nextRanks = (body.ranks || []) as RankConfig[];
    const nextItems = (body.items || []) as ItemConfig[];
    setRanks(nextRanks);
    setItems(nextItems);
    setRankDrafts(Object.fromEntries(nextRanks.map((rank) => [rank.id, { points: rank.points, unrestricted: rank.unrestricted }])));
    setItemDrafts(Object.fromEntries(nextItems.map((item) => [item.id, { pointCost: item.point_cost, rankRequirement: item.rank_requirement || "" }])));
  }, []);

  useEffect(() => {
    void (async () => {
      const session = await getAppSession();
      if (!session || !hasAppPermission(session, "admin.armour-points-config", "read")) return router.replace(session ? "/" : "/login");
      setAccess(session.permissions["admin.armour-points-config"] || "none");
      try { await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed to load configuration"); }
      finally { setLoading(false); }
    })();
  }, [load, router]);

  const save = async (payload: Record<string, unknown>, id: string) => {
    setSavingId(id); setError(""); setMessage("");
    try {
      const response = await fetch("/api/admin/armour-points-config", { method: "PATCH", headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Failed to save configuration");
      setMessage("Configuration saved and added to the audit log.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed to save configuration"); }
    finally { setSavingId(""); }
  };

  const term = query.trim().toLowerCase();
  const visibleRanks = useMemo(() => ranks.filter((rank) => !term || rank.name.toLowerCase().includes(term)), [ranks, term]);
  const visibleItems = useMemo(() => items.filter((item) => !term || `${item.name} ${item.category} ${item.rank_requirement || ""}`.toLowerCase().includes(term)), [items, term]);
  const canEdit = access === "edit" || access === "full";

  if (loading) return <main className="min-h-screen bg-[#020806] p-10 text-[#00ff66]">Loading armour points configuration...</main>;

  return <main className="min-h-screen bg-[#020806] px-4 py-7 text-white sm:px-8">
    <div className="mx-auto max-w-7xl">
      <header className="flex flex-col justify-between gap-5 border-b border-[#00ff66]/25 pb-6 lg:flex-row lg:items-end">
        <div className="flex items-start gap-4"><span className="grid h-11 w-11 shrink-0 place-items-center border border-[#00ff66]/35 text-[#00ff66]"><Settings2 size={20}/></span><div><p className="text-xs font-black uppercase text-[#00ff66]">Personnel Configuration</p><h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">Armour Points Configuration</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-[#789082]">Maintain the points awarded at each promotion and the published customisation catalogue. Changes apply immediately without rewriting transaction history.</p></div></div>
        <div className="relative w-full lg:w-80"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#60776b]" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search this configuration" className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60"/></div>
      </header>

      {error && <div className="mt-4 border border-red-400/30 bg-red-400/8 px-5 py-3 text-sm text-red-200">{error}</div>}
      {message && <div className="mt-4 border border-[#00ff66]/30 bg-[#00ff66]/6 px-5 py-3 text-sm text-[#9fffc1]">{message}</div>}
      {!canEdit && !error && <div className="mt-4 border border-yellow-300/25 bg-yellow-300/5 px-5 py-3 text-sm text-yellow-100">You have read-only access. Edit or Full permission is required to save changes.</div>}

      <section className="mt-5 grid gap-px border border-[#00ff66]/20 bg-[#00ff66]/15 sm:grid-cols-3">
        <InfoBlock icon={<Coins size={17}/>} label="Promotion awards" text="Each standard-rank value is added to every earlier award. Pilot ranks inherit the full total of their standard equivalent." />
        <InfoBlock icon={<ShieldCheck size={17}/>} label="Immediate backdating" text="Existing profiles receive their current rank allocation automatically; no promotion-history entry is required." />
        <InfoBlock icon={<Tags size={17}/>} label="Permanent ledger" text="Changing rank totals or prices never removes recorded awards, purchases, or corrections." />
      </section>

      <div className="mt-6 flex border-b border-[#00ff66]/25">
        <TabButton active={tab === "ranks"} label="Rank point totals" count={ranks.length} onClick={() => setTab("ranks")} />
        <TabButton active={tab === "catalogue"} label="Catalogue rules" count={items.length} onClick={() => setTab("catalogue")} />
      </div>

      {tab === "ranks" ? <section className="py-5">
        <div className="mb-4"><h2 className="text-lg font-black uppercase">Points awarded by rank</h2><p className="mt-1 text-sm text-[#789082]">Ranks follow the published progression rather than the personnel dropdown order. The editable value is awarded at that standard-rank promotion; pilot and alias totals inherit their stated equivalent.</p></div>
        <div className="border border-white/10">
          <div className="hidden grid-cols-[90px_minmax(160px,1fr)_140px_140px_150px_100px] border-b border-white/10 bg-white/[.025] px-4 py-3 text-xs font-black uppercase text-[#60776b] md:grid"><span>Track</span><span>Rank</span><span>Award at rank</span><span>Total at rank</span><span>Unrestricted</span><span></span></div>
          {visibleRanks.map((rank) => { const draft = rankDrafts[rank.id] || { points: rank.points, unrestricted: rank.unrestricted }; const dirty = draft.points !== rank.points || draft.unrestricted !== rank.unrestricted; return <article key={rank.id} className="grid gap-4 border-b border-white/8 px-4 py-4 last:border-b-0 md:grid-cols-[90px_minmax(160px,1fr)_140px_140px_150px_100px] md:items-center">
            <span className={`text-[10px] font-black uppercase ${rank.track === "pilot" ? "text-cyan-300" : rank.track === "alias" ? "text-yellow-200" : "text-[#789082]"}`}>{rank.track}</span><div><strong>{rank.name}</strong>{!rank.configured && <span className="ml-2 text-[10px] font-black uppercase text-yellow-300">Unconfigured</span>}</div>
            {rank.equivalent_rank ? <div className="flex h-10 items-center border border-cyan-300/20 bg-cyan-300/5 px-3 text-xs font-black uppercase text-cyan-200">From {rank.equivalent_rank}</div> : <label><span className="mb-1 block text-[10px] font-black uppercase text-[#60776b] md:hidden">Award at rank</span><input type="number" min={0} max={100000} value={draft.points} disabled={!canEdit} onChange={(event) => setRankDrafts((current) => ({ ...current, [rank.id]: { ...draft, points: Math.max(0, Number(event.target.value) || 0) } }))} className="h-10 w-full border border-white/15 bg-black px-3 disabled:opacity-60"/></label>}
            <div><span className="mb-1 block text-[10px] font-black uppercase text-[#60776b] md:hidden">Calculated total</span><strong className="text-cyan-300">{rank.unrestricted ? "Unlimited" : rank.cumulative_points}</strong></div>
            <label className="flex h-10 items-center gap-3 border border-white/10 px-3"><input type="checkbox" checked={draft.unrestricted} disabled={!canEdit} onChange={(event) => setRankDrafts((current) => ({ ...current, [rank.id]: { ...draft, unrestricted: event.target.checked } }))} className="h-4 w-4 accent-[#00ff66]"/><span className="text-xs">Unlimited balance</span></label>
            <button type="button" disabled={!canEdit || !dirty || Boolean(savingId)} onClick={() => void save({ action: "rank", rankId: rank.id, points: draft.points, unrestricted: draft.unrestricted }, rank.id)} className="flex h-10 items-center justify-center gap-2 border border-[#00ff66]/40 text-xs font-black uppercase text-[#00ff66] disabled:cursor-not-allowed disabled:opacity-30">{savingId === rank.id ? <Loader2 className="animate-spin" size={15}/> : <Check size={15}/>} Save</button>
          </article>; })}
        </div>
      </section> : <section className="py-5">
        <div className="mb-4"><h2 className="text-lg font-black uppercase">Catalogue costs and requirements</h2><p className="mt-1 text-sm text-[#789082]">A zero-point item is treated as a rank entitlement. Paid items require both the configured rank and sufficient points.</p></div>
        <div className="border border-white/10">
          <div className="hidden grid-cols-[minmax(220px,1fr)_150px_240px_110px] border-b border-white/10 bg-white/[.025] px-4 py-3 text-xs font-black uppercase text-[#60776b] md:grid"><span>Customisation</span><span>Point cost</span><span>Rank requirement</span><span></span></div>
          {visibleItems.map((item) => { const draft = itemDrafts[item.id] || { pointCost: item.point_cost, rankRequirement: item.rank_requirement || "" }; const dirty = draft.pointCost !== item.point_cost || draft.rankRequirement !== (item.rank_requirement || ""); return <article key={item.id} className="grid gap-4 border-b border-white/8 px-4 py-4 last:border-b-0 md:grid-cols-[minmax(220px,1fr)_150px_240px_110px] md:items-center">
            <div><strong>{item.name}</strong><p className="mt-1 text-xs text-[#60776b]">{item.category}</p></div>
            <label><span className="mb-1 block text-[10px] font-black uppercase text-[#60776b] md:hidden">Point cost</span><input type="number" min={0} max={100000} value={draft.pointCost} disabled={!canEdit} onChange={(event) => setItemDrafts((current) => ({ ...current, [item.id]: { ...draft, pointCost: Math.max(0, Number(event.target.value) || 0) } }))} className="h-10 w-full border border-white/15 bg-black px-3 disabled:opacity-60"/></label>
            <label><span className="mb-1 block text-[10px] font-black uppercase text-[#60776b] md:hidden">Rank requirement</span><select value={draft.rankRequirement} disabled={!canEdit} onChange={(event) => setItemDrafts((current) => ({ ...current, [item.id]: { ...draft, rankRequirement: event.target.value } }))} className="h-10 w-full border border-white/15 bg-black px-3 disabled:opacity-60">{rankRequirements.map((requirement) => <option key={requirement || "none"} value={requirement}>{requirement || "No rank requirement"}</option>)}</select></label>
            <button type="button" disabled={!canEdit || !dirty || Boolean(savingId)} onClick={() => void save({ action: "item", itemId: item.id, pointCost: draft.pointCost, rankRequirement: draft.rankRequirement }, item.id)} className="flex h-10 items-center justify-center gap-2 border border-[#00ff66]/40 text-xs font-black uppercase text-[#00ff66] disabled:cursor-not-allowed disabled:opacity-30">{savingId === item.id ? <Loader2 className="animate-spin" size={15}/> : <Check size={15}/>} Save</button>
          </article>; })}
        </div>
      </section>}
    </div>
  </main>;
}

function InfoBlock({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return <div className="bg-[#020806] p-4"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#00ff66]">{icon}{label}</div><p className="mt-2 text-xs leading-5 text-[#789082]">{text}</p></div>;
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`flex min-h-12 flex-1 items-center justify-center gap-2 border-x border-t px-4 text-xs font-black uppercase transition sm:flex-none sm:min-w-60 ${active ? "border-[#00ff66]/35 bg-[#00ff66]/8 text-[#00ff66]" : "border-transparent text-[#789082] hover:text-white"}`}>{label}<span className="text-[10px] opacity-60">{count}</span></button>;
}
