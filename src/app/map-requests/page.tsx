"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Check, CheckCircle2, Clock3, ExternalLink, MapPinned, Plus, Search, Send, Server, ShieldCheck, Trash2, X } from "lucide-react";
import { getAppAuthHeaders } from "@/lib/client-auth";

type MapRequest = {
  id: string;
  unit_name: string;
  map_name: string | null;
  map_url: string;
  workshop_id: string;
  entry_type: "request" | "pre_approved";
  added_to_server: boolean;
  requested_at: string;
  added_at: string | null;
  added_by_name: string | null;
  pre_approved_at: string | null;
  pre_approved_by_name: string | null;
};

type Filter = "all" | "pending" | "installed";
type View = "requests" | "pre_approved";

function formatDate(value: string | null, withTime = false) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(new Date(value));
}

export default function MapRequestsPage() {
  const [requests, setRequests] = useState<MapRequest[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<View>("requests");
  const [showForm, setShowForm] = useState(false);
  const [showPreApprovedForm, setShowPreApprovedForm] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/map-requests", { cache: "no-store", credentials: "same-origin", headers: await getAppAuthHeaders() });
      const body = await response.json() as { requests?: MapRequest[]; canManage?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to load map requests");
      setRequests(body.requests || []);
      setCanManage(Boolean(body.canManage));
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load map requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter((item) => {
      if (item.entry_type !== view) return false;
      if (view === "pre_approved") return !query || `${item.map_name || ""} ${item.workshop_id} ${item.pre_approved_by_name || ""}`.toLowerCase().includes(query);
      const statusMatches = filter === "all" || (filter === "installed" ? item.added_to_server : !item.added_to_server);
      return statusMatches && (!query || `${item.map_name || ""} ${item.unit_name} ${item.workshop_id}`.toLowerCase().includes(query));
    });
  }, [filter, requests, search, view]);

  async function setInstalled(item: MapRequest, addedToServer: boolean) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/map-requests", {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ id: item.id, addedToServer }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to update the map request");
      setNotice(addedToServer ? "Map marked as available on the server." : "Map returned to the pending request list.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update the map request");
    } finally {
      setSaving(false);
    }
  }

  async function removePreApproved(item: MapRequest) {
    if (!window.confirm(`Remove Workshop map ${item.workshop_id} from the pre-approved register?`)) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/map-requests", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ id: item.id }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to remove the pre-approved map");
      setNotice("Map removed from the pre-approved register.");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to remove the pre-approved map");
    } finally {
      setSaving(false);
    }
  }

  const requestEntries = requests.filter((item) => item.entry_type === "request");
  const preApproved = requests.filter((item) => item.entry_type === "pre_approved").length;
  const installed = requestEntries.filter((item) => item.added_to_server).length;
  const pending = requestEntries.length - installed;

  return <main className="min-h-screen bg-[#020806] px-4 py-8 text-white sm:px-6 lg:px-10">
    <div className="mx-auto max-w-7xl">
      <header className="border border-[#00ff66]/25 bg-black/65">
        <div className="grid gap-8 p-6 lg:grid-cols-[1fr_auto] lg:items-end lg:p-9">
          <div><p className="flex items-center gap-2 text-xs font-black uppercase tracking-[.18em] text-[#00ff66]"><MapPinned size={16}/>Workshop map register</p><h1 className="mt-3 text-3xl font-black uppercase sm:text-5xl">Map Requests</h1><p className="mt-4 max-w-3xl text-sm leading-6 text-[#8ba095]">Submit tested Steam Workshop maps for server consideration. Maps are normally reviewed and added on Sundays, then may be removed at the end of every second month.</p></div>
          <div className="flex flex-wrap gap-2">{canManage && <button type="button" onClick={() => { setNotice(""); setShowPreApprovedForm(true); }} className="flex h-11 items-center gap-2 border border-cyan-300/40 px-5 text-xs font-black uppercase text-cyan-200 hover:bg-cyan-300/[.07]"><ShieldCheck size={16}/>Add pre-approved</button>}<button type="button" onClick={() => { setNotice(""); setShowForm(true); }} className="flex h-11 items-center gap-2 bg-[#00ff66] px-5 text-xs font-black uppercase text-black hover:bg-[#70ff9f]"><Plus size={16}/>Request a map</button></div>
        </div>
        <div className="grid border-t border-[#00ff66]/15 sm:grid-cols-4"><Stat icon={<MapPinned size={17}/>} label="Total requests" value={requestEntries.length}/><Stat icon={<Clock3 size={17}/>} label="Awaiting server" value={pending}/><Stat icon={<Server size={17}/>} label="On server" value={installed}/><Stat icon={<ShieldCheck size={17}/>} label="Pre-approved" value={preApproved}/></div>
      </header>

      <div className="mt-5 grid grid-cols-2 border border-[#00ff66]/20 bg-black/45" role="tablist" aria-label="Map register sections"><button type="button" role="tab" aria-selected={view === "requests"} onClick={() => { setView("requests"); setSearch(""); }} className={`min-h-12 border-r border-[#00ff66]/15 px-4 text-xs font-black uppercase tracking-[.12em] ${view === "requests" ? "bg-[#00ff66]/10 text-[#00ff66]" : "text-gray-500 hover:text-white"}`}>Map requests <span className="ml-2 text-[10px] opacity-60">{requestEntries.length}</span></button><button type="button" role="tab" aria-selected={view === "pre_approved"} onClick={() => { setView("pre_approved"); setSearch(""); }} className={`min-h-12 px-4 text-xs font-black uppercase tracking-[.12em] ${view === "pre_approved" ? "bg-cyan-300/10 text-cyan-200" : "text-gray-500 hover:text-white"}`}>Pre-approved maps <span className="ml-2 text-[10px] opacity-60">{preApproved}</span></button></div>

      <section className="mt-5 grid gap-3 border border-white/10 bg-black/45 p-4 lg:grid-cols-[1fr_auto]">
        <label className="relative"><Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-600"/><span className="sr-only">Search map register</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={view === "requests" ? "Search map, requesting unit or Workshop ID" : "Search map, Workshop ID or added by"} className="h-11 w-full border border-white/15 bg-black pl-10 pr-3 text-sm outline-none focus:border-[#00ff66]/60"/></label>
        {view === "requests" && <div className="grid grid-cols-3 gap-1" aria-label="Filter map requests">{(["all","pending","installed"] as Filter[]).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={`min-w-24 border px-4 py-2 text-xs font-black uppercase ${filter === value ? "border-[#00ff66] bg-[#00ff66]/10 text-[#00ff66]" : "border-white/10 text-gray-500 hover:text-white"}`}>{value === "installed" ? "On server" : value}</button>)}</div>}
      </section>

      {notice && <div className="mt-5 flex items-center gap-3 border border-[#00ff66]/30 bg-[#00ff66]/10 p-4 text-[#b8ffcf]"><CheckCircle2 size={18}/><p className="text-sm">{notice}</p></div>}
      {error && <div className="mt-5 border border-red-300/25 bg-red-300/10 p-4 text-sm text-red-100">{error}</div>}

      <section className="mt-5 border border-white/10 bg-black/35">
        <header className={`hidden gap-4 border-b border-white/10 px-5 py-3 text-[10px] font-black uppercase tracking-[.12em] text-gray-600 md:grid ${view === "requests" ? "grid-cols-[minmax(0,1fr)_180px_180px_auto]" : "grid-cols-[minmax(0,1fr)_240px_auto]"}`}><span>{view === "requests" ? "Request" : "Pre-approved map"}</span><span>{view === "requests" ? "Requested" : "Added by"}</span>{view === "requests" && <span>Status</span>}<span className="w-36">Action</span></header>
        <div className="divide-y divide-white/10">
          {loading && <p className="p-12 text-center text-xs font-black uppercase tracking-[.14em] text-gray-600">Loading map requests...</p>}
          {!loading && filtered.map((item) => <article key={item.id} className={`grid gap-4 px-5 py-4 md:items-center ${view === "requests" ? "md:grid-cols-[minmax(0,1fr)_180px_180px_auto]" : "md:grid-cols-[minmax(0,1fr)_240px_auto]"}`}>
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-black">{item.map_name || `Workshop map ${item.workshop_id}`}</h2><span className="border border-cyan-300/20 px-2 py-1 font-mono text-[10px] text-cyan-200">{item.workshop_id}</span></div>{view === "requests" && <p className="mt-1 text-xs text-gray-500">Requested by {item.unit_name}</p>}<a href={item.map_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-xs text-cyan-300 hover:underline">Open Steam Workshop page<ExternalLink size={13}/></a></div>
            {view === "requests" ? <div><p className="text-[10px] font-black uppercase text-gray-600 md:hidden">Requested</p><p className="mt-1 text-sm text-gray-300 md:mt-0">{formatDate(item.requested_at, true)}</p></div> : <div><p className="text-[10px] font-black uppercase text-gray-600 md:hidden">Added by</p><p className="mt-1 text-sm font-bold text-white md:mt-0">{item.pre_approved_by_name || "Unknown account"}</p><p className="mt-1 text-[10px] text-gray-600">{formatDate(item.pre_approved_at, true)}</p></div>}
            {view === "requests" && <div>{item.added_to_server?<><span className="inline-flex items-center gap-2 border border-[#00ff66]/35 bg-[#00ff66]/[.06] px-3 py-2 text-xs font-black uppercase text-[#00ff66]"><Check size={14}/>On server</span><p className="mt-2 text-[10px] text-gray-600">{formatDate(item.added_at)}{item.added_by_name ? ` · ${item.added_by_name}` : ""}</p></>:<span className="inline-flex items-center gap-2 border border-amber-300/25 bg-amber-300/[.04] px-3 py-2 text-xs font-black uppercase text-amber-200"><Clock3 size={14}/>Pending</span>}</div>}
            <div className="w-full md:w-36">{canManage ? view === "requests" ? <button type="button" disabled={saving} onClick={() => void setInstalled(item, !item.added_to_server)} className={`h-10 w-full border px-3 text-xs font-black uppercase disabled:opacity-40 ${item.added_to_server ? "border-amber-300/30 text-amber-200 hover:bg-amber-300/[.07]" : "border-[#00ff66]/40 text-[#00ff66] hover:bg-[#00ff66]/[.07]"}`}>{item.added_to_server ? "Mark pending" : "Mark on server"}</button> : <button type="button" disabled={saving} onClick={() => void removePreApproved(item)} className="flex h-10 w-full items-center justify-center gap-2 border border-red-300/30 px-3 text-xs font-black uppercase text-red-200 hover:bg-red-300/[.07] disabled:opacity-40"><Trash2 size={14}/>Remove</button> : <span className="text-[10px] uppercase text-gray-700">Tracked publicly</span>}</div>
          </article>)}
          {!loading && !filtered.length && !error && <div className="grid min-h-52 place-items-center p-8 text-center text-gray-600"><div><MapPinned className="mx-auto mb-3"/><p>{view === "requests" ? "No map requests match this view." : "No pre-approved maps match this view."}</p></div></div>}
        </div>
      </section>
    </div>
    {showForm && <MapRequestForm onClose={() => setShowForm(false)} onSaved={async () => { setShowForm(false); setNotice("Map request submitted for review."); await load(); }}/>} 
    {showPreApprovedForm && (
      <PreApprovedMapForm onClose={() => setShowPreApprovedForm(false)} onSaved={async () => { setShowPreApprovedForm(false); setView("pre_approved"); setNotice("Map added to the pre-approved register."); await load(); }}/>
    )}
  </main>;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="flex items-center gap-3 border-b border-[#00ff66]/15 p-4 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0"><span className="text-[#00ff66]">{icon}</span><div><p className="text-2xl font-black">{value}</p><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#71887c]">{label}</p></div></div>;
}

function MapRequestForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [unitName, setUnitName] = useState("");
  const [mapName, setMapName] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/map-requests", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unitName, mapName, mapUrl, accepted }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to submit the map request");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to submit the map request");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target && !submitting) onClose(); }}>
    <form onSubmit={submit} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto border border-[#00ff66]/35 bg-[#020806]">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#020806] p-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-[#00ff66]">Workshop request form</p><h2 className="mt-2 text-2xl font-black uppercase">Request a Map</h2></div><button type="button" onClick={onClose} aria-label="Close map request form" className="grid size-10 place-items-center border border-white/15 text-gray-400"><X size={18}/></button></header>
      <div className="space-y-5 p-5"><label className="block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Unit name</span><input autoFocus value={unitName} onChange={(event) => setUnitName(event.target.value)} required maxLength={120} placeholder={'e.g. CI-S-21201 "Sheperd"'} className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><label className="block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Map name</span><input value={mapName} onChange={(event) => setMapName(event.target.value)} required maxLength={160} placeholder="e.g. Anizay" className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label><label className="block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Steam Workshop map link</span><input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} required maxLength={500} placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=..." className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-[#00ff66]/60"/></label>
        <label className={`flex cursor-pointer items-start gap-3 border p-4 ${accepted ? "border-[#00ff66]/40 bg-[#00ff66]/[.05]" : "border-white/15"}`}><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} required className="mt-1 size-4 shrink-0 accent-[#00ff66]"/><span><strong className="flex items-center gap-2 text-sm text-white"><ShieldCheck size={16} className="text-[#00ff66]"/>I accept responsibility for this request</strong><span className="mt-2 block text-xs leading-5 text-gray-500">I have checked this map. I accept responsibility if it is unsuitable, and I will only report it to Server Maintenance if it is completely broken. Broken maps should also be noted in server operation feedback so they can be avoided in future.</span></span></label>
        {error && <p className="border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}
      </div>
      <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-[#020806] p-4"><button type="button" onClick={onClose} disabled={submitting} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="submit" disabled={submitting || !unitName.trim() || !mapName.trim() || !mapUrl.trim() || !accepted} className="flex items-center gap-2 bg-[#00ff66] px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-40"><Send size={16}/>{submitting ? "Submitting..." : "Submit request"}</button></footer>
    </form>
  </div>;
}

function PreApprovedMapForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void | Promise<void> }) {
  const [mapName, setMapName] = useState("");
  const [mapUrl, setMapUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/map-requests", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(await getAppAuthHeaders()) },
        body: JSON.stringify({ entryType: "pre_approved", mapName, mapUrl }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "Unable to add the pre-approved map");
      await onSaved();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to add the pre-approved map");
    } finally {
      setSubmitting(false);
    }
  }

  return <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target && !submitting) onClose(); }}>
    <form onSubmit={submit} className="w-full max-w-xl border border-cyan-300/35 bg-[#020806]">
      <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-cyan-200">Approved map register</p><h2 className="mt-2 text-2xl font-black uppercase">Add Pre-approved Map</h2><p className="mt-2 text-xs leading-5 text-gray-500">Your logged-in account will be recorded automatically as the person who added this map.</p></div><button type="button" onClick={onClose} aria-label="Close pre-approved map form" className="grid size-10 shrink-0 place-items-center border border-white/15 text-gray-400"><X size={18}/></button></header>
      <div className="space-y-5 p-5"><label className="block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Map name</span><input autoFocus value={mapName} onChange={(event) => setMapName(event.target.value)} required maxLength={160} placeholder="e.g. Anizay" className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-cyan-300/60"/></label><label className="block"><span className="text-xs font-black uppercase tracking-[.12em] text-gray-400">Steam Workshop map link</span><input type="url" value={mapUrl} onChange={(event) => setMapUrl(event.target.value)} required maxLength={500} placeholder="https://steamcommunity.com/sharedfiles/filedetails/?id=..." className="mt-2 h-11 w-full border border-white/15 bg-black px-3 text-sm outline-none focus:border-cyan-300/60"/></label>{error && <p className="border border-red-300/25 bg-red-300/10 p-3 text-sm text-red-100">{error}</p>}</div>
      <footer className="flex justify-end gap-2 border-t border-white/10 p-4"><button type="button" onClick={onClose} disabled={submitting} className="border border-white/15 px-4 py-2 text-sm text-gray-300">Cancel</button><button type="submit" disabled={submitting || !mapName.trim() || !mapUrl.trim()} className="flex items-center gap-2 bg-cyan-300 px-4 py-2 text-sm font-black uppercase text-black disabled:opacity-40"><ShieldCheck size={16}/>{submitting ? "Adding..." : "Add to register"}</button></footer>
    </form>
  </div>;
}
