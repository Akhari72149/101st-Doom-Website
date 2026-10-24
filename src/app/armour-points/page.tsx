"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, Coins, History, Loader2, LockKeyhole, Minus, MinusCircle, Plus, PlusCircle, Search, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, UserRoundSearch, WalletCards, X } from "lucide-react";
import { meetsArmourRankRequirement } from "@/data/armourPoints";
import { getAppAuthHeaders, getAppSession, hasAppPermission } from "@/lib/client-auth";

type Person = { id: string; name: string; birth_number: string; rank_name: string | null; rank_configured: boolean; rank_points: number; rank_breakdown: Array<{ rank_name: string; points: number }>; ledger_points: number; balance: number; unrestricted: boolean };
type Item = { id: string; name: string; category: string; point_cost: number; rank_requirement: string | null; description: string | null };
type Source = { id: string; name: string; category: string; points: number };
type Entry = { id: string; entry_type: string; points_delta: number; source_label: string; quantity: number; notes: string | null; item_name: string | null; recorded_by: string; created_at: string };
type View = "catalogue" | "history";
type CatalogueFilter = "all" | "available" | "points" | "rank";
type TransactionMode = "spend" | "award" | "adjust";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium" }).format(new Date(value));

export default function ArmourPointsPage() {
  const [people, setPeople] = useState<Person[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [history, setHistory] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [view, setView] = useState<View>("catalogue");
  const [catalogueFilter, setCatalogueFilter] = useState<CatalogueFilter>("all");
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState("");
  const [transactionAccess, setTransactionAccess] = useState("none");
  const [transactionOpen, setTransactionOpen] = useState(false);
  const [transactionMode, setTransactionMode] = useState<TransactionMode>("spend");
  const [purchaseSelections, setPurchaseSelections] = useState<Record<string, number>>({});
  const [sourceId, setSourceId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [transactionMessage, setTransactionMessage] = useState("");
  const [databaseReady, setDatabaseReady] = useState(true);

  const load = useCallback(async (personnelId = "") => {
    const response = await fetch(`/api/armour-points${personnelId ? `?personnelId=${encodeURIComponent(personnelId)}` : ""}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Failed to load armour points");
    setPeople(body.personnel || []);
    setItems(body.items || []);
    setSources(body.sources || []);
    setHistory(body.history || []);
    setDatabaseReady(body.databaseReady !== false);
  }, []);

  useEffect(() => {
    void load().catch((reason) => setError(reason instanceof Error ? reason.message : "Failed to load armour points")).finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    void getAppSession().then((session) => {
      if (session && hasAppPermission(session, "admin.armour-points", "edit")) {
        setTransactionAccess(session.permissions["admin.armour-points"] || "none");
      }
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!transactionOpen) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setTransactionOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKeyDown); document.body.style.overflow = previousOverflow; };
  }, [transactionOpen]);

  const selectPerson = async (person: Person) => {
    setSelectedId(person.id);
    setQuery("");
    setSelectorOpen(false);
    setDetailLoading(true);
    setError("");
    try { await load(person.id); } catch (reason) { setError(reason instanceof Error ? reason.message : "Failed to load account"); }
    finally { setDetailLoading(false); }
  };

  const filteredPeople = useMemo(() => {
    const term = query.trim().toLowerCase();
    return people.filter((person) => !term || `${person.name} ${person.birth_number} ${person.rank_name || ""}`.toLowerCase().includes(term)).slice(0, 12);
  }, [people, query]);
  const selected = people.find((person) => person.id === selectedId) || null;
  const spent = history.filter((entry) => entry.points_delta < 0).reduce((total, entry) => total + Math.abs(entry.points_delta), 0);
  const earned = history.filter((entry) => entry.points_delta > 0).reduce((total, entry) => total + entry.points_delta, 0);
  const availableCount = selected ? items.filter((item) => item.point_cost > 0 && meetsArmourRankRequirement(selected.rank_name, item.rank_requirement, selected.unrestricted) && (selected.unrestricted || item.point_cost <= selected.balance)).length : 0;
  const selectedSource = sources.find((source) => source.id === sourceId);
  const purchaseItems = selected ? items.filter((item) => item.point_cost > 0) : [];
  const selectedPurchases = purchaseItems
    .filter((item) => purchaseSelections[item.id])
    .map((item) => ({ ...item, quantity: purchaseSelections[item.id], total: item.point_cost * purchaseSelections[item.id] }));
  const projected = transactionMode === "spend" ? selectedPurchases.reduce((total, item) => total + item.total, 0) : transactionMode === "award" ? (selectedSource?.points || 0) * quantity : Number(amount) || 0;
  const spendOverBalance = Boolean(selected && !selected.unrestricted && projected > selected.balance);
  const filteredItems = useMemo(() => {
    if (!selected) return items;
    return items.filter((item) => {
      if (catalogueFilter === "available") return item.point_cost > 0 && meetsArmourRankRequirement(selected.rank_name, item.rank_requirement, selected.unrestricted) && (selected.unrestricted || item.point_cost <= selected.balance);
      if (catalogueFilter === "points") return item.point_cost > 0;
      if (catalogueFilter === "rank") return item.point_cost === 0;
      return true;
    });
  }, [catalogueFilter, items, selected]);

  const openTransactions = () => {
    setTransactionMode("spend");
    setPurchaseSelections({});
    setSourceId("");
    setQuantity(1);
    setAmount("");
    setNotes("");
    setTransactionMessage("");
    setTransactionOpen(true);
  };

  const submitTransaction = async () => {
    if (!selected) return;
    setSaving(true);
    setTransactionMessage("");
    const payload = transactionMode === "spend"
      ? { action: transactionMode, personnelId: selected.id, purchases: selectedPurchases.map((item) => ({ itemId: item.id, quantity: item.quantity })), notes }
      : transactionMode === "award"
        ? { action: transactionMode, personnelId: selected.id, sourceId, quantity, notes }
        : { action: transactionMode, personnelId: selected.id, amount: Number(amount), notes };
    try {
      const response = await fetch("/api/armour-points", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Transaction failed");
      setTransactionMessage(transactionMode === "spend" ? `${selectedPurchases.length} customisation ${selectedPurchases.length === 1 ? "purchase" : "purchases"} recorded.` : transactionMode === "award" ? "Appointment points awarded." : "Point correction recorded.");
      setPurchaseSelections({});
      setSourceId("");
      setQuantity(1);
      setAmount("");
      setNotes("");
      await load(selected.id);
    } catch (reason) {
      setTransactionMessage(reason instanceof Error ? reason.message : "Transaction failed");
    } finally {
      setSaving(false);
    }
  };

  const togglePurchase = (item: Item) => {
    if (!selected || !meetsArmourRankRequirement(selected.rank_name, item.rank_requirement, selected.unrestricted)) return;
    setPurchaseSelections((current) => {
      const next = { ...current };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = 1;
      return next;
    });
    setTransactionMessage("");
  };

  const updatePurchaseQuantity = (itemId: string, nextQuantity: number) => {
    setPurchaseSelections((current) => ({ ...current, [itemId]: Math.max(1, Math.min(100, nextQuantity)) }));
    setTransactionMessage("");
  };

  return (
    <main className="min-h-screen bg-[#020806] px-4 py-6 text-white sm:px-8 sm:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-[#00ff66]/25 pb-6">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div className="flex items-start gap-4">
              <span className="grid h-11 w-11 shrink-0 place-items-center border border-[#00ff66]/35 bg-[#00ff66]/5 text-[#00ff66]"><Coins size={21} /></span>
              <div><p className="text-xs font-black uppercase text-[#00ff66]">Personnel Resources</p><h1 className="mt-1 text-2xl font-black uppercase sm:text-3xl">Armour Customisation</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#8ba395]">Check your available points, see how they were earned, and compare customisation options.</p></div>
            </div>
            <div className="relative w-full lg:w-[430px]">
              <label htmlFor="armour-account-search" className="mb-2 block text-xs font-black uppercase text-[#789082]">Personnel profile</label>
              <div className="relative">
                <UserRoundSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00ff66]" size={18} />
                <input id="armour-account-search" value={query} onFocus={() => setSelectorOpen(true)} onChange={(event) => { setQuery(event.target.value); setSelectorOpen(true); }} placeholder={selected ? `${selected.name} · ${selected.birth_number}` : "Search by name, number, or rank"} className="h-12 w-full border border-[#00ff66]/30 bg-black pl-11 pr-11 text-sm outline-none transition focus:border-[#00ff66]" />
                <button type="button" onClick={() => setSelectorOpen((current) => !current)} aria-label="Toggle personnel list" className="absolute right-0 top-0 grid h-12 w-11 place-items-center text-[#789082] hover:text-white"><ChevronDown size={18} /></button>
              </div>
              {selectorOpen && <div className="absolute right-0 z-30 mt-2 max-h-80 w-full overflow-y-auto border border-[#00ff66]/30 bg-[#020806] shadow-2xl shadow-black">
                {filteredPeople.map((person) => <button key={person.id} type="button" onClick={() => void selectPerson(person)} className="flex w-full items-center justify-between gap-4 border-b border-white/8 px-4 py-3 text-left transition last:border-b-0 hover:bg-[#00ff66]/8"><span className="min-w-0"><strong className="block truncate text-sm">{person.name}</strong><span className="mt-1 block text-xs text-[#789082]">{person.rank_name || "No rank"} · {person.birth_number}</span></span>{selectedId === person.id && <CheckCircle2 className="shrink-0 text-[#00ff66]" size={17} />}</button>)}
                {!loading && !filteredPeople.length && <p className="p-4 text-sm text-[#789082]">No matching active profiles.</p>}{loading && <p className="p-4 text-sm text-[#00ff66]">Loading profiles...</p>}
              </div>}
            </div>
          </div>
        </header>

        {error && <div className="mt-4 border border-red-400/30 bg-red-400/8 px-5 py-3 text-sm text-red-200">{error}</div>}
        {!selected ? <section className="mt-6 grid min-h-[480px] place-items-center border border-dashed border-[#00ff66]/20 bg-black/35 px-6 text-center"><div className="max-w-md"><span className="mx-auto grid h-16 w-16 place-items-center border border-[#00ff66]/25 bg-[#00ff66]/5 text-[#00ff66]"><Search size={27} /></span><h2 className="mt-5 text-xl font-black uppercase">Find a personnel profile</h2><p className="mt-2 text-sm leading-6 text-[#789082]">Use the personnel search above. Every active roster profile is available, whether or not they have a website login.</p></div></section> :
          <div className={`transition-opacity ${detailLoading ? "opacity-55" : ""}`}>
            <section className="mt-6 border border-[#00ff66]/25 bg-black/55">
              <div className="flex flex-col justify-between gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-center sm:px-7"><div><p className="text-xs font-black uppercase text-[#00ff66]">Points account</p><h2 className="mt-1 text-2xl font-black">{selected.name}</h2><p className="mt-1 text-sm text-[#789082]">{selected.rank_name || "No rank assigned"} · {selected.birth_number}</p></div><div className="flex flex-wrap items-center gap-3">{!selected.rank_configured && <span className="border border-yellow-400/30 bg-yellow-400/5 px-3 py-2 text-xs text-yellow-200">Rank allocation needs configuring</span>}{transactionAccess !== "none" && <button type="button" onClick={openTransactions} className="flex h-11 items-center gap-2 border border-[#00ff66]/45 bg-[#00ff66]/8 px-4 text-sm font-black uppercase text-[#00ff66] transition hover:bg-[#00ff66] hover:text-black"><Coins size={17} /> Transactions</button>}</div></div>
              <div className="grid md:grid-cols-[1.35fr_1fr_1fr_1fr]">
                <div className="border-b border-white/10 bg-[#00ff66]/7 p-5 md:border-b-0 md:border-r md:p-6"><div className="flex items-center gap-2 text-xs font-black uppercase text-[#00ff66]"><WalletCards size={16} /> Available balance</div><p className="mt-3 text-4xl font-black text-[#00ff66] sm:text-5xl">{selected.unrestricted ? "UNLIMITED" : selected.balance}</p><p className="mt-2 text-xs text-[#789082]">{selected.unrestricted ? "Full access account" : `${availableCount} point options currently affordable`}</p></div>
                <SummaryMetric label="Rank allocation" value={selected.unrestricted ? "Unlimited" : selected.rank_points} tone="cyan" /><SummaryMetric label="Additional awards" value={`+${earned}`} tone="green" /><SummaryMetric label="Points spent" value={`-${spent}`} tone="red" />
              </div>
            </section>

            <div className="mt-6 flex border-b border-[#00ff66]/25" role="tablist" aria-label="Armour points views"><ViewTab active={view === "catalogue"} icon={<ShoppingBag size={17} />} label="Customisations" count={items.length} onClick={() => setView("catalogue")} /><ViewTab active={view === "history"} icon={<History size={17} />} label="Point history" count={history.length + selected.rank_breakdown.length} onClick={() => setView("history")} /></div>

            {view === "catalogue" ? <section className="py-6">
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-xs font-black uppercase text-[#00ff66]">Customisation catalogue</p><h3 className="mt-1 text-xl font-black uppercase">Choose how to use your points</h3></div><div className="flex flex-wrap gap-2" aria-label="Catalogue filters"><FilterButton active={catalogueFilter === "all"} label="All" onClick={() => setCatalogueFilter("all")} /><FilterButton active={catalogueFilter === "available"} label="Affordable" onClick={() => setCatalogueFilter("available")} /><FilterButton active={catalogueFilter === "points"} label="Point shop" onClick={() => setCatalogueFilter("points")} /><FilterButton active={catalogueFilter === "rank"} label="Rank unlocks" onClick={() => setCatalogueFilter("rank")} /></div></div>
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredItems.map((item) => {
                const isRankUnlock = item.point_cost === 0; const rankEligible = meetsArmourRankRequirement(selected.rank_name, item.rank_requirement, selected.unrestricted); const affordable = rankEligible && (selected.unrestricted || item.point_cost <= selected.balance); const pointsNeeded = Math.max(0, item.point_cost - selected.balance);
                return <article key={item.id} className="flex min-h-44 flex-col border border-white/10 bg-black/45 p-5 transition hover:border-[#00ff66]/35"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><p className="text-xs font-black uppercase text-[#60776b]">{item.category}</p><h4 className="mt-1 text-lg font-bold leading-6">{item.name}</h4></div><span className={`shrink-0 border px-2.5 py-1 text-xs font-black ${isRankUnlock ? "border-cyan-300/25 bg-cyan-300/5 text-cyan-300" : affordable ? "border-[#00ff66]/30 bg-[#00ff66]/5 text-[#00ff66]" : "border-white/10 text-[#60776b]"}`}>{isRankUnlock ? "RANK" : `${item.point_cost} PTS`}</span></div>{item.description && <p className="mt-3 text-sm leading-5 text-[#789082]">{item.description}</p>}<div className="mt-auto flex items-center gap-2 border-t border-white/8 pt-4 text-xs">{!rankEligible ? <><LockKeyhole size={15} className="text-red-300" /><span className="text-red-200">Requires {item.rank_requirement}</span></> : isRankUnlock ? <><ShieldCheck size={15} className="text-cyan-300" /><span className="text-cyan-200">Unlocked by {item.rank_requirement || "rank"}</span></> : affordable ? <><CheckCircle2 size={15} className="text-[#00ff66]" /><span className="text-[#9ab3a6]">Rank and points requirements met</span></> : <><LockKeyhole size={15} className="text-yellow-300" /><span className="text-yellow-200">{pointsNeeded} more {pointsNeeded === 1 ? "point" : "points"} needed</span></>}</div></article>;
              })}</div>{!filteredItems.length && <div className="mt-5 border border-dashed border-white/15 px-5 py-12 text-center text-sm text-[#789082]">No customisations match this filter.</div>}
            </section> : <section className="py-6"><div><p className="text-xs font-black uppercase text-[#00ff66]">Account record</p><h3 className="mt-1 text-xl font-black uppercase">Where the points came from</h3><p className="mt-2 text-sm text-[#789082]">Every completed rank on the current progression route contributes its award. Other awards, purchases, and corrections are retained permanently below.</p></div><div className="mt-5 border border-white/10 bg-black/45">{selected.rank_breakdown.map((entry) => <HistoryRow key={`rank-${entry.rank_name}`} title={entry.rank_name} detail="Rank progression award" value={`+${entry.points}`} positive />)}{selected.unrestricted && <HistoryRow title={selected.rank_name || "Current rank"} detail="Current rank grants unrestricted armour points" value="Unlimited" positive />}{history.map((entry) => <HistoryRow key={entry.id} title={entry.source_label} detail={`${entry.quantity > 1 ? `${entry.quantity} entries · ` : ""}${formatDate(entry.created_at)}${entry.notes ? ` · ${entry.notes}` : ""}`} value={`${entry.points_delta > 0 ? "+" : ""}${entry.points_delta}`} positive={entry.points_delta >= 0} />)}{!history.length && <div className="border-t border-white/10 px-5 py-8 text-center"><Sparkles className="mx-auto text-[#00ff66]/45" size={22} /><p className="mt-3 text-sm text-[#789082]">No additional awards, purchases, or corrections recorded yet.</p></div>}</div></section>}
            <p className="flex items-center gap-2 border-t border-white/10 py-5 text-xs text-[#60776b]"><ShieldCheck size={15} /> Every award, purchase, and correction is retained in the account history.</p>
          </div>}
      </div>
      {transactionOpen && selected && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-labelledby="armour-transaction-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setTransactionOpen(false); }}>
        <section className="flex max-h-[92vh] w-full max-w-5xl flex-col border border-[#00ff66]/35 bg-[#020806] shadow-2xl shadow-black">
          <header className="flex items-start justify-between gap-4 border-b border-[#00ff66]/20 p-5 sm:p-6"><div><p className="text-xs font-black uppercase text-[#00ff66]">{selected.name} · {selected.birth_number}</p><h2 id="armour-transaction-title" className="mt-1 text-2xl font-black uppercase">Armour point transaction</h2><p className="mt-2 text-sm text-[#789082]">Available balance: <strong className="text-[#00ff66]">{selected.unrestricted ? "Unlimited" : selected.balance}</strong></p></div><button type="button" onClick={() => setTransactionOpen(false)} aria-label="Close transactions" className="grid h-10 w-10 shrink-0 place-items-center border border-white/15 text-[#789082] transition hover:border-[#00ff66]/45 hover:text-white"><X size={19} /></button></header>
          <div className="overflow-y-auto p-5 sm:p-6">
            <div className="flex flex-wrap border-l border-t border-white/10">{(["spend", "award", "adjust"] as TransactionMode[]).filter((mode) => mode !== "adjust" || transactionAccess === "full").map((mode) => <button key={mode} type="button" onClick={() => { setTransactionMode(mode); setTransactionMessage(""); }} className={`min-w-36 flex-1 border-b border-r border-white/10 px-4 py-3 text-sm font-black uppercase transition ${transactionMode === mode ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-[#789082] hover:text-white"}`}>{mode === "spend" ? "Spend points" : mode === "award" ? "Award points" : "Correction"}</button>)}</div>
            {transactionMessage && <div className="mt-4 border border-cyan-300/25 bg-cyan-300/5 px-4 py-3 text-sm text-cyan-100">{transactionMessage}</div>}
            {!databaseReady && <div className="mt-4 border border-yellow-300/25 bg-yellow-300/5 px-4 py-3 text-sm text-yellow-100">The armour points database is not ready for transactions.</div>}
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
              <section>
                <h3 className="flex items-center gap-2 font-black uppercase">{transactionMode === "spend" ? <MinusCircle className="text-red-300" size={18} /> : transactionMode === "award" ? <PlusCircle className="text-[#00ff66]" size={18} /> : <SlidersHorizontal className="text-cyan-300" size={18} />}{transactionMode === "spend" ? "Record customisation" : transactionMode === "award" ? "Record appointment award" : "Correct balance"}</h3>
                {transactionMode === "spend" && <div className="mt-5"><div className="mb-3 flex items-end justify-between gap-3"><div><p className="text-xs font-black uppercase text-[#789082]">Customisation catalogue</p><p className="mt-1 text-sm text-[#60776b]">Select every item included in this purchase.</p></div><span className="text-xs font-black uppercase text-[#00ff66]">{selectedPurchases.length} selected</span></div><div className="grid gap-3 sm:grid-cols-2">{purchaseItems.map((item) => {
                  const rankEligible = meetsArmourRankRequirement(selected.rank_name, item.rank_requirement, selected.unrestricted);
                  const selectedQuantity = purchaseSelections[item.id] || 0;
                  return <article key={item.id} className={`flex min-h-40 flex-col border p-4 transition ${selectedQuantity ? "border-[#00ff66] bg-[#00ff66]/8" : rankEligible ? "border-white/12 bg-black/45 hover:border-[#00ff66]/40" : "border-white/8 bg-black/25 opacity-55"}`}><button type="button" disabled={!rankEligible} onClick={() => togglePurchase(item)} className="flex flex-1 items-start justify-between gap-3 text-left disabled:cursor-not-allowed"><span className="min-w-0"><span className="text-[10px] font-black uppercase text-[#60776b]">{item.category}</span><strong className="mt-1 block leading-5">{item.name}</strong>{item.description && <span className="mt-2 block text-xs leading-5 text-[#789082]">{item.description}</span>}</span><span className={`shrink-0 border px-2 py-1 text-xs font-black ${selectedQuantity ? "border-[#00ff66]/45 text-[#00ff66]" : "border-white/12 text-[#8ba395]"}`}>{item.point_cost} PTS</span></button><div className="mt-3 flex min-h-9 items-center justify-between border-t border-white/8 pt-3">{!rankEligible ? <span className="flex items-center gap-2 text-xs text-red-200"><LockKeyhole size={14} /> Requires {item.rank_requirement}</span> : selectedQuantity ? <><span className="flex items-center gap-2 text-xs font-black uppercase text-[#00ff66]"><CheckCircle2 size={15} /> Selected</span><span className="flex items-center border border-[#00ff66]/25 bg-black"><button type="button" aria-label={`Reduce ${item.name} quantity`} onClick={() => selectedQuantity === 1 ? togglePurchase(item) : updatePurchaseQuantity(item.id, selectedQuantity - 1)} className="grid h-8 w-8 place-items-center text-[#8ba395] hover:text-white"><Minus size={14} /></button><span className="min-w-8 text-center text-sm font-black">{selectedQuantity}</span><button type="button" aria-label={`Increase ${item.name} quantity`} onClick={() => updatePurchaseQuantity(item.id, selectedQuantity + 1)} className="grid h-8 w-8 place-items-center text-[#00ff66] hover:bg-[#00ff66]/10"><Plus size={14} /></button></span></> : <button type="button" onClick={() => togglePurchase(item)} className="flex w-full items-center justify-between text-xs text-[#8ba395]"><span>{item.rank_requirement ? `Available from ${item.rank_requirement}` : "Available"}</span><span className="font-black uppercase text-[#00ff66]">Select</span></button>}</div></article>;
                })}</div>{!purchaseItems.length && <div className="border border-dashed border-white/15 px-5 py-10 text-center text-sm text-[#789082]">No point-shop items are configured.</div>}</div>}
                {transactionMode === "award" && <label className="mt-5 block"><span className="mb-2 block text-xs font-black uppercase text-[#789082]">Appointment source</span><select value={sourceId} onChange={(event) => setSourceId(event.target.value)} className="h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/50"><option value="">Choose source</option>{sources.map((source) => <option key={source.id} value={source.id}>{source.name} · +{source.points}</option>)}</select></label>}
                {transactionMode === "award" ? <label className="mt-4 block"><span className="mb-2 block text-xs font-black uppercase text-[#789082]">Quantity</span><input type="number" min={1} max={100} value={quantity} onChange={(event) => setQuantity(Math.max(1, Math.min(100, Number(event.target.value) || 1)))} className="h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/50" /></label> : transactionMode === "adjust" ? <label className="mt-5 block"><span className="mb-2 block text-xs font-black uppercase text-[#789082]">Point correction</span><input type="number" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Use + or - values" className="h-12 w-full border border-white/15 bg-black px-3 outline-none focus:border-[#00ff66]/50" /></label> : null}
                <label className="mt-4 block"><span className="mb-2 block text-xs font-black uppercase text-[#789082]">{transactionMode === "adjust" ? "Correction reason" : "Notes (optional)"}</span><textarea value={notes} onChange={(event) => setNotes(event.target.value.slice(0, 1000))} rows={3} placeholder={transactionMode === "adjust" ? "Required reason" : "Order reference or context"} className="w-full resize-none border border-white/15 bg-black p-3 outline-none focus:border-[#00ff66]/50" /></label>
              </section>
              <aside className="h-fit border border-white/10 bg-black/45 p-4 lg:sticky lg:top-0"><p className="text-xs font-black uppercase text-[#789082]">{transactionMode === "spend" ? "Order total" : "Points change"}</p><strong className={`mt-3 block text-3xl ${transactionMode === "spend" ? "text-red-300" : "text-[#00ff66]"}`}>{transactionMode === "spend" ? "-" : "+"}{Math.abs(projected)}</strong>{transactionMode === "spend" && <div className="mt-4 space-y-2 border-t border-white/10 pt-4">{selectedPurchases.map((item) => <div key={item.id} className="flex justify-between gap-3 text-xs"><span className="min-w-0 text-[#8ba395]">{item.quantity} x {item.name}</span><strong className="shrink-0 text-white">{item.total}</strong></div>)}{!selectedPurchases.length && <p className="text-xs leading-5 text-[#60776b]">Select one or more catalogue items to build the transaction.</p>}{spendOverBalance && <p className="border border-red-400/25 bg-red-400/5 p-2 text-xs leading-5 text-red-200">Combined cost exceeds the available balance.</p>}</div>}<p className="mt-4 border-t border-white/10 pt-4 text-xs leading-5 text-[#789082]">Each selected item will appear as its own entry in the permanent point history.</p></aside>
            </div>
          </div>
          <footer className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end"><button type="button" onClick={() => setTransactionOpen(false)} className="h-11 border border-white/15 px-5 font-black uppercase text-[#9ab3a6] hover:text-white">Close</button><button type="button" onClick={() => void submitTransaction()} disabled={!databaseReady || saving || (transactionMode === "spend" && (!selectedPurchases.length || spendOverBalance)) || (transactionMode === "award" && !sourceId) || (transactionMode === "adjust" && (!amount || notes.trim().length < 3))} className="flex h-11 items-center justify-center gap-2 bg-[#00ff66] px-6 font-black uppercase text-black disabled:cursor-not-allowed disabled:opacity-35">{saving ? <Loader2 className="animate-spin" size={18} /> : <Coins size={18} />} Save transaction</button></footer>
        </section>
      </div>}
    </main>
  );
}

function SummaryMetric({ label, value, tone }: { label: string; value: string | number; tone: "cyan" | "green" | "red" }) {
  const colour = tone === "cyan" ? "text-cyan-300" : tone === "green" ? "text-[#00ff66]" : "text-red-300";
  return <div className="border-b border-white/10 p-5 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"><p className="text-xs font-black uppercase text-[#789082]">{label}</p><p className={`mt-3 text-2xl font-black ${colour}`}>{value}</p></div>;
}

function ViewTab({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count: number; onClick: () => void }) {
  return <button type="button" role="tab" aria-selected={active} onClick={onClick} className={`flex min-h-13 flex-1 items-center justify-center gap-2 border-x border-t px-4 py-3 text-sm font-black uppercase transition sm:flex-none sm:min-w-56 ${active ? "border-[#00ff66]/35 bg-[#00ff66]/8 text-[#00ff66]" : "border-transparent text-[#789082] hover:text-white"}`}>{icon}{label}<span className="text-[10px] opacity-65">{count}</span></button>;
}

function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} className={`border px-3 py-2 text-xs font-black uppercase transition ${active ? "border-[#00ff66] bg-[#00ff66] text-black" : "border-white/15 text-[#8ba395] hover:border-[#00ff66]/45 hover:text-white"}`}>{label}</button>;
}

function HistoryRow({ title, detail, value, positive }: { title: string; detail: string; value: string; positive: boolean }) {
  return <article className="grid gap-3 border-b border-white/10 px-5 py-4 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><strong className="block truncate">{title}</strong><p className="mt-1 text-xs leading-5 text-[#789082]">{detail}</p></div><span className={`text-lg font-black ${positive ? "text-[#00ff66]" : "text-red-300"}`}>{value}</span></article>;
}
